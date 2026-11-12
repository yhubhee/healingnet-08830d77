// Profile photos: taken with the camera or chosen from the gallery, resized to at most
// 512 px, then uploaded to the public "avatars" bucket under the user's own folder, the
// same path the website uses (src/lib/avatar.ts).
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 512;

export class AvatarError extends Error {}

/** Opens the camera or the gallery. Returns null if the person backs out. */
export async function pickPhoto(source: "camera" | "gallery"): Promise<ImagePicker.ImagePickerAsset | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new AvatarError("Allow camera access in your phone's settings to take a photo.");
    const result = await ImagePicker.launchCameraAsync(options);
    return result.canceled ? null : result.assets[0] ?? null;
  }
  const result = await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0] ?? null;
}

/** Resize and upload a profile photo; returns its public URL. */
export async function uploadAvatar(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AvatarError("Please sign in again.");

  let bytes: ArrayBuffer;
  try {
    const landscape = (asset.width ?? 0) >= (asset.height ?? 0);
    const needsResize = Math.max(asset.width ?? 0, asset.height ?? 0) > MAX_SIDE;
    const resized = await manipulateAsync(
      asset.uri,
      needsResize ? [{ resize: landscape ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [],
      { compress: 0.9, format: SaveFormat.JPEG },
    );
    bytes = await (await fetch(resized.uri)).arrayBuffer();
  } catch {
    throw new AvatarError("That file doesn't look like a photo we can read.");
  }
  if (bytes.byteLength > MAX_BYTES) throw new AvatarError("The photo is too large. Choose one under 2 MB.");

  const path = `${user.id}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
