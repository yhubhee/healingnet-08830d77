// Profile photos: resized in the browser to at most 512 px, then uploaded to the public
// "avatars" bucket under the user's own folder (the only folder storage policy allows).
import { supabase } from "@/integrations/supabase/client";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 512;

export class AvatarError extends Error {}

async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("Your browser couldn't process this photo.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, file.type, 0.9));
  if (!blob) throw new AvatarError("Your browser couldn't process this photo.");
  return blob;
}

/** Resize and upload a profile photo; returns its public URL. */
export async function uploadAvatar(file: File): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new AvatarError("Choose a JPG, PNG or WebP photo.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AvatarError("Please sign in again.");

  let blob: Blob;
  try {
    blob = await resize(file);
  } catch (e) {
    if (e instanceof AvatarError) throw e;
    throw new AvatarError("That file doesn't look like a photo we can read.");
  }
  if (blob.size > MAX_BYTES) throw new AvatarError("The photo is too large. Choose one under 2 MB.");

  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
