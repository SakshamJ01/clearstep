/**
 * Web Audio API synthesized focus soundscapes.
 * 100% generated client-side with zero external assets, $0 cost, and zero network latency.
 *
 * Provides soothing acoustic shielding:
 * - Brown Noise: Deep low-frequency mask for executive overwhelm & ADHD chatter
 * - Gentle Rain: Soft, textured pink-filtered drizzle
 * - Ocean Waves: Cyclical swell and ebb mimicking rhythmic breath
 * - 432Hz Drone: Dual harmonic sine tones creating a 10Hz alpha entrainment beat
 */

export type SoundscapeType = "off" | "brown" | "rain" | "waves" | "alpha";

export interface SoundscapeOption {
  id: SoundscapeType;
  label: string;
  shortLabel: string;
  description: string;
  emoji: string;
}

export const SOUNDSCAPE_OPTIONS: readonly SoundscapeOption[] = [
  {
    id: "off",
    label: "Off (Silence)",
    shortLabel: "Off",
    description: "No ambient soundscape",
    emoji: "🔇",
  },
  {
    id: "brown",
    label: "Brown Noise",
    shortLabel: "Brown",
    description: "Deep, velvety low rumble that blocks thoughts and background distractions",
    emoji: "🤎",
  },
  {
    id: "rain",
    label: "Gentle Rain",
    shortLabel: "Rain",
    description: "Soft textured rainfall that promotes calm, steady breathing",
    emoji: "🌧️",
  },
  {
    id: "waves",
    label: "Ocean Waves",
    shortLabel: "Waves",
    description: "Rhythmic oceanic swell that anchors deep focus",
    emoji: "🌊",
  },
  {
    id: "alpha",
    label: "432Hz Drone",
    shortLabel: "432Hz",
    description: "Harmonic 432Hz + 442Hz tones creating a 10Hz alpha flow-state beat",
    emoji: "✨",
  },
] as const;

export const FADE_DURATION_SECONDS = 0.4;
export const DEFAULT_SOUNDSCAPE_VOLUME = 0.35;

// Pure buffer synthesis utilities for testing and runtime
export function generateBrownNoiseData(length: number): Float32Array {
  const data = new Float32Array(length);
  let lastOut = 0.0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = Math.max(-1, Math.min(1, lastOut * 3.2));
  }
  return data;
}

export function generatePinkNoiseData(length: number): Float32Array {
  const data = new Float32Array(length);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11));
    b6 = white * 0.115926;
  }
  return data;
}

interface ActiveGraph {
  type: SoundscapeType;
  sources: (AudioBufferSourceNode | OscillatorNode)[];
  filters: BiquadFilterNode[];
  gainNodes: GainNode[];
  masterGain: GainNode;
  stopTimeout?: ReturnType<typeof setTimeout>;
}

