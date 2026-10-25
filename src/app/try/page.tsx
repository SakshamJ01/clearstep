import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { GuestWorkspace } from "@/components/GuestWorkspace";
import { ArrowRightIcon } from "@/components/Icons";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Instant Guest Plan — Clearstep",
  description:
    "Try Clearstep with zero signup. Dump your thoughts, get a clear first step in milliseconds, and start taking action with zero commitment.",
};

export default async function TryPage() {
  const user = await getCurrentUser();

  return (
    <div className="guest-page-wrapper" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="site-header">
        <div className="container public-nav">
          <Brand />
          <div className="row">
            {user ? (
              <>
                <Link href="/plans" className="btn btn-ghost">
                  My plans
                </Link>
                <Link href="/compose" className="btn btn-primary">
                  Open composer
                  <ArrowRightIcon />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-outline">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" style={{ flex: 1, paddingBottom: 48 }}>
        <GuestWorkspace />
      </main>

      <footer className="container app-footer" style={{ borderTop: "1px solid var(--border)", paddingTop: 24, marginTop: "auto" }}>
        <span>Clearstep Guest Sandbox · 100% private in your browser.</span>
        <span>
          <Link href="/#privacy">Privacy notice</Link>
        </span>
      </footer>
    </div>
  );
}
