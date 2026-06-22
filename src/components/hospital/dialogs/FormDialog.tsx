import { ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Props {
  title: string;
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  trigger?: ReactNode;
  children: (close: () => void) => ReactNode;
  size?: "md" | "lg" | "xl";
  onOpenChange?: (open: boolean) => void;
}

export function FormDialog({ title, triggerLabel = "Add", triggerIcon, trigger, children, size = "lg", onOpenChange }: Props) {
  const [open, setOpen] = useState(false);
  const sizeClass = size === "xl" ? "max-w-2xl" : size === "lg" ? "max-w-lg" : "max-w-md";

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button>{triggerIcon || <Plus className="w-4 h-4 mr-2" />}{triggerLabel}</Button>}
      </DialogTrigger>
      <DialogContent className={sizeClass}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

export async function handleSubmit(
  promise: PromiseLike<{ error: any }>,
  opts: { toast: any; close: () => void; qc: any; invalidate: string[]; successMsg?: string }
) {
  const { error } = await promise;
  if (error) return opts.toast({ title: "Failed", description: error.message, variant: "destructive" });
  opts.toast({ title: opts.successMsg || "Saved" });
  opts.close();
  opts.invalidate.forEach((k) => opts.qc.invalidateQueries({ queryKey: [k] }));
}
