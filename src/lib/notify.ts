/**
 * Email notifications. Two ways to send, checked in this order:
 *   1. SMTP  — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (works with Brevo, Gmail, Outlook, etc.)
 *   2. Resend — set RESEND_API_KEY
 * EMAIL_FROM is the sender for both, e.g. "Purchase Orders <office@yourchurch.org>".
 * If neither is configured, sendEmail() is a no-op. Never throws — a failed email must not break the user's action.
 */
import nodemailer from "nodemailer";

export function notificationsEnabled() {
  return Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string[], subject: string, html: string) {
  const recipients = to.filter(Boolean);
  if (recipients.length === 0) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "Purchase Orders <onboarding@resend.dev>";

  try {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transport.sendMail({ from, to: recipients, subject, html });
      return;
    }
    if (process.env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: recipients, subject, html }),
      });
    }
  } catch (e) {
    console.error("email failed", e);
  }
}

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
