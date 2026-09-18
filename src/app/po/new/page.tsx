import AppShell from "@/components/AppShell";
import POForm from "@/components/POForm";
import { requireProfile } from "@/lib/auth";
import { createPO } from "../actions";

export default async function NewPOPage() {
  const profile = await requireProfile();
  return (
    <AppShell profile={profile}>
      <h1 className="text-xl font-semibold mb-6">New purchase order</h1>
      <POForm onSubmit={createPO} />
    </AppShell>
  );
}
