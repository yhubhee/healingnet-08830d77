// Family verification in the browser: check the chosen file, shrink photos on a canvas,
// upload to the private "family-documents" bucket and submit for review. The rules and
// wording are in src/lib/verification.ts (the same file as the app's). Nothing about the
// document or the person is ever logged.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  checkDocumentFile, DOCUMENT_BUCKET, documentFolder, documentMime, documentPath, MAX_DOCUMENT_BYTES, PHOTO_QUALITY, photoTarget, TOO_LARGE, WRONG_TYPE,
  type DocumentType,
} from "./verification";

/** A problem the person can fix; its message is shown as it is. */
export class DocumentError extends Error {}

export interface ChosenDocument {
  blob: Blob;
  mime: string;
  name: string;
  isImage: boolean;
  /** For the preview; revoke with URL.revokeObjectURL when done. */
  previewUrl: string;
}

/** Photos: at most 2000 px on the long side, saved as JPEG at about 80% quality. */
async function shrinkPhoto(file: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const target = photoTarget(bitmap.width, bitmap.height) ?? { width: bitmap.width, height: bitmap.height };
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // White behind transparent pictures, so a PNG scan does not turn black as a JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close?.();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
  } catch {
    return null; // a format this browser cannot draw (HEIC on most): sent as it is
  }
}

/** Checks the file and gets it ready to send. Anything over 5 MB, or not a photo or PDF, is refused. */
export async function prepareDocument(file: File): Promise<ChosenDocument> {
  const mime = documentMime(file.type, file.name);
  if (!mime) throw new DocumentError(WRONG_TYPE);
  let blob: Blob = file;
  let outMime = mime;
  if (mime !== "application/pdf") {
    const small = await shrinkPhoto(file);
    if (small) { blob = small; outMime = "image/jpeg"; }
  }
  const problem = checkDocumentFile({ size: blob.size, mimeType: outMime, name: file.name });
  if (problem) throw new DocumentError(problem);
  if (blob.size > MAX_DOCUMENT_BYTES) throw new DocumentError(TOO_LARGE);
  return { blob, mime: outMime, name: file.name, isImage: outMime !== "application/pdf" && outMime !== "image/heic", previewUrl: URL.createObjectURL(blob) };
}

/** Uploads to the guardian's own folder for this member, then submits. The database's messages are thrown as they are. */
export function useSubmitFamilyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, type, doc }: { patientId: string; type: DocumentType; doc: ChosenDocument }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in again.");
      const path = documentPath(auth.user.id, patientId, crypto.randomUUID(), doc.mime);
      const upload = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, doc.blob, { contentType: doc.mime, upsert: false });
      if (upload.error) throw upload.error;
      const { error } = await supabase.rpc("submit_family_document", { p_patient_id: patientId, p_document_type: type, p_storage_path: path });
      if (error) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([path]).catch(() => {});
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-family"] }),
  });
}

/**
 * After a member is removed: delete their folder in the bucket. Errors are ignored; files
 * still under review are protected by the database.
 */
export async function removeMemberDocuments(patientId: string): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const folder = documentFolder(auth.user.id, patientId);
    const { data } = await supabase.storage.from(DOCUMENT_BUCKET).list(folder, { limit: 100 });
    const paths = (data ?? []).map((f) => `${folder}/${f.name}`);
    if (paths.length) await supabase.storage.from(DOCUMENT_BUCKET).remove(paths);
  } catch { /* nothing the person can do about it */ }
}
