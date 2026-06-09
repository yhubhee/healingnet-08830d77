import { ReactNode, useState } from "react";
import { DoctorSidebar } from "@/components/doctor/DoctorSidebar";
import { VerificationGate } from "@/components/doctor/VerificationGate";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Heart } from "lucide-react";

export function DoctorLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex"><DoctorSidebar /></div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-border bg-sidebar">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2"><Menu className="w-5 h-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar">
              <div onClick={() => setOpen(false)}><DoctorSidebar /></div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-primary-foreground" fill="currentColor" />
            </div>
            <span className="font-heading font-bold text-sm">HealingNet</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <VerificationGate>{children}</VerificationGate>
        </main>
      </div>
    </div>
  );
}
