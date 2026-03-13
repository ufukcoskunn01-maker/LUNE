import type { Metadata } from "next";
import { OriginLoginScreen } from "@/components/auth/OriginLoginScreen";

export const metadata: Metadata = {
  title: "Login | Lune",
  description: "Local rebuild of the Origin login reference screen.",
};

export default function LoginPage() {
  return <OriginLoginScreen />;
}
