import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Photo } from "./Photo";

/** Large photo card for one service, with a "Learn more" link. */
export function ServiceCard({ photo, title, text, to, linkLabel = "Learn more" }: {
  photo: string;
  title: string;
  text: string;
  to: string;
  linkLabel?: string;
}) {
  return (
    <article className="mk-card mk-card-hover group flex h-full flex-col overflow-hidden">
      <Photo id={photo} alt="" sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" className="aspect-[4/3]" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
      <div className="flex flex-1 flex-col p-6">
        <h3 className="mb-2">{title}</h3>
        <p className="mb-5 flex-1 text-base text-muted-foreground">{text}</p>
        <Link to={to} className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-primary underline-offset-4 hover:underline">
          {linkLabel}<span className="sr-only">: {title}</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
