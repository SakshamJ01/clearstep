"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { ArrowRightIcon, WarningIcon } from "@/components/Icons";

interface AuthFormProps {
  mode: "login" | "signup";
}

interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (isSignup && password !== confirm) {
      setFieldErrors({ confirm: "The passwords do not match." });
      return;
    }

    setPending(true);
    try {
      const response = await fetch(
        isSignup ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      if (!response.ok) {
        setError(data.error?.message || "That did not work. Try again.");
        setFieldErrors(data.error?.fields ?? {});
        return;
      }
      router.push("/compose");
      router.refresh();
    } catch {
      setError(
        "The connection failed. Check your network, then try again. Your email is still here.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="eyebrow">{isSignup ? "Start a pilot account" : "Welcome back"}</div>
      <h2>{isSignup ? "Give the noise somewhere to go." : "Pick up where you left off."}</h2>
      <p>
        {isSignup
          ? "Create an account to save plans, edit drafts, and track the one step you chose to start with."
          : "Sign in to open your plans or start a new dump. Nothing has been sent anywhere."}
      </p>

      {error ? (
        <div className="callout callout-danger" role="alert" style={{ marginBottom: 16 }}>
          <WarningIcon />
          <div>{error}</div>
        </div>
      ) : null}

      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor={emailId}>
            Email
          </label>
          <input
            id={emailId}
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
            required
          />
          {fieldErrors.email ? (
            <p className="field-error" id={`${emailId}-error`}>
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={passwordId}>
            Password
            {isSignup ? <span className="optional">10 characters minimum</span> : null}
          </label>
          <input
            id={passwordId}
            className="input"
            type="password"
            name="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={isSignup ? 10 : undefined}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
            required
          />
          {fieldErrors.password ? (
            <p className="field-error" id={`${passwordId}-error`}>
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        {isSignup ? (
          <div className="field">
            <label className="field-label" htmlFor={confirmId}>
              Confirm password
            </label>
            <input
              id={confirmId}
              className="input"
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={Boolean(fieldErrors.confirm)}
              aria-describedby={fieldErrors.confirm ? `${confirmId}-error` : undefined}
              required
            />
            {fieldErrors.confirm ? (
              <p className="field-error" id={`${confirmId}-error`}>
                {fieldErrors.confirm}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={pending}
        >
          {pending
            ? isSignup
              ? "Creating account…"
              : "Signing in…"
            : isSignup
              ? "Create account"
              : "Sign in"}
          {!pending ? <ArrowRightIcon /> : null}
        </button>
      </form>

      <p className="auth-switch">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-link">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-link">
              Create a pilot account
            </Link>
          </>
        )}
      </p>

      <Link href="/" className="auth-home-link">
        ← Back to how Clearstep works
      </Link>
    </div>
  );
}
