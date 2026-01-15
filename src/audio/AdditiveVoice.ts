import type { Harmonic } from "@/types";
import { getAudioContext, getMasterGain } from "./audioContext";
import { MAX_AMPLITUDE, MAX_HARMONICS } from "@/lib/constants";

const ATTACK_TIME = 0.01; // 10ms

/**
 * Single oscillator info for detuned partials
 */
interface DetunedOscillator {
  osc: OscillatorNode;
  gain: GainNode;
  harmonicIndex: number;
}

/**
 * AdditiveVoice uses a hybrid approach for phase-aware synthesis:
 * 
 * 1. Primary oscillator: Single oscillator with a PeriodicWave that encodes
 *    all harmonics with tuning === 0 (includes amplitude + phase).
 * 
 * 2. Detuned oscillators: Each harmonic with tuning !== 0 gets its own
 *    oscillator with a single-harmonic PeriodicWave (preserves phase + tuning).
 */
export class AdditiveVoice {
  // Primary oscillator for all non-tuned harmonics
  private primaryOsc: OscillatorNode | null = null;
  private primaryGain: GainNode | null = null;
  
  // Detuned partials get their own oscillators
  private detunedOscs: DetunedOscillator[] = [];
  
  private voiceGain: GainNode;
  private baseFrequency = 440;
  private isPlaying = false;
  private harmonics: Harmonic[] = [];
  private harmonicCount = MAX_HARMONICS;
  private oscillatorsCreated = false;

  constructor() {
    const ctx = getAudioContext();
    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 0;
    this.voiceGain.connect(getMasterGain());
  }

  /**
   * Build a PeriodicWave for harmonics with tuning === 0.
   * Phase is encoded via real/imag Fourier coefficients.
   */
  private buildPrimaryPeriodicWave(): PeriodicWave {
    const ctx = getAudioContext();
    const size = this.harmonicCount + 1;
    const real = new Float32Array(size);
    const imag = new Float32Array(size);

    // DC offset (index 0) is always 0
    real[0] = 0;
    imag[0] = 0;

    for (let i = 0; i < Math.min(this.harmonicCount, this.harmonics.length); i++) {
      const h = this.harmonics[i];
      
      // Skip muted harmonics and detuned harmonics (they use separate oscillators)
      if (h.mute || h.tuning !== 0) continue;

      const harmonicIndex = i + 1;
      const normalizedAmp = h.amplitude / MAX_AMPLITUDE;
      const phaseRad = (h.phase * Math.PI) / 180;

      // sin(x + φ) = sin(x)cos(φ) + cos(x)sin(φ)
      // PeriodicWave: real = cos coefficient, imag = sin coefficient
      // For A * sin(n*ω*t + φ): real[n] = A * sin(φ), imag[n] = A * cos(φ)
      real[harmonicIndex] = normalizedAmp * Math.sin(phaseRad);
      imag[harmonicIndex] = normalizedAmp * Math.cos(phaseRad);
    }

    return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  }

  /**
   * Build a single-harmonic PeriodicWave for a detuned partial.
   */
  private buildSingleHarmonicWave(harmonic: Harmonic): PeriodicWave {
    const ctx = getAudioContext();
    // Only need 2 coefficients: DC (0) and the fundamental (1)
    const real = new Float32Array(2);
    const imag = new Float32Array(2);

    real[0] = 0;
    imag[0] = 0;

    const normalizedAmp = harmonic.amplitude / MAX_AMPLITUDE;
    const phaseRad = (harmonic.phase * Math.PI) / 180;

    // Place the harmonic at index 1 (fundamental of this oscillator)
    // The oscillator frequency will be set to harmonicNumber * baseFreq * tuning
    real[1] = normalizedAmp * Math.sin(phaseRad);
    imag[1] = normalizedAmp * Math.cos(phaseRad);

    return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  }

  /**
   * Rebuild oscillators based on current harmonics state.
   * Called when harmonics change or when starting.
   */
  private rebuildOscillators(): void {
    const ctx = getAudioContext();

    // Clean up existing oscillators
    this.cleanupOscillators();

    // Create primary oscillator for non-tuned harmonics
    const primaryWave = this.buildPrimaryPeriodicWave();
    this.primaryOsc = ctx.createOscillator();
    this.primaryGain = ctx.createGain();
    
    this.primaryOsc.setPeriodicWave(primaryWave);
    this.primaryOsc.frequency.value = this.baseFrequency;
    this.primaryGain.gain.value = 1;
    
    this.primaryOsc.connect(this.primaryGain);
    this.primaryGain.connect(this.voiceGain);
    this.primaryOsc.start();

    // Create separate oscillators for detuned harmonics
    for (let i = 0; i < Math.min(this.harmonicCount, this.harmonics.length); i++) {
      const h = this.harmonics[i];
      
      if (h.mute || h.tuning === 0) continue;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const singleWave = this.buildSingleHarmonicWave(h);
      osc.setPeriodicWave(singleWave);
      
      // Frequency = harmonicNumber * baseFreq * tuningMultiplier
      const harmonicNumber = i + 1;
      const tuningMultiplier = Math.pow(2, h.tuning / 1200);
      osc.frequency.value = this.baseFrequency * harmonicNumber * tuningMultiplier;
      gain.gain.value = 1;
      
      osc.connect(gain);
      gain.connect(this.voiceGain);
      osc.start();
      
      this.detunedOscs.push({ osc, gain, harmonicIndex: i });
    }

    this.oscillatorsCreated = true;
  }

