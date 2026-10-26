/**
 * Pure Web Audio API synthesized chime.
 * Generates a calm meditation bowl sound with an exponential decay envelope.
 * Completely free ($0.00) with zero external audio assets or network downloads.
 */
export function playGentleBell(volume = 0.25): boolean {
  if (typeof window === "undefined") return false;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Harmonic singing bowl frequencies (fundamental 528Hz + overtone 1056Hz)
    const fundamental = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gainFund = ctx.createGain();
    const gainOver = ctx.createGain();

    fundamental.type = "sine";
    fundamental.frequency.setValueAtTime(528, now); // 528 Hz (calming solfeggio frequency)

    overtone.type = "sine";
    overtone.frequency.setValueAtTime(1056, now); // 1st octave overtone

    // Soft attack & exponential decay
    gainFund.gain.setValueAtTime(0.001, now);
    gainFund.gain.linearRampToValueAtTime(volume, now + 0.05);
    gainFund.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

    gainOver.gain.setValueAtTime(0.001, now);
    gainOver.gain.linearRampToValueAtTime(volume * 0.35, now + 0.03);
    gainOver.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

    fundamental.connect(gainFund);
    overtone.connect(gainOver);

    gainFund.connect(ctx.destination);
    gainOver.connect(ctx.destination);

    fundamental.start(now);
    overtone.start(now);

    fundamental.stop(now + 2.6);
    overtone.stop(now + 2.6);

    // Clean up audio context after playback ends
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 3000);

    return true;
  } catch {
    return false;
  }
}
