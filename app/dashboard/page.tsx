import { redirect } from "next/navigation";

export default function DashboardRedirectPage() {
  // fix: keep old customer dashboard links working while the real route lives at /client/dashboard.
  redirect("/client/dashboard");
}
