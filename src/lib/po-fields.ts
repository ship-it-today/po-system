/**
 * PURCHASE ORDER FORM OPTIONS
 * ---------------------------
 * Dropdown choices live here so they can be changed without touching the
 * database. The form fields themselves are defined in src/components/POForm.tsx
 * and stored as real columns (see supabase/schema.sql).
 */

/** Shown at the top of printed purchase orders. */
export const ORG_NAME = "Calvary Vista";

export const DEPARTMENTS = [
  "Church",
  "Coffee House",
  "D&A Ministry",
  "Family Ministry",
  "Facilities",
  "High School Min",
  "Jr High Ministry",
  "Kid's Ministry",
  "Local Outreach",
  "Media/Tech",
  "Men's Ministry",
  "Missions",
  "Spanish Ministry",
  "Women's Ministry",
  "Worship Ministry",
  "AHG",
  "Trail Life",
  "Other",
] as const;

export const PAYMENT_TIMING = [
  { value: "next_run", label: "Next check run" },
  { value: "asap", label: "ASAP" },
  { value: "by_date", label: "Need by date" },
] as const;

export const PAYMENT_METHODS = [
  { value: "check_request", label: "Check request" },
  { value: "credit_card", label: "Church credit card" },
  { value: "on_account", label: "On account" },
] as const;

export const RECEIPT_STATUS = [
  { value: "uploaded", label: "Receipt attached" },
  { value: "will_turn_in", label: "I will turn in the receipt" },
] as const;

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

/**
 * OPTIONAL EXTRA FIELDS
 * Add entries here to put more questions on the form with no DB migration;
 * answers are stored in the `custom_fields` JSON column.
 */
export type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
};
export const CUSTOM_FIELDS: FieldDef[] = [];

export function labelFor<T extends readonly { value: string; label: string }[]>(
  list: T,
  value: string | null | undefined
) {
  return list.find((o) => o.value === value)?.label ?? value ?? "—";
}
