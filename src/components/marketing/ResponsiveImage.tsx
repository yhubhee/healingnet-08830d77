import { useState } from "react";
import { cn } from "@/lib/utils";

/** One processed photo in public/images/marketing (written by scripts/fetch-images.mjs). */
export interface MarketingImage {
  id: string;
  width: number;
  height: number;
  /** Tiny blurred base64 placeholder. */
  blur: string;
}

export const IMAGE_WIDTHS = [480, 960, 1600] as const;

function srcSet(id: string, ext: "avif" | "webp") {
  return IMAGE_WIDTHS.map((w) => `/images/marketing/${id}-${w}.${ext} ${w}w`).join(", ");
}

/**
 * <picture> with AVIF + WebP sources, explicit size (no layout shift), lazy by default
 * and a blurred placeholder until the photo arrives. `priority` is for the hero image only.
 */
export function ResponsiveImage({ image, alt, sizes = "100vw", priority = false, className, imgClassName }: {
  image: MarketingImage;
  /** Required. Use "" only for decorative images. */
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  // React 18 doesn't know `fetchPriority`; the lowercase attribute passes straight through.
  const priorityAttrs = priority ? { fetchpriority: "high" } : {};
  return (
    <picture className={cn("block overflow-hidden", className)}>
      <source type="image/avif" srcSet={srcSet(image.id, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(image.id, "webp")} sizes={sizes} />
      <img
        src={`/images/marketing/${image.id}-960.webp`}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...priorityAttrs}
        onLoad={() => setLoaded(true)}
        className={cn("h-full w-full object-cover", imgClassName)}
        style={loaded ? undefined : { backgroundImage: `url(${image.blur})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
    </picture>
  );
}
