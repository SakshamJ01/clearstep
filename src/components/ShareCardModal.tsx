"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  ShareIcon,
  SparkIcon,
} from "@/components/Icons";
import {
  buildShareText,
  canvasToBlob,
  copyCanvasImageToClipboard,
  downloadCanvasImage,
  renderShareCardToCanvas,
  THEMES,
  type ShareCardData,
  type ShareCardTheme,
} from "@/lib/share-card-canvas";

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
}

export function ShareCardModal({ open, onClose, data }: ShareCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ShareCardTheme>("forest");
  const [hideTaskTitles, setHideTaskTitles] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Esc key listener to close modal
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Re-render canvas whenever theme, privacy toggle, or data changes
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    renderShareCardToCanvas(
      canvasRef.current,
      {
        ...data,
        hideTaskTitles,
      },
      selectedTheme,
    );
  }, [open, data, selectedTheme, hideTaskTitles]);

  if (!open) return null;

  async function handleCopyImage() {
    if (!canvasRef.current) return;
    const ok = await copyCanvasImageToClipboard(canvasRef.current);
    if (ok) {
      setCopyFeedback("Image copied to clipboard!");
    } else {
      // Fallback: download if clipboard image API isn't supported in browser
      handleDownload();
      setCopyFeedback("Image downloaded (clipboard permission not granted).");
    }
    setTimeout(() => setCopyFeedback(null), 3000);
  }

  function handleDownload() {
    if (!canvasRef.current) return;
    const cleanTitle = (data.desiredOutcome || data.title || "momentum")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30);
    downloadCanvasImage(canvasRef.current, `clearstep-${cleanTitle}.png`);
  }

  async function handleNativeShare() {
    if (!canvasRef.current || typeof navigator.share === "undefined") return;
    setIsSharing(true);
    try {
      const blob = await canvasToBlob(canvasRef.current);
      const file = new File([blob], "clearstep-plan.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: data.desiredOutcome || data.title,
          text: buildShareText({ ...data, hideTaskTitles }),
          files: [file],
        });
      } else {
        await navigator.share({
          title: data.desiredOutcome || data.title,
          text: buildShareText({ ...data, hideTaskTitles }),
        });
      }
    } catch {
      // User cancelled share dialog or unsupported
    } finally {
      setIsSharing(false);
    }
  }

  function handleCopyText() {
    const text = buildShareText({ ...data, hideTaskTitles });
    navigator.clipboard.writeText(text);
    setCopyFeedback("Text summary copied!");
    setTimeout(() => setCopyFeedback(null), 3000);
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          maxWidth: 680,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: 24,
          boxShadow: "0 20px 48px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--acid-soft)",
                color: "var(--forest)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShareIcon style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h2
                id="share-card-modal-title"
                style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}
              >
                Share Momentum Card
              </h2>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                Celebrate your progress or share with colleagues & friends
              </p>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close share dialog"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Live Canvas Preview */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
            background: "rgba(0,0,0,0.05)",
            padding: 12,
            borderRadius: 12,
          }}
        >
          <canvas
            ref={canvasRef}
            id="share-preview-canvas"
            style={{
              width: "100%",
              maxWidth: 600,
              height: "auto",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              display: "block",
            }}
          />
        </div>

        {/* Customization Options */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            {/* Theme selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Theme:</span>
              {(Object.keys(THEMES) as ShareCardTheme[]).map((themeKey) => (
                <button
                  key={themeKey}
                  type="button"
                  className={`btn btn-sm ${
                    selectedTheme === themeKey ? "btn-primary" : "btn-outline"
                  }`}
                  onClick={() => setSelectedTheme(themeKey)}
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                >
                  {THEMES[themeKey].name}
                </button>
              ))}
            </div>

            {/* Privacy toggle */}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.85rem",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                id="hide-task-titles-toggle"
                checked={hideTaskTitles}
                onChange={(e) => setHideTaskTitles(e.target.checked)}
              />
              <span>Hide step titles (Privacy mode)</span>
            </label>
          </div>
        </div>

        {/* Status / Notice */}
        {copyFeedback && (
          <div
            className="callout callout-info"
            role="status"
            style={{ marginBottom: 16, padding: "8px 12px", fontSize: "0.85rem" }}
          >
            <SparkIcon style={{ width: 16, height: 16 }} />
            <span>{copyFeedback}</span>
          </div>
        )}

        {/* Action Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              id="copy-card-image-btn"
              onClick={handleCopyImage}
            >
              <CheckIcon /> Copy Image to Clipboard
            </button>
            <button
              type="button"
              className="btn btn-outline"
              id="download-card-image-btn"
              onClick={handleDownload}
            >
              <DownloadIcon /> Download PNG
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <button
                type="button"
                className="btn btn-outline"
                id="native-share-btn"
                disabled={isSharing}
                onClick={handleNativeShare}
              >
                <ShareIcon /> Share...
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCopyText}
              title="Copy plain-text summary"
            >
              Copy Text
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
