import { ResponsiveImage } from "./ResponsiveImage";
import { photos } from "./imageData";
import { CareIllustration } from "./illustrations";
import { cn } from "@/lib/utils";

/**
 * A processed marketing photo by id (scripts/images.manifest.json). If the photo
 * isn't there (download failed), the slot shows an illustration instead of a grey box.
 */
export function Photo({ id, alt, sizes, priority, className, imgClassName }: {
  id: string;
  /** Overrides the manifest alt text. "" marks the photo as decorative. */
  alt?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const photo = photos[id];
  if (!photo) {
    return (
      <div className={cn("overflow-hidden bg-muted", className)}>
        <CareIllustration className="h-full w-full" preserveAspectRatio="xMidYMid slice" />
      </div>
    );
  }
  return (
    <ResponsiveImage
      image={photo}
      alt={alt ?? photo.alt}
      sizes={sizes}
      priority={priority}
      className={className}
      imgClassName={imgClassName}
    />
  );
}
