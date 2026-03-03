import { redirect } from "next/navigation";

export default function LegacyAppRootPage() {
  redirect("/dashboard");
}
