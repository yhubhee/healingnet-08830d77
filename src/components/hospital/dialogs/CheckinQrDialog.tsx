// Front desk: the hospital's check-in QR code. Patients scan it with the HealingNet app (or
// their phone camera) to join today's queue. The code is made on first use; a hospital admin
// can replace it, which stops old posters working. The code itself is never logged.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, QrCode as QrIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/rx/QrCode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalId, useHospitalInfo } from "@/hooks/useHospitalData";
import { checkinUrl } from "@/lib/checkin";
import { friendlyError } from "@/lib/errors";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** An A4 poster, printed from a hidden frame so the page behind is left alone. */
async function printPoster(hospitalName: string, url: string) {
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Check-in poster</title><style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; text-align: center; }
    h1 { font-size: 30pt; margin: 0 0 4mm; line-height: 1.15; }
    .lead { font-size: 17pt; margin: 0 0 8mm; color: #186e6a; font-weight: 700; }
    .qr { width: 120mm; height: 120mm; margin: 0 auto 8mm; }
    .qr svg { width: 100%; height: 100%; }
    ol { list-style: none; padding: 0; margin: 0 auto 8mm; display: flex; justify-content: center; gap: 6mm; }
    li { flex: 1; max-width: 52mm; border: 0.6mm solid #186e6a; border-radius: 4mm; padding: 5mm 3mm; font-size: 14pt; font-weight: 600; }
    li span { display: block; font-size: 22pt; color: #186e6a; }
    .alt { font-size: 14pt; margin: 0 0 6mm; }
    .foot { font-size: 10pt; color: #475569; }
  </style></head><body>
    <h1>${esc(hospitalName)}</h1>
    <p class="lead">Scan with the HealingNet app to check in</p>
    <div class="qr">${svg}</div>
    <ol><li><span>1</span>Open HealingNet</li><li><span>2</span>Tap Check in</li><li><span>3</span>Scan this code</li></ol>
    <p class="alt">No app? Scan with your phone camera.</p>
    <p class="foot">You'll get a queue number and a notification when it's your turn.</p>
  </body></html>`;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.srcdoc = html;
  frame.onload = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { toast.error("We couldn't open the print window."); }
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}

export function CheckinQrDialog() {
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: hospitalId } = useHospitalId();
  const { data: hospital } = useHospitalInfo();
  const name = hospital?.name ?? "Hospital";

  const code = useQuery({
    queryKey: ["hospital-checkin-code", hospitalId],
    enabled: open && !!hospitalId,
    staleTime: 5 * 60_000,
    meta: { inlineError: true },
    queryFn: async () => {
      const { data, error } = await supabase.rpc("hospital_checkin_code", { p_hospital_id: hospitalId! });
      if (error) throw error;
      return data as string;
    },
  });
  // Only to decide whether to show "Reset code"; the database enforces who may reset.
  const admin = useQuery({
    queryKey: ["hospital-my-role", hospitalId, user?.id],
    enabled: open && !!hospitalId && !!user,
    meta: { inlineError: true },
    queryFn: async () => {
      const { data } = await supabase.from("hospital_staff").select("role").eq("hospital_id", hospitalId!).eq("user_id", user!.id).eq("is_active", true).maybeSingle();
      return data?.role === "admin";
    },
  });

  const url = code.data ? checkinUrl(window.location.origin, code.data) : null;

  async function reset() {
    if (!hospitalId) return;
    setResetting(true);
    const { data, error } = await supabase.rpc("reset_hospital_checkin_code", { p_hospital_id: hospitalId });
    setResetting(false);
    if (error || !data) { toast.error(/only the hospital admin/i.test(error?.message ?? "") ? "Only the hospital admin can reset the check-in code." : friendlyError(error)); return; }
    qc.setQueryData(["hospital-checkin-code", hospitalId], data);
    toast.success("New code ready. Print the new poster.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><QrIcon className="mr-2 h-4 w-4" />Check-in QR code</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check-in QR code</DialogTitle>
          <DialogDescription>Put this at the front desk. Patients scan it to join today's queue.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-heading text-xl font-bold">{name}</p>
          {url ? <QrCode text={url} size={280} label={`Check-in QR code for ${name}`} className="h-auto w-full max-w-[280px]" />
            : code.isError ? <p role="alert" className="py-10 text-sm text-destructive">{friendlyError(code.error, "We couldn't load the check-in code.")}</p>
            : <div className="h-[280px] w-[280px] animate-pulse rounded-lg bg-muted" aria-label="Loading the check-in code" />}
          <p className="font-medium">Scan with the HealingNet app to check in</p>
          <p className="text-sm text-muted-foreground">No app? Patients can scan it with their phone camera.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button disabled={!url} onClick={() => url && printPoster(name, url)}><Printer className="mr-2 h-4 w-4" />Print poster</Button>
          {admin.data && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" disabled={!url || resetting}><RefreshCw className="mr-2 h-4 w-4" />Reset code</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the check-in code?</AlertDialogTitle>
                  <AlertDialogDescription>Old posters will stop working. Print the new one.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep this code</AlertDialogCancel>
                  <AlertDialogAction onClick={reset}>Reset code</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
