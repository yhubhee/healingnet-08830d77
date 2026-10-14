import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AvatarError, uploadAvatar } from "@/lib/avatar";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

/** Round photo with a "change photo" button. Calls onUploaded with the new public URL. */
export function AvatarUpload({
  url, initials, onUploaded, className, required,
}: { url: string | null | undefined; initials: string; onUploaded: (url: string) => void | Promise<void>; className?: string; required?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const publicUrl = await uploadAvatar(file);
      await onUploaded(publicUrl);
    } catch (e) {
      toast.error("Couldn't upload the photo", { description: e instanceof AvatarError ? e.message : friendlyError(e) });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground">
        {url ? <img src={url} alt="Profile photo" className="h-full w-full object-cover" /> : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-bold">{initials || "?"}</span>
        )}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-background/60"><Loader2 className="h-6 w-6 animate-spin" /></span>}
      </div>
      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          <Camera className="mr-1.5 h-4 w-4" />{url ? "Change photo" : "Add photo"}{required && !url ? " *" : ""}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB.</p>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
    </div>
  );
}
