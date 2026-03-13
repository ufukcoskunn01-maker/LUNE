import type { Metadata } from "next";
import Link from "next/link";

import { Homepage } from "@/components/homepage/Homepage";

export const metadata: Metadata = {
  title:
    "Lune Financial | Allâ€‘inâ€‘One Financial Platform for Budgeting, Investing & AI Planning",
  description:
    "Unite your finances and build wealth with Lune: AI-powered budgeting, spend tracking, investment tools, estate and tax planning, plus advice from CFPÂ® professionalsâ€”all in one intuitive platform.",
};

export default function Home() {
  return (
    <>
      <Homepage />
      <section
        style={{
          padding: "24px",
          background: "#090909",
          color: "#f5f5f5",
        }}
      >
        <div
          style={{
            width: "min(960px, 100%)",
            margin: "0 auto",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link href="/home">Home</Link>
          <Link href="/invest">Invest</Link>
          <Link href="/spending">spending</Link>
          <Link href="/tax">Tax</Link>
        </div>
      </section>
    </>
  );
}
