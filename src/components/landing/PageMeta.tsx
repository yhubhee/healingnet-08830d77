import { useEffect } from "react";

function setMeta(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

export function PageMeta({ title, description, noindex = false }: { title: string; description: string; noindex?: boolean }) {
  useEffect(() => {
    document.title = title;
    setMeta("description", description);
    setMeta("robots", noindex ? "noindex" : "index, follow");
  }, [title, description, noindex]);
  return null;
}
