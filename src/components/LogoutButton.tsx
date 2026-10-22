"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOutIcon } from "@/components/Icons";
import { clearComposerDraft } from "@/lib/composer-draft";

export function LogoutButton({
  compact = false,
  userId,
}: {
  compact?: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearComposerDraft(userId);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className={compact ? "btn btn-ghost btn-sm" : "btn btn-ghost"}
      onClick={logout}
      disabled={pending}
      aria-label="Sign out"
    >
      <LogOutIcon />
      <span className="logout-label">{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
