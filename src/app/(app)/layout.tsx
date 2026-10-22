import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/auth";
import { runMaintenance } from "@/lib/drafts";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  runMaintenance();

  return (
    <div className="app-frame">
      <AppNav user={user} />
      <main className="container app-main" id="main">
        {children}
      </main>
      <footer className="container app-footer">
        <span>Clearstep pilot · plans are drafts, not professional advice.</span>
        <span>
          <Link href="/#privacy">How your data works</Link>
        </span>
      </footer>
    </div>
  );
}
