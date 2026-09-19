"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileTab({ href, label, icon }: { href: string; label: string; icon: string }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 ${active ? "text-slate-900 font-medium" : "text-slate-500"} active:bg-slate-50`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={icon} />
      </svg>
      {label}
    </Link>
  );
}
