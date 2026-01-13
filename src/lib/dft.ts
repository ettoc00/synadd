import type { Harmonic } from "@/types";
import { MAX_AMPLITUDE } from "@/lib/constants";

/**
 * Compute harmonics from a time-domain waveform using Discrete Fourier Transform.
 * Called when user finishes drawing on the canvas.
 *
 * @param samples - Normalized waveform samples (-1.0 to 1.0), ideally 512 or more
 * @param numHarmonics - Number of harmonics to extract (default 32)
 * @returns Array of Harmonic objects with amplitude and phase
 */
export function computeHarmonicsFromWaveform(
  samples: number[],
  numHarmonics = 32
): Harmonic[] {
  const N = samples.length;
  const harmonics: Harmonic[] = [];

  // Find max amplitude for normalization
  let maxMagnitude = 0;

  // First pass: compute all magnitudes to find max
  const magnitudes: number[] = [];
  const phases: number[] = [];

  for (let k = 1; k <= numHarmonics; k++) {
    let real = 0;
    let imag = 0;

    // DFT for bin k
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      real += samples[n] * Math.cos(angle);
      imag -= samples[n] * Math.sin(angle);
    }

    // Normalize by N/2 for correct amplitude
    real = (2 * real) / N;
    imag = (2 * imag) / N;

    const magnitude = Math.sqrt(real * real + imag * imag);
    const phase = Math.atan2(imag, real);

    magnitudes.push(magnitude);
    phases.push(phase);

    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
    }
  }

  // Second pass: normalize and create harmonics
  for (let k = 0; k < numHarmonics; k++) {
    // Normalize amplitude to 0-MAX_AMPLITUDE range (integer)
    const normalizedAmp = maxMagnitude > 0 ? magnitudes[k] / maxMagnitude : 0;
    const amplitude = Math.round(normalizedAmp * MAX_AMPLITUDE);

    // Convert phase from radians to degrees (0-360)
    let phaseDeg = (phases[k] * 180) / Math.PI;
    
    // Shift by +90 to align with Sine basis (Math.sin used in synthesis)
    // DFT gives phase relative to Cosine. Cos(x - 90) = Sin(x).
    // So if we have a Sine wave, DFT says -90. We want 0. So -90 + 90 = 0.
    phaseDeg += 90;

    phaseDeg = phaseDeg % 360;
    if (phaseDeg < 0) phaseDeg += 360;

    harmonics.push({
      id: k + 1,
      amplitude: Math.min(MAX_AMPLITUDE, Math.max(0, amplitude)),
      phase: Math.round(phaseDeg),
      tuning: 0, // Reset tuning on draw
      mute: false, // Unmute on draw
    });
  }

  return harmonics;
}

/**
 * Generate waveform samples from harmonics for canvas visualization.
 *
 * @param harmonics - Array of harmonic objects
 * @param numSamples - Number of samples to generate
 * @param harmonicCount - Number of harmonics to include in synthesis
 * @returns Array of samples (-1.0 to 1.0)
 */
export function generateWaveformFromHarmonics(
  harmonics: Harmonic[],
  numSamples: number,
  harmonicCount: number
): number[] {
  const samples: number[] = new Array(numSamples).fill(0);

  for (let n = 0; n < numSamples; n++) {
    const t = n / numSamples; // Normalized time (0 to 1 = one period)

    for (let i = 0; i < Math.min(harmonicCount, harmonics.length); i++) {
      const h = harmonics[i];
      if (h.mute) continue;

      const harmonicNumber = h.id;
      const phaseRad = (h.phase * Math.PI) / 180;
      const tuningMultiplier = Math.pow(2, h.tuning / 1200);

      // y(t) = A * sin(2π * n * f * t + φ)
      // For visualization, f = 1 (one cycle per period)
      samples[n] +=
        h.amplitude *
        Math.sin(2 * Math.PI * harmonicNumber * tuningMultiplier * t + phaseRad);
    }
  }

  // Normalize to -1 to 1
  const maxAbs = Math.max(...samples.map(Math.abs), 0.001);
  if (maxAbs > 1) {
    for (let i = 0; i < samples.length; i++) {
      samples[i] /= maxAbs;
    }
  }

  return samples;
}

/**
 * Convert harmonics to PeriodicWave coefficients for Web Audio API.
 * Encodes both amplitude and phase into real/imaginary Fourier components.
 *
 * The Web Audio API PeriodicWave uses a sine-based convention:
 * - real[n] corresponds to cos(n * ω * t) terms
 * - imag[n] corresponds to sin(n * ω * t) terms
 *
 * To produce A * sin(n * ω * t + φ), we use the identity:
 *   sin(x + φ) = sin(x)cos(φ) + cos(x)sin(φ)
 * So: real[n] = A * sin(φ), imag[n] = A * cos(φ)
 *
 * @param harmonics - Array of harmonic objects
 * @param harmonicCount - Number of harmonics to include
 * @returns Object with real and imag Float32Arrays for PeriodicWave
 */
export function harmonicsToPeriodicWaveCoeffs(
  harmonics: Harmonic[],
  harmonicCount: number
): { real: Float32Array; imag: Float32Array } {
  // Size is harmonicCount + 1 (index 0 is DC offset, always 0)
  const size = harmonicCount + 1;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);

  // DC offset (index 0) is always 0
  real[0] = 0;
  imag[0] = 0;

  for (let i = 0; i < Math.min(harmonicCount, harmonics.length); i++) {
    const h = harmonics[i];
    if (h.mute) continue;

    const harmonicIndex = i + 1; // PeriodicWave uses 1-based indexing for harmonics
    const normalizedAmp = h.amplitude / MAX_AMPLITUDE;
    const phaseRad = (h.phase * Math.PI) / 180;

    // sin(x + φ) = sin(x)cos(φ) + cos(x)sin(φ)
    // So for PeriodicWave: real[n] = A * sin(φ), imag[n] = A * cos(φ)
    real[harmonicIndex] = normalizedAmp * Math.sin(phaseRad);
    imag[harmonicIndex] = normalizedAmp * Math.cos(phaseRad);
  }

  return { real, imag };
}
