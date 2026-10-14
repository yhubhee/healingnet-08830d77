// Details open in a right Sheet on desktop and a full-height Drawer on mobile.
import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DetailPanel({
  open, onOpenChange, title, subtitle, children,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="mt-0 h-[94dvh]">
          <DrawerHeader className="relative text-left">
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-2 top-2" aria-label="Close"><X className="h-4 w-4" /></Button>
            </DrawerClose>
            <DrawerTitle className="font-heading pr-10">{title}</DrawerTitle>
            <DrawerDescription asChild><div>{subtitle}</div></DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-8">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="mb-4 text-left">
          <SheetTitle className="font-heading pr-8">{title}</SheetTitle>
          <SheetDescription asChild><div>{subtitle}</div></SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
