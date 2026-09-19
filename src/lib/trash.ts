/** Days a PO stays in the Trash before purge_trash() removes it for good. */
export const TRASH_DAYS = 90;

/** Whole days left before a trashed PO is purged (never below 0). */
export function daysLeft(deletedAt: string, now = new Date()): number {
  const purgeAt = new Date(deletedAt).getTime() + TRASH_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((purgeAt - now.getTime()) / 86_400_000));
}
