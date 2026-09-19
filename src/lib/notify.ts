/**
 * Email notifications via Resend (https://resend.com). Entirely optional:
 * when RESEND_API_KEY is unset, sendEmail() is a no-op.
 * Never throws — a failed email must not break the user's action.
 */
export async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Purchase Orders <onboarding@resend.dev>";
  const recipients = to.filter(Boolean);
  if (!key || recipients.length === 0) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });
  } catch (e) {
    console.error("email failed", e);
  }
}

export const notificationsEnabled = () => Boolean(process.env.RESEND_API_KEY);

export function emailLayout(title: string, lines: string[], ctaUrl: string, ctaText: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
    ${lines.map((l) => `<p style="margin:0 0 8px;font-size:14px;color:#334155">${esc(l)}</p>`).join("")}
    <p style="margin:20px 0 0">
      <a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">${esc(ctaText)}</a>
    </p>
  </div>`;
}
