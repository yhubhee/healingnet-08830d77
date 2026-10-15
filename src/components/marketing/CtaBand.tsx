import { Link } from "react-router-dom";
import { mkButton } from "./buttons";
import { Reveal } from "./Reveal";

interface Action {
  label: string;
  to: string;
}

/** Closing call to action. The primary button is the page's one coral highlight. */
export function CtaBand({
  title = "Get care today",
  text = "Create a free account in a minute. No app to download.",
  primary = { label: "Create free account", to: "/signup" },
  secondary = { label: "I'm a hospital", to: "/hospitals" },
}: {
  title?: string;
  text?: string;
  primary?: Action;
  secondary?: Action | null;
}) {
  return (
    <section className="mk-section" aria-labelledby="cta-title">
      <div className="mk-container">
        <Reveal className="rounded-3xl bg-muted px-6 py-12 text-center md:px-12 md:py-16">
          <h2 id="cta-title">{title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{text}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to={primary.to} className={mkButton({ variant: "accent", size: "lg" })}>{primary.label}</Link>
            {secondary && <Link to={secondary.to} className={mkButton({ variant: "secondary", size: "lg" })}>{secondary.label}</Link>}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
