import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { EmergencyDeescalateStudio } from "@/components/EmergencyDeescalateStudio";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Emergency Reset & Grounding — Clearstep",
  description:
    "A zero-cost, 60-second physiological breathing and cognitive grounding space for acute panic, stress, and ADHD task paralysis.",
};

export default async function ResetPage() {
  const user = await getCurrentUser();

  return (
    <div
      className="reset-page-wrapper"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
      }}
    >
      <header className="site-header">
        <div className="container public-nav">
          <Brand />
          <div className="row" style={{ gap: 8 }}>
            <Link href="/try" className="btn btn-ghost btn-sm">
              Guest sandbox
            </Link>
            {user ? (
              <Link href="/plans" className="btn btn-outline btn-sm">
                My plans
              </Link>
            ) : (
              <Link href="/signup" className="btn btn-outline btn-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ maxWidth: 640, width: "100%" }}>
          <EmergencyDeescalateStudio />
        </div>
      </main>

      <footer
        className="container app-footer"
        style={{
          borderTop: "1px solid var(--border-soft)",
          paddingTop: 20,
          paddingBottom: 24,
          marginTop: "auto",
          fontSize: "0.85rem",
          color: "var(--muted)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span>100% private in your browser · No logs, no telemetry, zero cost ($0.00).</span>
        <span>
          <Link href="/#how">How Clearstep works</Link>
        </span>
      </footer>
    </div>
  );
}
