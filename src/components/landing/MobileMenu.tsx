import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const links = [
  ["Home", "/"],
  ["About", "/about"],
  ["Services", "/services"],
  ["Features", "/features"],
  ["Pricing", "/pricing"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <nav className="flex flex-col gap-2 mt-8">
          {links.map(([label, href]) => (
            <Link key={href} to={href} onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg hover:bg-accent text-base font-medium">
              {label}
            </Link>
          ))}
          <div className="border-t border-border my-3" />
          <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg hover:bg-accent">Login</Link>
          <Link to="/signup" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-center font-medium">Get Started</Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
