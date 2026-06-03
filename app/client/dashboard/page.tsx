import { redirect } from "next/navigation";

export default function LegacyRiderDashboardRedirect() {
  redirect("/rider/dashboard");
}
