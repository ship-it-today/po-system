"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CUSTOM_FIELDS,
  DEPARTMENTS,
  PAYMENT_METHODS,
  PAYMENT_TIMING,
  DELIVERY_OPTIONS,
  US_STATES,
  type FieldDef,
} from "@/lib/po-fields";
import type { LineItem, PaymentTiming, PurchaseOrder, ReceiptStatus } from "@/lib/types";
import { formatMoney } from "@/lib/types";

type Props = {
  initial?: PurchaseOrder;
  onSubmit: (formData: FormData) => Promise<{ error?: string } | void>;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): LineItem => ({ description: "", amount: 0 });
const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default function POForm({ initial, onSubmit }: Props) {
  const [items, setItems] = useState<LineItem[]>(
    initial?.line_items?.length ? initial.line_items : [emptyItem()]
  );
  const [timing, setTiming] = useState<PaymentTiming>(initial?.payment_timing ?? "next_run");
  const [receiptStatus, setReceiptStatus] = useState<ReceiptStatus>(initial?.receipt_status ?? "will_turn_in");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [otherCharges, setOtherCharges] = useState<number>(initial?.other_charges ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const itemsTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const grandTotal = itemsTotal + (Number(otherCharges) || 0);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("line_items", JSON.stringify(items));
    formData.set("receipt_status", receiptStatus);
    if (initial?.receipt_path) formData.set("receipt_path", initial.receipt_path);

    startTransition(async () => {
      // Upload receipt straight from the browser to Supabase Storage.
      if (receiptStatus === "uploaded" && receiptFile) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return setError("You're signed out. Please sign in again.");
        const safeName = receiptFile.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("receipts")
          .upload(path, receiptFile, { upsert: false });
        if (upErr) return setError(`Receipt upload failed: ${upErr.message}`);
        formData.set("receipt_path", path);
      } else if (receiptStatus === "uploaded" && !initial?.receipt_path) {
        return setError("Choose a receipt file, or select “I will turn in the receipt”.");
      }

      const res = await onSubmit(formData);
      if (res?.error) setError(res.error);
    });
  }

  const cf = initial?.custom_fields ?? {};

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}

      {/* 1–3 */}
      <Section title="Request">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Department" required>
            <select name="department" required defaultValue={initial?.department ?? ""} className={inputCls}>
              <option value="">Select…</option>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Project name">
            <input name="project_name" defaultValue={initial?.project_name ?? ""} className={inputCls} />
          </Field>
          <Field label="Payment needed" required>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5 text-sm">
              {PAYMENT_TIMING.map((o) => (
                <label key={o.value} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="payment_timing"
                    value={o.value}
                    checked={timing === o.value}
                    onChange={() => setTiming(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Need by date" required={timing === "by_date"}>
            <input
              name="needed_by"
              type="date"
              required={timing === "by_date"}
              disabled={timing !== "by_date"}
              defaultValue={initial?.needed_by ?? todayISO()}
              className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
            />
          </Field>
        </div>
      </Section>

      {/* 4–7 */}
      <Section title="Pay to">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          <div className="sm:col-span-4">
            <Field label="Pay to" required>
              <input name="pay_to" required defaultValue={initial?.pay_to} className={inputCls} placeholder="Payee / vendor name" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Vendor phone">
              <input name="vendor_phone" type="tel" defaultValue={initial?.vendor_phone ?? ""} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-6">
            <Field label="Street address">
              <input name="vendor_street" defaultValue={initial?.vendor_street ?? ""} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="City">
              <input name="vendor_city" defaultValue={initial?.vendor_city ?? ""} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-1">
            <Field label="State">
              <select name="vendor_state" defaultValue={initial?.vendor_state ?? ""} className={inputCls}>
                <option value=""></option>
                {US_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="ZIP">
              <input name="vendor_zip" inputMode="numeric" defaultValue={initial?.vendor_zip ?? ""} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-6">
            <Field label="Payment method" required>
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5 text-sm">
                {PAYMENT_METHODS.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="payment_method"
                      value={o.value}
                      required
                      defaultChecked={initial?.payment_method === o.value}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-6">
            <Field label="Delivery">
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5 text-sm">
                {DELIVERY_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="delivery"
                      value={o.value}
                      defaultChecked={initial?.delivery === o.value}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </Section>

      {/* 8–10 */}
      <Section title="Purchase details">
        <Field label="Purpose / description" required>
          <textarea name="purpose" rows={3} required defaultValue={initial?.purpose ?? ""} className={inputCls} />
        </Field>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">Itemized purchase details</span>
            <button
              type="button"
              onClick={() => setItems((p) => [...p, emptyItem()])}
              className="text-sm text-slate-700 hover:text-slate-900 underline"
            >
              + Add item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className={`${inputCls} col-span-8 sm:col-span-9`}
                  placeholder="Item"
                  value={it.description}
                  required
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                />
                <div className="col-span-3 sm:col-span-2 relative">
                  <span className="absolute left-2.5 top-2 text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${inputCls} pl-6 text-right`}
                    value={it.amount}
                    onChange={(e) => updateItem(idx, { amount: Number(e.target.value) })}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove item"
                  disabled={items.length === 1}
                  onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  className="col-span-1 text-slate-400 hover:text-red-600 disabled:opacity-30 text-center text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <Field label="Payment amount / not to exceed" help="Leave blank to use the total">
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-sm text-slate-400">$</span>
              <input
                name="not_to_exceed"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initial?.not_to_exceed ?? ""}
                placeholder={grandTotal.toFixed(2)}
                className={`${inputCls} pl-6 text-right`}
              />
            </div>
          </Field>
          <Field label="Other charges" help="Shipping, tax, fees">
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-sm text-slate-400">$</span>
              <input
                name="other_charges"
                type="number"
                min="0"
                step="0.01"
                value={otherCharges}
                onChange={(e) => setOtherCharges(Number(e.target.value))}
                className={`${inputCls} pl-6 text-right`}
              />
            </div>
          </Field>
          <div className="sm:text-right sm:pt-5">
            <div className="text-xs text-slate-500">Items {formatMoney(itemsTotal)} + other {formatMoney(Number(otherCharges) || 0)}</div>
            <div className="text-lg font-semibold tabular-nums">{formatMoney(grandTotal)}</div>
          </div>
        </div>
      </Section>

      {/* 11–12 */}
      <Section title="Notes & receipt">
        <Field label="Notes / instructions">
          <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} className={inputCls} />
        </Field>
        <div className="mt-4">
          <span className="block text-xs font-medium text-slate-600 mb-1">Receipt</span>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="receipt_choice"
                checked={receiptStatus === "uploaded"}
                onChange={() => setReceiptStatus("uploaded")}
              />
              Upload a receipt
            </label>
            {receiptStatus === "uploaded" && (
              <div className="ml-5">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
                />
                {initial?.receipt_path && !receiptFile && (
                  <p className="text-xs text-slate-500 mt-1">A receipt is already attached; choose a file to replace it.</p>
                )}
              </div>
            )}
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="receipt_choice"
                checked={receiptStatus === "will_turn_in"}
                onChange={() => setReceiptStatus("will_turn_in")}
              />
              I will turn in the receipt
            </label>
          </div>
        </div>

        {CUSTOM_FIELDS.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {CUSTOM_FIELDS.map((f) => (
              <CustomField key={f.key} def={f} value={cf[f.key]} />
            ))}
          </div>
        )}
      </Section>

      <div className="flex justify-end gap-3">
        <a href={initial ? `/po/${initial.id}` : "/"} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : initial ? "Save changes" : "Submit for approval"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {help && <span className="block text-xs text-slate-400 mt-1">{help}</span>}
    </label>
  );
}

function CustomField({ def, value }: { def: FieldDef; value: unknown }) {
  const name = `cf_${def.key}`;
  const v = value == null ? "" : String(value);
  if (def.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:pt-6">
        <input type="checkbox" name={name} defaultChecked={value === true} className="h-4 w-4" />
        {def.label}
      </label>
    );
  }
  return (
    <div className={def.type === "textarea" ? "sm:col-span-2" : undefined}>
      <Field label={def.label} required={def.required} help={def.help}>
        {def.type === "select" ? (
          <select name={name} required={def.required} defaultValue={v} className={inputCls}>
            <option value="">Select…</option>
            {def.options?.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : def.type === "textarea" ? (
          <textarea name={name} rows={2} required={def.required} defaultValue={v} placeholder={def.placeholder} className={inputCls} />
        ) : (
          <input name={name} type={def.type} required={def.required} defaultValue={v} placeholder={def.placeholder} step={def.type === "number" ? "any" : undefined} className={inputCls} />
        )}
      </Field>
    </div>
  );
}
