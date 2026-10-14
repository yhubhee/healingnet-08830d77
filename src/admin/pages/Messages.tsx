// /admin/messages: contact form messages, admin_list_contact_messages() / admin_mark_contact_handled().
import { useState } from "react";
import { CheckCheck, Inbox, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarkContactHandled, useMessages, type ContactMessage } from "../api";
import { actionError } from "../format";
import { EmptyState, ErrorState, Pager, RelTime } from "../components/bits";
import { useUrlState } from "../components/url-state";

function MessageCard({ m }: { m: ContactMessage }) {
  const [expanded, setExpanded] = useState(false);
  const mark = useMarkContactHandled();
  const long = m.message.length > 280;
  const handled = !!m.handled_at;

  return (
    <article className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold">{m.subject || "(no subject)"}</h2>
          <p className="text-sm text-muted-foreground">
            {m.name} · <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + (m.subject || "Your message to HealingNet"))}`} className="text-primary underline-offset-2 hover:underline">{m.email}</a>
          </p>
        </div>
        <span className="text-xs text-muted-foreground"><RelTime iso={m.created_at} /></span>
      </div>
      <p id={`msg-${m.id}`} className={`mt-3 whitespace-pre-wrap break-words text-sm ${!expanded && long ? "line-clamp-4" : ""}`}>{m.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {long && (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-controls={`msg-${m.id}`}>
            {expanded ? "Show less" : "Show full message"}
          </Button>
        )}
        <Button
          size="sm" variant={handled ? "outline" : "default"} className="ml-auto" disabled={mark.isPending}
          onClick={() => mark.mutate({ id: m.id, handled: !handled }, {
            onSuccess: () => toast.success(handled ? "Message reopened" : "Marked as handled"),
            onError: (e) => toast.error("Couldn't update the message", { description: actionError(e) }),
          })}
        >
          {handled ? <><RotateCcw className="mr-1.5 h-4 w-4" />Reopen</> : <><CheckCheck className="mr-1.5 h-4 w-4" />Mark handled</>}
        </Button>
      </div>
      {handled && <p className="mt-2 text-xs text-muted-foreground">Handled <RelTime iso={m.handled_at} /></p>}
    </article>
  );
}

export default function Messages() {
  const { get, set, page } = useUrlState();
  const handled = get("tab") === "handled";
  const q = useMessages({ handled, page });

  return (
    <div>
      <Tabs value={handled ? "handled" : "open"} onValueChange={(v) => set({ tab: v === "open" ? null : v })} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="handled">Handled</TabsTrigger>
        </TabsList>
      </Tabs>
      {q.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading messages">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
      ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data && q.data.rows.length === 0 ? (
        <EmptyState icon={handled ? Mail : Inbox} text={handled ? "No handled messages yet." : "Inbox zero. No open messages."} />
      ) : q.data && (
        <>
          <div className={`space-y-3 transition-opacity ${q.isPlaceholderData ? "opacity-60" : ""}`}>
            {q.data.rows.map((m) => <MessageCard key={m.id} m={m} />)}
          </div>
          <Pager page={page} total={q.data.total} onPage={(p) => set({ page: p })} fetching={q.isFetching} />
        </>
      )}
    </div>
  );
}
