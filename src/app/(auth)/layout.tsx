import { Brand } from "@/components/Brand";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Brand />
        <div className="auth-quote">
          <div className="mono">BRAIN DUMP → PLAN</div>
          <h1>
            Put it down.
            <br />
            Then pick up <em>one step.</em>
          </h1>
          <p>
            A quiet planning tool for the moment when everything feels equally
            urgent. Your words stay yours, and nothing becomes a task until you
            say so.
          </p>
        </div>
        <div className="auth-art-footer">
          <span>No streaks</span>
          <span>No automated action</span>
          <span>Manual mode always available</span>
        </div>
      </aside>
      <main className="auth-main">{children}</main>
    </div>
  );
}
