export type Role = "requester" | "approver" | "admin";
export type POStatus = "pending" | "approved" | "denied";
export type PaymentTiming = "next_run" | "asap" | "by_date";
export type PaymentMethod = "check_request" | "credit_card" | "on_account";
export type ReceiptStatus = "uploaded" | "will_turn_in";
export type Delivery = "mail" | "mailbox";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  disabled?: boolean;
  created_at: string;
};

export type LineItem = {
  id?: string;
  description: string;
  amount: number;
};

export type PurchaseOrder = {
  id: string;
  po_number: number;
  requester_id: string;
  status: POStatus;

  department: string;
  project_name: string | null;
  payment_timing: PaymentTiming;
  needed_by: string | null;

  pay_to: string;
  vendor_street: string | null;
  vendor_city: string | null;
  vendor_state: string | null;
  vendor_zip: string | null;
  vendor_phone: string | null;

  payment_method: PaymentMethod;
  delivery: Delivery | null;
  purpose: string | null;

  not_to_exceed: number | null;
  items_total: number;
  other_charges: number;
  total: number;

  notes: string | null;
  receipt_status: ReceiptStatus;
  receipt_path: string | null;

  custom_fields: Record<string, string | number | boolean | null>;

  approver_id: string | null;
  approver_notes: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;

  line_items?: LineItem[];
  requester?: Pick<Profile, "id" | "email" | "full_name"> | null;
  approver?: Pick<Profile, "id" | "email" | "full_name"> | null;
};

export const ROLES: Role[] = ["requester", "approver", "admin"];

export function canApprove(role: Role) {
  return role === "approver" || role === "admin";
}

export function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function displayName(p?: Pick<Profile, "email" | "full_name"> | null) {
  if (!p) return "—";
  return p.full_name || p.email;
}

export type ActivityKind = "comment" | "submitted" | "edited" | "approved" | "denied";
export type Activity = {
  id: string;
  po_id: string;
  author_id: string | null;
  kind: ActivityKind;
  body: string | null;
  created_at: string;
  author?: Pick<Profile, "id" | "email" | "full_name"> | null;
};

export type DepartmentBudget = { department: string; fiscal_year: number; amount: number };
