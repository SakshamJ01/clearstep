"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRightIcon, RotateIcon } from "@/components/Icons";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unexpected application error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="container centered-page" id="main">
      <div>
        <div className="big-number">Something broke</div>
        <h1>That was not supposed to happen.</h1>
        <p>
          The page failed to render. Your saved plans are stored separately. Try
          the page again, or go back to familiar ground.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            <RotateIcon />
            Try again
          </button>
          <Link href="/plans" className="btn btn-outline">
            My plans
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </main>
  );
}
