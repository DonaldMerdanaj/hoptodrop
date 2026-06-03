import { redirect } from "next/navigation";

export default function LegacyRiderLoginRedirect() {
  redirect("/rider/login");
}
