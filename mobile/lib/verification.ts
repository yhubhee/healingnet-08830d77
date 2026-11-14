// Family verification on the phone: take a photo or choose a file, shrink photos, upload
// to the private "family-documents" bucket and submit it for review. The rules and wording
// are in shared/verification.ts. Nothing about the document or the person is ever logged.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";
import {
  checkDocumentFile, DOCUMENT_ACCEPT, DOCUMENT_BUCKET, documentFolder, documentMime, documentPath, MAX_DOCUMENT_BYTES, PHOTO_QUALITY, photoTarget,
  TOO_LARGE, WRONG_TYPE, type DocumentType,
} from "@/shared/verification";
import { supabase } from "./supabase";

/** A problem the person can fix; its message is shown as it is. */
export class DocumentError extends Error {}

export interface ChosenDocument {
  uri: string;
  mime: string;
  /** Shown in the preview. */
  name: string;
  isImage: boolean;
  bytes: ArrayBuffer;
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  return (await fetch(uri)).arrayBuffer();
}

/** Photos: at most 2000 px on the long side, saved as JPEG at about 80% quality. */
async function preparePhoto(uri: string, width: number, height: number): Promise<ChosenDocument> {
  let out: { uri: string };
  try {
    const target = photoTarget(width, height);
    out = await manipulateAsync(uri, target ? [{ resize: target }] : [], { compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
  } catch {
    throw new DocumentError("That photo couldn't be read. Try again, or choose a file.");
  }
  const bytes = await readBytes(out.uri);
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocumentError(TOO_LARGE);
  return { uri: out.uri, mime: "image/jpeg", name: "Photo of the document", isImage: true, bytes };
}

/**
 * Opens the camera, the photo gallery or the file chooser. Returns null if the person backs
 * out. Anything over 5 MB, or not a photo or PDF, is refused with a clear message.
 */
export async function chooseDocument(source: "camera" | "gallery" | "file"): Promise<ChosenDocument | null> {
  if (source === "file") {
    const result = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_ACCEPT, copyToCacheDirectory: true, multiple: false });
    const file = result.canceled ? null : result.assets?.[0];
    if (!file) return null;
    const problem = checkDocumentFile({ size: file.size, mimeType: file.mimeType, name: file.name });
    if (problem) throw new DocumentError(problem);
    const mime = documentMime(file.mimeType, file.name);
    if (!mime) throw new DocumentError(WRONG_TYPE);
    if (mime !== "application/pdf") {
      // A picture chosen as a file is shrunk like a photo.
      const size = await new Promise<{ width: number; height: number }>((resolve) => {
        Image.getSize(file.uri, (width, height) => resolve({ width, height }), () => resolve({ width: 0, height: 0 }));
      });
      return preparePhoto(file.uri, size.width, size.height);
    }
    const bytes = await readBytes(file.uri);
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocumentError(TOO_LARGE);
    return { uri: file.uri, mime, name: file.name || "Document.pdf", isImage: false, bytes };
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, quality: 1 };
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new DocumentError("Allow camera access in your phone's settings to take a photo, or choose a file instead.");
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  return preparePhoto(asset.uri, asset.width ?? 0, asset.height ?? 0);
}

/**
 * Uploads the document to the guardian's own folder for this member, then submits it. The
 * database's messages are thrown as they are. If submitting fails the upload is removed.
 */
export function useSubmitFamilyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, patientId, type, doc }: { userId: string; patientId: string; type: DocumentType; doc: ChosenDocument }) => {
      const path = documentPath(userId, patientId, Crypto.randomUUID(), doc.mime);
      const upload = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, doc.bytes, { contentType: doc.mime, upsert: false });
      if (upload.error) throw upload.error;
      const { error } = await supabase.rpc("submit_family_document", { p_patient_id: patientId, p_document_type: type, p_storage_path: path });
      if (error) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([path]).catch(() => {});
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }),
  });
}

/**
 * After a member is removed: delete their folder in the bucket. Errors are ignored; files
 * still under review are protected by the database and go when the review ends.
 */
export async function removeMemberDocuments(userId: string | null, patientId: string): Promise<void> {
  if (!userId) return;
  try {
    const folder = documentFolder(userId, patientId);
    const { data } = await supabase.storage.from(DOCUMENT_BUCKET).list(folder, { limit: 100 });
    const paths = (data ?? []).map((f) => `${folder}/${f.name}`);
    if (paths.length) await supabase.storage.from(DOCUMENT_BUCKET).remove(paths);
  } catch { /* nothing the person can do about it */ }
}
