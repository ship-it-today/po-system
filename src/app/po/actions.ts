"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import { headers } from "next/headers";
import { CUSTOM_FIELDS, DELIVERY_OPTIONS, DEPARTMENTS, PAYMENT_METHODS, PAYMENT_TIMING } from "@/lib/po-fields";
import { displayName, formatMoney, type LineItem } from "@/lib/types";
import { logActivity } from "@/lib/activity";
import { emailLayout, sendEmail } from "@/lib/notify";

async function siteOrigin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

type Result = { error?: string } | void;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" ? null : Number(v);
};

function parseForm(formData: FormData) {
  const department = str(formData, "department");
  if (!(DEPARTMENTS as readonly string[]).includes(department)) return { error: "Please choose a department." } as const;

  const project_name = optStr(formData, "project_name");

  const payment_timing = str(formData, "payment_timing");
  if (!PAYMENT_TIMING.some((o) => o.value === payment_timing)) return { error: "Please choose when payment is needed." } as const;
  const needed_by = payment_timing === "by_date" ? optStr(formData, "needed_by") : null;
  if (payment_timing === "by_date" && !needed_by) return { error: "Please pick the date payment is needed by." } as const;

  const pay_to = str(formData, "pay_to");
  if (!pay_to) return { error: "Pay to is required." } as const;

  const payment_method = str(formData, "payment_method");
  if (!PAYMENT_METHODS.some((o) => o.value === payment_method)) return { error: "Please choose a payment method." } as const;

  const deliveryRaw = optStr(formData, "delivery");
  if (deliveryRaw && !DELIVERY_OPTIONS.some((o) => o.value === deliveryRaw)) return { error: "Invalid delivery option." } as const;
  const delivery = deliveryRaw;

  const purpose = str(formData, "purpose");
  if (!purpose) return { error: "Purpose / description is required." } as const;

  let items: LineItem[] = [];
  try {
    items = JSON.parse(str(formData, "line_items") || "[]");
  } catch {
    return { error: "Itemized details are malformed." } as const;
  }
  items = items
    .map((i, idx) => ({ description: String(i.description ?? "").trim(), amount: Number(i.amount), position: idx }))
    .filter((i) => i.description);
  if (items.length === 0) return { error: "Add at least one itemized purchase detail." } as const;
  if (items.some((i) => !Number.isFinite(i.amount) || i.amount < 0)) return { error: "Each item needs a valid amount." } as const;

  const other_charges = num(formData, "other_charges") ?? 0;
  if (other_charges < 0) return { error: "Other charges can't be negative." } as const;
  const not_to_exceed = num(formData, "not_to_exceed");
  if (not_to_exceed !== null && not_to_exceed < 0) return { error: "Not-to-exceed can't be negative." } as const;

  const receipt_status = str(formData, "receipt_status") === "uploaded" ? "uploaded" : "will_turn_in";
  const receipt_path = receipt_status === "uploaded" ? optStr(formData, "receipt_path") : null;
  if (receipt_status === "uploaded" && !receipt_path) return { error: "Receipt file is missing." } as const;

  const custom_fields: Record<string, string | number | boolean | null> = {};
  for (const f of CUSTOM_FIELDS) {
    const raw = formData.get(`cf_${f.key}`);
    if (f.type === "checkbox") custom_fields[f.key] = raw === "on";
    else if (f.type === "number") custom_fields[f.key] = raw === null || raw === "" ? null : Number(raw);
    else custom_fields[f.key] = raw === null ? null : String(raw);
    if (f.required && (custom_fields[f.key] === null || custom_fields[f.key] === ""))
      return { error: `${f.label} is required.` } as const;
  }

  return {
    ok: true,
    row: {
      department,
      project_name,
      payment_timing,
      needed_by,
      pay_to,
      vendor_street: optStr(formData, "vendor_street"),
      vendor_city: optStr(formData, "vendor_city"),
      vendor_state: optStr(formData, "vendor_state"),
      vendor_zip: optStr(formData, "vendor_zip"),
      vendor_phone: optStr(formData, "vendor_phone"),
      payment_method,
      delivery,
      purpose,
      not_to_exceed,
      other_charges,
      notes: optStr(formData, "notes"),
      receipt_status,
      receipt_path,
      custom_fields,
    },
    items,
  } as const;
}

