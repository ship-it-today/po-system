import type { Activity } from "@/lib/types";
import { displayName } from "@/lib/types";
import { addComment } from "@/app/po/actions";

const VERB: Record<Activity["kind"], string> = {
  submitted: "submitted this PO",
  edited: "edited this PO",
  approved: "approved this PO",
  denied: "denied this PO",
  comment: "commented",
};

export default function ActivityFeed({ poId, items }: { poId: string; items: Activity[] }) {
  return (
    <section id="activity" className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold mb-4">Activity &amp; Comments</h2>
      <ol className="space-y-4">
        {items.length === 0 && <li className="text-sm text-slate-500">No activity yet.</li>}
        {items.map((a) => (
          <li key={a.id} className="flex gap-3 text-sm">
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                a.kind === "approved" ? "bg-emerald-500" : a.kind === "denied" ? "bg-red-500" : a.kind === "comment" ? "bg-slate-400" : "bg-slate-900"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">{displayName(a.author)}</span> {VERB[a.kind]}
                <span className="text-slate-400"> · {new Date(a.created_at).toLocaleString()}</span>
              </div>
              {a.body && (
                <p className={`mt-1 whitespace-pre-wrap ${a.kind === "comment" ? "rounded-md bg-slate-50 px-3 py-2" : "text-slate-700"}`}>
                  {a.body}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <form action={addComment} className="mt-5 flex flex-col gap-2">
        <input type="hidden" name="id" value={poId} />
        <textarea
          name="body"
          required
          rows={2}
          maxLength={2000}
          placeholder="Ask a question or add context…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Post comment
          </button>
        </div>
      </form>
    </section>
  );
}
