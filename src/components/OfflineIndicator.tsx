"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [showRestored, setShowRestored] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      setShowRestored(true);
      const timer = window.setTimeout(() => {
        setShowRestored(false);
        wasOfflineRef.current = false;
      }, 3500);
      return () => window.clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline && !showRestored) {
    return null;
  }

  if (showRestored) {
    return (
      <aside
        className="offline-banner-restored"
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 20,
          left: 20,
          zIndex: 850,
          background: "var(--forest)",
          color: "var(--paper-bright)",
          border: "1px solid var(--accent)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          borderRadius: 24,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.82rem",
          fontWeight: 600,
          animation: "fadeIn 0.2s ease-in-out",
        }}
      >
        <span style={{ color: "var(--acid)" }}>✓</span>
        <span>Back online · Reconnected</span>
      </aside>
    );
  }

  return (
    <aside
      className="offline-banner-active"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 850,
        background: "var(--surface)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        borderRadius: 24,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: "0.82rem",
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--warning, #e07a5f)",
          display: "inline-block",
        }}
      />
      <span>Offline mode · Local timer, audio & drafts active</span>
    </aside>
  );
}
