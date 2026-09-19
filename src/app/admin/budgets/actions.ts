"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { DEPARTMENTS } from "@/lib/po-fields";

export async function saveBudgets(formData: FormData) {
  await requireRole(["admin"]);
  const year = parseInt(String(formData.get("year") ?? ""), 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) redirect("/admin/budgets?error=Invalid+year");

  const rows = DEPARTMENTS.map((d) => {
    const raw = String(formData.get(`b_${d}`) ?? "").replace(/[$,\s]/g, "");
    const amount = raw === "" ? null : Number(raw);
    return { department: d, fiscal_year: year, amount };
  });
  if (rows.some((r) => r.amount !== null && (!Number.isFinite(r.amount) || r.amount < 0)))
    redirect(`/admin/budgets?year=${year}&error=${encodeURIComponent("Amounts must be positive numbers.")}`);

  const supabase = await createClient();
  const upserts = rows.filter((r) => r.amount !== null);
  const clears = rows.filter((r) => r.amount === null).map((r) => r.department);

  if (upserts.length) {
    const { error } = await supabase.from("department_budgets").upsert(upserts, { onConflict: "department,fiscal_year" });
    if (error) redirect(`/admin/budgets?year=${year}&error=${encodeURIComponent(error.message)}`);
  }
  if (clears.length) {
    await supabase.from("department_budgets").delete().eq("fiscal_year", year).in("department", clears);
  }

  revalidatePath("/admin/budgets");
  revalidatePath("/reports");
  redirect(`/admin/budgets?year=${year}&saved=1`);
}
