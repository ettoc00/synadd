/**
 * Singleton AudioContext with master gain and compressor.
 * Audio chain: oscillators → masterGain → compressor → destination
 */

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();

    // Create master gain node
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.5;

    // Create compressor to prevent clipping from 32-wave summation
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Connect chain: masterGain → compressor → destination
    masterGain.connect(compressor);
    compressor.connect(audioContext.destination);
  }

  return audioContext;
}

export function getMasterGain(): GainNode {
  getAudioContext(); // Ensure initialized
  return masterGain!;
}

/**
 * Convert linear slider value (0-1) to exponential gain.
 * This provides perceptually linear volume control.
 * Uses an exponential curve that maps:
 *   0.0 → 0.0 (silence)
 *   0.5 → ~0.25 (half-volume feels like -12dB)
 *   1.0 → 1.0 (full volume)
 */
function linearToExponentialGain(linear: number): number {
  if (linear <= 0) return 0;
  // Attempt to use a power curve for more natural feel (exponent of 2)
  return Math.pow(linear, 2);
}

/**
 * Convert linear slider value (0-1) to decibels for display.
 * Returns -Infinity for 0, and 0 dB for 1.0
 */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

export function setMasterVolume(value: number): void {
  const gain = getMasterGain();
  const exponentialGain = linearToExponentialGain(value);
  gain.gain.setTargetAtTime(exponentialGain, gain.context.currentTime, 0.01);
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}
