import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-12 bg-card/30">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="flex items-center gap-2 font-heading font-bold text-lg mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center">
                <Heart className="w-4 h-4 text-primary-foreground" fill="currentColor" />
              </div>
              HealingNet
            </Link>
            <p className="text-sm text-muted-foreground">Modern healthcare operations, simplified for Nigerian hospitals.</p>
          </div>
          {[
            { title: "Product", links: [["Features", "/features"], ["Services", "/services"], ["Pricing", "/pricing"]] },
            { title: "Company", links: [["About", "/about"], ["Contact", "/contact"], ["Email us", "mailto:hello@healingnet.app"]] },
            { title: "Resources", links: [["FAQ", "/faq"], ["Login", "/login"], ["Sign up", "/signup"]] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-heading font-bold mb-3 text-sm">{col.title}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("/") ? (
                      <Link to={href} className="hover:text-foreground transition-colors">{label}</Link>
                    ) : (
                      <a href={href} className="hover:text-foreground transition-colors">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-border text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} HealingNet. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
