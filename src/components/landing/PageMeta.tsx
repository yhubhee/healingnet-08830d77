import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SITE_URL } from "@/components/marketing/content";

const OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Create or update a <meta> by name or property. */
function setMeta(attr: "name" | "property", key: string, content: string) {
  let meta = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Per-page title, description, canonical URL, Open Graph and Twitter tags,
 * and optional JSON-LD (removed again when the page unmounts).
 */
export function PageMeta({ title, description, noindex = false, jsonLd }: {
  title: string;
  description: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}) {
  const { pathname } = useLocation();

  useEffect(() => {
    const url = `${SITE_URL}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex" : "index, follow");
    setCanonical(url);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "HealingNet");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", OG_IMAGE);
    setMeta("property", "og:locale", "en_NG");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", OG_IMAGE);
  }, [title, description, noindex, pathname]);

  useEffect(() => {
    if (!jsonLd) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => script.remove();
  }, [jsonLd]);

  return null;
}