export class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private activeGraph: ActiveGraph | null = null;
  private currentVolume = DEFAULT_SOUNDSCAPE_VOLUME;
  private isPaused = false;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public getActiveType(): SoundscapeType {
    if (!this.activeGraph) return "off";
    return this.activeGraph.type;
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;

    if (this.activeGraph && !this.isPaused && this.ctx) {
      const now = this.ctx.currentTime;
      this.activeGraph.masterGain.gain.setValueAtTime(this.activeGraph.masterGain.gain.value, now);
      this.activeGraph.masterGain.gain.linearRampToValueAtTime(clamped, now + 0.1);
    }
  }

  public play(type: SoundscapeType, volume = this.currentVolume): void {
    if (type === "off") {
      this.stop();
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.isPaused = false;

    // If already playing the requested type, ensure unpaused
    if (this.activeGraph && this.activeGraph.type === type) {
      this.resume();
      return;
    }

    // Stop existing graph smoothly
    this.stopImmediate();

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(this.currentVolume, now + FADE_DURATION_SECONDS);
      masterGain.connect(ctx.destination);

      const sources: (AudioBufferSourceNode | OscillatorNode)[] = [];
      const filters: BiquadFilterNode[] = [];
      const gainNodes: GainNode[] = [masterGain];

      if (type === "brown") {
        const buffer = ctx.createBuffer(2, ctx.sampleRate * 6, ctx.sampleRate);
        buffer.getChannelData(0).set(generateBrownNoiseData(buffer.length));
        buffer.getChannelData(1).set(generateBrownNoiseData(buffer.length));

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(420, now);
        filter.Q.setValueAtTime(0.8, now);

        source.connect(filter);
        filter.connect(masterGain);
        source.start(now);

        sources.push(source);
        filters.push(filter);
      } else if (type === "rain") {
        const buffer = ctx.createBuffer(2, ctx.sampleRate * 6, ctx.sampleRate);
        buffer.getChannelData(0).set(generatePinkNoiseData(buffer.length));
        buffer.getChannelData(1).set(generatePinkNoiseData(buffer.length));

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(2400, now);

        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.setValueAtTime(250, now);

        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(masterGain);
        source.start(now);

        sources.push(source);
        filters.push(lowpass, highpass);
      } else if (type === "waves") {
        const buffer = ctx.createBuffer(2, ctx.sampleRate * 8, ctx.sampleRate);
        buffer.getChannelData(0).set(generateBrownNoiseData(buffer.length));
        buffer.getChannelData(1).set(generateBrownNoiseData(buffer.length));

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(550, now);

        // Slow wave swell modulator via LFO
        const waveGain = ctx.createGain();
        waveGain.gain.setValueAtTime(0.4, now);

        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.08, now); // 12.5s cycle

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.35, now);

        lfo.connect(lfoGain);
        lfoGain.connect(waveGain.gain);

        source.connect(filter);
        filter.connect(waveGain);
        waveGain.connect(masterGain);

        source.start(now);
        lfo.start(now);

        sources.push(source, lfo);
        filters.push(filter);
        gainNodes.push(waveGain, lfoGain);
      } else if (type === "alpha") {
        // Dual sine oscillators: 432Hz + 442Hz -> 10Hz Alpha beat
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(432, now);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(442, now);

        const oscGain1 = ctx.createGain();
        oscGain1.gain.setValueAtTime(0.45, now);
        const oscGain2 = ctx.createGain();
        oscGain2.gain.setValueAtTime(0.45, now);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(750, now);

        osc1.connect(oscGain1);
        osc2.connect(oscGain2);
        oscGain1.connect(filter);
        oscGain2.connect(filter);
        filter.connect(masterGain);

        osc1.start(now);
        osc2.start(now);

        sources.push(osc1, osc2);
        filters.push(filter);
        gainNodes.push(oscGain1, oscGain2);
      }

      this.activeGraph = {
        type,
        sources,
        filters,
        gainNodes,
        masterGain,
      };
    } catch {
      // Audio error or unsupported environment
    }
  }

  public pause(): void {
    if (!this.activeGraph || this.isPaused || !this.ctx) return;
    this.isPaused = true;
    const now = this.ctx.currentTime;
    this.activeGraph.masterGain.gain.setValueAtTime(this.activeGraph.masterGain.gain.value, now);
    this.activeGraph.masterGain.gain.linearRampToValueAtTime(0.0001, now + FADE_DURATION_SECONDS);
  }

  public resume(): void {
    if (!this.activeGraph || !this.isPaused || !this.ctx) return;
    this.isPaused = false;
    const now = this.ctx.currentTime;
    this.activeGraph.masterGain.gain.setValueAtTime(this.activeGraph.masterGain.gain.value, now);
    this.activeGraph.masterGain.gain.linearRampToValueAtTime(
      this.currentVolume,
      now + FADE_DURATION_SECONDS
    );
  }

  public stop(): void {
    if (!this.activeGraph) return;

    if (this.ctx) {
      const now = this.ctx.currentTime;
      const graph = this.activeGraph;
      this.activeGraph = null;
      this.isPaused = false;

      try {
        graph.masterGain.gain.setValueAtTime(graph.masterGain.gain.value, now);
        graph.masterGain.gain.linearRampToValueAtTime(0.0001, now + FADE_DURATION_SECONDS);
      } catch {
        // ignore
      }

      setTimeout(() => {
        try {
          graph.sources.forEach((s) => {
            try {
              s.stop();
              s.disconnect();
            } catch {
              // ignore
            }
          });
          graph.filters.forEach((f) => {
            try {
              f.disconnect();
            } catch {
              // ignore
            }
          });
          graph.gainNodes.forEach((g) => {
            try {
              g.disconnect();
            } catch {
              // ignore
            }
          });
        } catch {
          // ignore
        }
      }, (FADE_DURATION_SECONDS + 0.1) * 1000);
    } else {
      this.stopImmediate();
    }
  }

  private stopImmediate(): void {
    if (!this.activeGraph) return;
    const graph = this.activeGraph;
    this.activeGraph = null;
    this.isPaused = false;

    graph.sources.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch {
        // ignore
      }
    });
    graph.filters.forEach((f) => {
      try {
        f.disconnect();
      } catch {
        // ignore
      }
    });
    graph.gainNodes.forEach((g) => {
      try {
        g.disconnect();
      } catch {
        // ignore
      }
    });
  }
}

// Global shared singleton so soundscape state persists seamlessly during a session
let sharedSoundscapeEngine: SoundscapeEngine | null = null;

export function getSoundscapeEngine(): SoundscapeEngine {
  if (!sharedSoundscapeEngine) {
    sharedSoundscapeEngine = new SoundscapeEngine();
  }
  return sharedSoundscapeEngine;
}
