// Credential documents: each opens through a 60-second signed URL. Images and PDFs show in a
// dialog; anything else is offered as a download.
import { useState } from "react";
import { Download, ExternalLink, FileImage, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signedCredentialUrl } from "../api";
import { actionError, titleCase } from "../format";

const LABELS: Record<string, string> = {
  license: "Medical licence",
  id: "Government ID",
  certificate: "Medical school certificate",
  photo: "Passport photo",
};

const kindOf = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "file";
};

export function CredentialDocuments({ docs }: { docs: Record<string, string> | null | undefined }) {
  const entries = Object.entries(docs ?? {}).filter(([, p]) => typeof p === "string" && p);
  const [loading, setLoading] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ label: string; url: string; kind: string } | null>(null);

  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No documents uploaded.</p>;

  const open = async (key: string, path: string) => {
    setLoading(key);
    try {
      const url = await signedCredentialUrl(path);
      const kind = kindOf(path);
      if (kind === "file") window.open(url, "_blank", "noopener,noreferrer");
      else setViewing({ label: LABELS[key] ?? titleCase(key), url, kind });
    } catch (e) {
      toast.error("Couldn't open the document", { description: actionError(e) });
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {entries.map(([key, path]) => {
          const kind = kindOf(path);
          const Icon = kind === "image" ? FileImage : FileText;
          return (
            <li key={key}>
              <Button variant="outline" className="h-auto w-full justify-start gap-2 rounded-xl py-2 text-left" onClick={() => open(key, path)} disabled={loading === key}>
                {loading === key ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{LABELS[key] ?? titleCase(key)}</span>
                  <span className="block text-xs text-muted-foreground">{kind === "file" ? "Download" : kind === "pdf" ? "PDF" : "Image"}</span>
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-4xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.label}</DialogTitle>
            <DialogDescription>The link expires 60 seconds after opening. Reopen the document if it stops loading.</DialogDescription>
          </DialogHeader>
          {viewing?.kind === "image" && (
            <img src={viewing.url} alt={viewing.label} className="max-h-[70vh] w-full rounded-xl object-contain bg-muted" />
          )}
          {viewing?.kind === "pdf" && (
            <iframe src={viewing.url} title={viewing.label} className="h-[70vh] w-full rounded-xl border bg-muted" />
          )}
          {viewing && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={viewing.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open in new tab</a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={viewing.url} download><Download className="mr-2 h-4 w-4" />Download</a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
