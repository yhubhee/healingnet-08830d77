import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { MobileMenu } from "./MobileMenu";
import { cn } from "@/lib/utils";

const links = [
  ["Home", "/"],
  ["About", "/about"],
  ["Services", "/services"],
  ["Features", "/features"],
  ["Pricing", "/pricing"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="container mx-auto flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-heading font-bold text-xl">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" fill="currentColor" />
          </div>
          HealingNet
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm">
          {links.map(([label, href]) => (
            <NavLink
              key={href}
              to={href}
              end={href === "/"}
              className={({ isActive }) =>
                cn("transition-colors", isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Login</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/signup">Get Started</Link></Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