export async function createPO(formData: FormData): Promise<Result> {
  const profile = await requireProfile();
  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .insert({ requester_id: profile.id, ...parsed.row })
    .select("id")
    .single();
  if (error || !po) return { error: error?.message ?? "Could not create purchase order." };

  const { error: liErr } = await supabase
    .from("po_line_items")
    .insert(parsed.items.map((i) => ({ ...i, po_id: po.id })));
  if (liErr) return { error: liErr.message };

  await logActivity(supabase, po.id, profile.id, "submitted");

  // Notify approvers (no-op unless RESEND_API_KEY is set).
  const [{ data: full }, { data: approvers }] = await Promise.all([
    supabase.from("purchase_orders").select("po_number, total").eq("id", po.id).single(),
    supabase.from("profiles").select("email").in("role", ["approver", "admin"]).eq("disabled", false),
  ]);
  const origin = await siteOrigin();
  await sendEmail(
    (approvers ?? []).map((a) => a.email).filter((e) => e !== profile.email),
    `New PO-${full?.po_number} from ${displayName(profile)} · ${parsed.row.pay_to} · ${formatMoney(Number(full?.total) || 0)}`,
    emailLayout(
      `PO-${full?.po_number} needs your review`,
      [
        `${displayName(profile)} submitted a purchase order for ${parsed.row.pay_to}.`,
        `Department: ${parsed.row.department}. Total: ${formatMoney(Number(full?.total) || 0)}.`,
        parsed.row.purpose ? `Purpose: ${parsed.row.purpose}` : "",
      ].filter(Boolean),
      `${origin}/po/${po.id}`,
      "Review this PO"
    )
  );

  revalidatePath("/");
  redirect(`/po/${po.id}/submitted`);
}

export async function updatePO(id: string, formData: FormData): Promise<Result> {
  const profile = await requireProfile();
  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("purchase_orders")
    .select("id, requester_id, status")
    .eq("id", id)
    .single();
  if (!existing || existing.requester_id !== profile.id || existing.status !== "pending")
    return { error: "Only your own pending purchase orders can be edited." };

  const { error } = await supabase.from("purchase_orders").update(parsed.row).eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("po_line_items").delete().eq("po_id", id);
  const { error: liErr } = await supabase
    .from("po_line_items")
    .insert(parsed.items.map((i) => ({ ...i, po_id: id })));
  if (liErr) return { error: liErr.message };

  await logActivity(supabase, id, profile.id, "edited");

  revalidatePath("/");
  revalidatePath(`/po/${id}`);
  redirect(`/po/${id}`);
}

export async function deletePO(id: string) {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("purchase_orders").delete().eq("id", id);
  revalidatePath("/");
  redirect("/");
}

export async function decidePO(formData: FormData) {
  const profile = await requireRole(["approver", "admin"]);
  const id = str(formData, "id");
  const decision = str(formData, "decision");
  const notes = str(formData, "notes");

  if (decision !== "approved" && decision !== "denied") return;
  if (decision === "denied" && !notes) {
    redirect(`/po/${id}?error=${encodeURIComponent("Please add a note explaining the denial.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status: decision,
      approver_id: profile.id,
      approver_notes: notes || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) redirect(`/po/${id}?error=${encodeURIComponent(error.message)}`);

  await logActivity(supabase, id, profile.id, decision, notes || null);

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("po_number, pay_to, total, requester:profiles!purchase_orders_requester_id_fkey(email,full_name)")
    .eq("id", id)
    .single();
  const requester = (po?.requester as unknown as { email: string; full_name: string | null } | null) ?? null;
  if (requester) {
    const origin = await siteOrigin();
    await sendEmail(
      [requester.email],
      `PO-${po?.po_number} ${decision} · ${po?.pay_to}`,
      emailLayout(
        `Your PO-${po?.po_number} was ${decision}`,
        [
          `${displayName(profile)} ${decision} your purchase order for ${po?.pay_to} (${formatMoney(Number(po?.total) || 0)}).`,
          notes ? `Note: ${notes}` : "",
        ].filter(Boolean),
        `${origin}/po/${id}`,
        "View PO"
      )
    );
  }

  revalidatePath("/approvals");
  revalidatePath(`/po/${id}`);
  redirect(`/po/${id}`);
}

export async function addComment(formData: FormData) {
  const profile = await requireProfile();
  const id = str(formData, "id");
  const body = str(formData, "body").slice(0, 2000);
  if (!id || !body) return;

  const supabase = await createClient();
  await logActivity(supabase, id, profile.id, "comment", body);

  // Tell the other side: requester ↔ approvers.
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("po_number, pay_to, requester_id, requester:profiles!purchase_orders_requester_id_fkey(email)")
    .eq("id", id)
    .single();
  if (po) {
    const requesterEmail = (po.requester as unknown as { email: string } | null)?.email;
    let to: string[] = [];
    if (po.requester_id === profile.id) {
      const { data: approvers } = await supabase
        .from("profiles")
        .select("email")
        .in("role", ["approver", "admin"])
        .eq("disabled", false);
      to = (approvers ?? []).map((a) => a.email);
    } else if (requesterEmail) {
      to = [requesterEmail];
    }
    const origin = await siteOrigin();
    await sendEmail(
      to.filter((e) => e !== profile.email),
      `Comment on PO-${po.po_number} · ${po.pay_to}`,
      emailLayout(
        `${displayName(profile)} commented on PO-${po.po_number}`,
        [body],
        `${origin}/po/${id}#activity`,
        "Reply"
      )
    );
  }

  revalidatePath(`/po/${id}`);
  redirect(`/po/${id}#activity`);
}
