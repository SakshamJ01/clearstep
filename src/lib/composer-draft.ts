const STORAGE_PREFIX = "clearstep:composer:v1:";

export function composerDraftKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function clearComposerDraft(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(composerDraftKey(userId));
  } catch {
    // Local storage can be unavailable in private or restricted contexts.
  }
}
