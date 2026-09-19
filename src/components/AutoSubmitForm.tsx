"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * A GET form that applies itself: selects/dates/radios navigate on change,
 * text inputs after a short pause (or Enter). Uses client-side navigation so
 * the page doesn't fully reload. No Apply button needed.
 */
export default function AutoSubmitForm({
  action,
  className,
  debounceMs = 350,
  children,
}: {
  action: string;
  className?: string;
  debounceMs?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  function go() {
    const form = formRef.current;
    if (!form) return;
    const sp = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      const s = String(v);
      if (s !== "") sp.set(k, s);
    });
    // Filters changed → back to page 1.
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${action}?${qs}` : action));
  }

  function onChange(e: React.ChangeEvent<HTMLFormElement>) {
    const t = e.target as unknown as HTMLInputElement | HTMLSelectElement;
    const isText = t.tagName === "INPUT" && ["text", "search", "number", "tel"].includes((t as HTMLInputElement).type);
    if (timer.current) clearTimeout(timer.current);
    if (isText) timer.current = setTimeout(go, debounceMs);
    else go();
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      className={className}
      onChange={onChange}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go();
      }}
      aria-busy={pending}
      data-pending={pending ? "" : undefined}
    >
      {children}
    </form>
  );
}
