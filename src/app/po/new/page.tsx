import { redirect } from "next/navigation";

// The PO form now lives on the home page.
export default function NewPOPage() {
  redirect("/");
}