  /**
   * Update oscillators in real-time without full rebuild.
   * Updates PeriodicWave for phase/amplitude changes, frequencies for tuning.
   */
  private updateOscillators(): void {
    if (!this.oscillatorsCreated) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Update primary oscillator with new wave
    if (this.primaryOsc) {
      const primaryWave = this.buildPrimaryPeriodicWave();
      this.primaryOsc.setPeriodicWave(primaryWave);
      this.primaryOsc.frequency.setTargetAtTime(this.baseFrequency, now, 0.01);
    }

    // Check if detuned harmonics changed - if so, need full rebuild
    const currentDetunedIndices = new Set(this.detunedOscs.map(d => d.harmonicIndex));
    const newDetunedIndices = new Set<number>();
    
    for (let i = 0; i < Math.min(this.harmonicCount, this.harmonics.length); i++) {
      const h = this.harmonics[i];
      if (!h.mute && h.tuning !== 0) {
        newDetunedIndices.add(i);
      }
    }

    // Check if sets are different
    const setsEqual = currentDetunedIndices.size === newDetunedIndices.size &&
      [...currentDetunedIndices].every(i => newDetunedIndices.has(i));

    if (!setsEqual) {
      // Detuned set changed, need full rebuild
      this.rebuildOscillators();
      return;
    }

    // Update existing detuned oscillators
    for (const detuned of this.detunedOscs) {
      const h = this.harmonics[detuned.harmonicIndex];
      if (!h) continue;

      const singleWave = this.buildSingleHarmonicWave(h);
      detuned.osc.setPeriodicWave(singleWave);
      
      const harmonicNumber = detuned.harmonicIndex + 1;
      const tuningMultiplier = Math.pow(2, h.tuning / 1200);
      const freq = this.baseFrequency * harmonicNumber * tuningMultiplier;
      detuned.osc.frequency.setTargetAtTime(freq, now, 0.01);
    }
  }

  private cleanupOscillators(): void {
    // Stop and disconnect primary oscillator
    if (this.primaryOsc) {
      try {
        this.primaryOsc.stop();
        this.primaryOsc.disconnect();
      } catch {
        // Ignore errors if already stopped
      }
      this.primaryOsc = null;
    }
    if (this.primaryGain) {
      this.primaryGain.disconnect();
      this.primaryGain = null;
    }

    // Stop and disconnect detuned oscillators
    for (const detuned of this.detunedOscs) {
      try {
        detuned.osc.stop();
        detuned.osc.disconnect();
      } catch {
        // Ignore errors
      }
      detuned.gain.disconnect();
    }
    this.detunedOscs = [];
    this.oscillatorsCreated = false;
  }

  /**
   * Start playing with attack envelope
   */
  start(frequency: number): void {
    this.baseFrequency = frequency;
    
    // Only build oscillators once, reuse them for rapid retriggering
    if (!this.oscillatorsCreated) {
      this.rebuildOscillators();
    } else {
      // Just update frequency on existing oscillators
      this.updateOscillators();
    }
    
    this.isPlaying = true;

    // Retrigger attack envelope
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    this.voiceGain.gain.cancelScheduledValues(now);
    this.voiceGain.gain.setValueAtTime(0, now);
    this.voiceGain.gain.exponentialRampToValueAtTime(1, now + ATTACK_TIME);
  }

  /**
   * Stop playing immediately (no release envelope for fast retriggering)
   */
  stop(): void {
    if (!this.isPlaying) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Immediate mute (keep oscillators alive for fast retriggering)
    this.voiceGain.gain.cancelScheduledValues(now);
    this.voiceGain.gain.setValueAtTime(0, now);

    this.isPlaying = false;
  }

  /**
   * Update fundamental frequency
   */
  setFrequency(frequency: number): void {
    this.baseFrequency = frequency;
    if (this.isPlaying) {
      this.updateOscillators();
    }
  }

  /**
   * Update harmonic amplitudes, phases, and tuning in real-time
   */
  updateHarmonics(harmonics: Harmonic[]): void {
    this.harmonics = harmonics;
    this.harmonicCount = harmonics.length;

    if (this.isPlaying) {
      this.updateOscillators();
    }
  }

  dispose(): void {
    this.cleanupOscillators();
    this.voiceGain.disconnect();
  }
}
