import type { Harmonic, PartialHarmonic, Preset } from "@/types";
import { MAX_AMPLITUDE, MAX_HARMONICS } from "./constants";

export { type Preset };

export function loadHarmonics(
  partials: PartialHarmonic[],
  harmonicCount: number = MAX_HARMONICS
): Harmonic[] {
  // Initialize result array with default empty harmonics
  const harmonics = Array.from({ length: harmonicCount }, (_, i) => ({
    id: i + 1,
    amplitude: 0,  // From 0 to 127
    phase: 0,      // From 0 to 360
    tuning: 0,     // From -100 to 100
    mute: false,
  }));

  // Apply partials directly to the result array
  for (const partial of compressHarmonics(partials)) {
    if (partial.id > harmonicCount) {
      continue; // Ignore partials that exceed count
    }
    // 1-based ID to 0-based index
    const index = partial.id - 1;
    
    // Copy properties
    Object.assign(harmonics[index], partial);
  }

  return harmonics;
}

/**
 * Compresses a full Harmonic array into a sparse representation by removing default values.
 * This is the inverse of loadHarmonics (mostly).
 * Amplitudes are scaled to 0-MAX_AMPLITUDE integer range.
 */
export function compressHarmonics(harmonics: PartialHarmonic[]): PartialHarmonic[] {
  return harmonics
    .map((h) => {
      // Skip if muted or silent (amplitude 0)
      if (h.mute || !h.amplitude) {
        return null;
      }

      const partial: PartialHarmonic = { 
        id: h.id,
        amplitude: Math.round(h.amplitude),
      };
      
      const phase = Math.round(h.phase ?? 0) % 360;
      if (phase) {
        partial.phase = phase;
      }
      
      const tuning = Math.round(h.tuning ?? 0);
      if (tuning) {
        partial.tuning = tuning;
      }

      return partial;
    })
    .filter((p): p is PartialHarmonic => p !== null);
}

// --- Geometric Waveforms ---

function createSineHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  return loadHarmonics([{ id: 1, amplitude: MAX_AMPLITUDE }], harmonicCount);
}

function createTriangleHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // Odd harmonics with 1/n^2 amplitude and alternating phase
  // n=1: +, n=3: -, n=5: +, n=7: -
  return loadHarmonics(
    Array.from({ length: harmonicCount }, (_, i) => {
      const n = i + 1;
      if (n % 2 === 0) return { id: n, amplitude: 0 };
      
      const phase = ((n - 1) / 2) % 2 === 1 ? 180 : 0; // Alternating 0 and 180 degrees
      return {
        id: n,
        amplitude: Math.round(MAX_AMPLITUDE / (n * n)),
        phase,
      };
    }),
    harmonicCount
  );
}

function createSquareHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // Odd harmonics with 1/n amplitude
  return loadHarmonics(
    Array.from({ length: harmonicCount }, (_, i) => {
      const n = i + 1;
      return {
        id: n,
        amplitude: n % 2 === 1 ? Math.round(MAX_AMPLITUDE / n) : 0,
      };
    }),
    harmonicCount
  );
}

function createSawtoothHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // All harmonics with 1/n amplitude
  return loadHarmonics(
    Array.from({ length: harmonicCount }, (_, i) => {
      const n = i + 1;
      return {
        id: n,
        amplitude: Math.round(MAX_AMPLITUDE / n),
      };
    }),
    harmonicCount
  );
}

function createPulseHarmonics(dutyCycle: number, harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // Rectangular Pulse wave using Fourier series.
  // 
  // A pulse wave that is HIGH for duty cycle 'd' and LOW for '1-d' of the period
  // has Fourier coefficients: A_n = (2/(n*π)) * sin(n*π*d)
  // 
  // 1. Base Phase: Since the synth uses sin(n*ω*t + φ) and we want cos(n*ω*t) terms 
  // (symmetric around peak), we use 90° as base.
  // 2. Sign: When coefficient is negative, we add 180° -> 270°.
  // 3. Time Shift: The cosine sum is centered at t=0 (High from -d/2 to +d/2).
  //    To start High at t=0 (High from 0 to d), we shift time by +d/2.
  //    Phase shift = - n * ω * (d/2) = - n * 360° * (d/2) = - n * 180° * d.
  
  return loadHarmonics(
    Array.from({ length: harmonicCount }, (_, i) => {
      const n = i + 1;
      const angle = n * Math.PI * dutyCycle;
      const rawAmp = (2 / (n * Math.PI)) * Math.sin(angle);
      
      // Determine base phase (90 or 270)
      let phase = rawAmp >= 0 ? 90 : 270;
      
      // Apply linear phase shift to move center to d/2
      // shift = - n * 180 * d
      const shift = n * 180 * dutyCycle;
      phase -= shift;
      
      // Normalize to 0-360
      phase = phase % 360;
      if (phase < 0) phase += 360;

      return {
        id: n,
        amplitude: Math.abs(rawAmp) * MAX_AMPLITUDE,
        phase: Math.round(phase)
      };
    }),
    harmonicCount
  );
}

// Improved normalization wrapper
function createPulseHarmonicsNormalized(dutyCycle: number, harmonicCount: number = MAX_HARMONICS): Harmonic[] {
    const raw = createPulseHarmonics(dutyCycle, harmonicCount);
    // Find max amplitude in the set
    let max = 0;
    for (const h of raw) {
        if (h.amplitude > max) max = h.amplitude;
    }
    
    // Scale everything to MAX_AMPLITUDE
    if (max > 0) {
        const scale = MAX_AMPLITUDE / max;
        for (const h of raw) {
            h.amplitude = Math.round(h.amplitude * scale);
        }
    }
    return raw;
}


function createStairsHarmonics(dutyCycleReciprocal: number, harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // 1/n amplitude, missing every k-th harmonic
  return loadHarmonics(
    Array.from({ length: harmonicCount }, (_, i) => {
      const n = i + 1;
      if (n % dutyCycleReciprocal === 0) return { id: n, amplitude: 0 };
      return {
        id: n,
        amplitude: Math.round(MAX_AMPLITUDE / n),
      };
    }),
    harmonicCount
  );
}

// --- Bowed Strings (Removed) ---



// --- Plucked Strings (Removed) ---



// --- Woodwinds ---



function createBassoonHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // Formant region ~440Hz. simulating for a low note (F2 ~87Hz)
  // Formant hits around H5/H6
  const partials = [
    { id: 1, amplitude: Math.round(0.6 * MAX_AMPLITUDE) },
    { id: 2, amplitude: Math.round(0.5 * MAX_AMPLITUDE) },
    { id: 3, amplitude: Math.round(0.4 * MAX_AMPLITUDE) },
    { id: 4, amplitude: Math.round(0.6 * MAX_AMPLITUDE) },
    { id: 5, amplitude: MAX_AMPLITUDE },        // Formant Peak
    { id: 6, amplitude: Math.round(0.9 * MAX_AMPLITUDE) }, // Formant Peak
    { id: 7, amplitude: Math.round(0.5 * MAX_AMPLITUDE) },
  ];
  return loadHarmonics(partials, harmonicCount);
}

function createFluteHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
    const partials = [
      { id: 1, amplitude: MAX_AMPLITUDE },
      { id: 2, amplitude: Math.round(0.5 * MAX_AMPLITUDE) },
      { id: 3, amplitude: Math.round(0.2 * MAX_AMPLITUDE) },
      { id: 4, amplitude: Math.round(0.1 * MAX_AMPLITUDE) },
      { id: 5, amplitude: Math.round(0.05 * MAX_AMPLITUDE) },
    ];
    return loadHarmonics(partials, harmonicCount);
}

// --- Brass ---



function createFrenchHornHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // "Stopped" Hand Mute
  // Bandpass filter effect around H10 (for mid range) + metallic tuning
  const partials: PartialHarmonic[] = [{ id: 1, amplitude: Math.round(0.3 * MAX_AMPLITUDE) }];
  const center = 10;
  const width = 4;
  
  for (let i = 2; i <= 20; i++) {
    // Simple Gaussian-ish curve centered at 10
    const dist = Math.abs(i - center);
    const amp = Math.exp(-(dist * dist) / (2 * width * width));
    partials.push({
      id: i,
      amplitude: Math.round(amp * MAX_AMPLITUDE),
      tuning: 15 // Metallic detune
    });
  }
  return loadHarmonics(partials, harmonicCount);
}

// --- Tuned Percussion ---



function createVibraphoneHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // 1:4:11 ratios (H1, H4, H11)
  // H11 is ratio 11. Desired is 3 oct + 4th? 
  // 3 octs (8) + 4th (4/3) -> 8 * 1.33 = 10.66. H11 (11) is close-ish.
  // actually usually it's tuned to H10 or H11.
  const partials = [
    { id: 1, amplitude: MAX_AMPLITUDE },
    { id: 4, amplitude: Math.round(0.35 * MAX_AMPLITUDE) },
    { id: 11, amplitude: Math.round(0.15 * MAX_AMPLITUDE), tuning: -50 }, // 11 to 10.66 needs flat tuning
  ];
  return loadHarmonics(partials, harmonicCount);
}



// --- Organ / Synthetic ---

function createOrganCornetHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  // Cornet V: 1, 2, 3, 4, 5
  // Tierce (H5) often pure. In ET 5th harmonic is -14c flat from ET Major 3rd.
  // To sound "Pure" (Just), H5 should be 0 deviation from harmonic series.
  // To sound like ET Organ, H5 needs to be sharp +14c.
  // Report says "emulate pure... detuning H5 by -14c". 
  // Wait, H5 IS pure (5/1). ET Maj 3rd is sharp (5.04/1).
  // So if we want pure, we leave it at 0. If we want ET organ, we tune H5 +14c.
  // Report said: "detuning the 5th harmonic by -14 cents... creates a fused tone".
  // This implies the base system is ET? No, additive is Just by default (integer multiples).
  // So leaving at 0 IS fused. Maybe report implies if checking against a real ET organ.
  // We will leave at 0 for "Perfect Cornet".
  const partials = [
    { id: 1, amplitude: MAX_AMPLITUDE }, // 8'
    { id: 2, amplitude: Math.round(0.8 * MAX_AMPLITUDE) }, // 4'
    { id: 3, amplitude: Math.round(0.6 * MAX_AMPLITUDE) }, // 2 2/3'
    { id: 4, amplitude: Math.round(0.5 * MAX_AMPLITUDE) }, // 2'
    { id: 5, amplitude: Math.round(0.7 * MAX_AMPLITUDE) }, // 1 3/5'
  ];
  return loadHarmonics(partials, harmonicCount);
}



// --- Electromechanical (Legacy) ---
function createRhodesCleanHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  const partials = [
    { id: 1, amplitude: MAX_AMPLITUDE, tuning: 0 },
    { id: 2, amplitude: Math.round(0.1 * MAX_AMPLITUDE), tuning: 2 },
    { id: 3, amplitude: Math.round(0.05 * MAX_AMPLITUDE), tuning: 5 },
    { id: 4, amplitude: Math.round(0.02 * MAX_AMPLITUDE), tuning: 10 },
    { id: 5, amplitude: Math.round(0.1 * MAX_AMPLITUDE), tuning: 20 },
  ];
  return loadHarmonics(partials, harmonicCount);
}

function createRhodesBarkHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  const partials = [
    { id: 1, amplitude: Math.round(0.7 * MAX_AMPLITUDE), tuning: 0 },
    { id: 2, amplitude: MAX_AMPLITUDE, tuning: 5 }, 
    { id: 3, amplitude: Math.round(0.4 * MAX_AMPLITUDE), tuning: 10 },
    { id: 4, amplitude: Math.round(0.2 * MAX_AMPLITUDE), tuning: 15 },
    { id: 5, amplitude: Math.round(0.15 * MAX_AMPLITUDE), tuning: 25 },
    { id: 6, amplitude: Math.round(0.1 * MAX_AMPLITUDE), tuning: 40 },
  ];
  return loadHarmonics(partials, harmonicCount);
}

function createWurlitzerHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  const partials = [
    { id: 1, amplitude: MAX_AMPLITUDE },
    { id: 2, amplitude: Math.round(0.25 * MAX_AMPLITUDE) },
    { id: 3, amplitude: Math.round(0.6 * MAX_AMPLITUDE) },
    { id: 4, amplitude: Math.round(0.15 * MAX_AMPLITUDE) },
    { id: 5, amplitude: Math.round(0.4 * MAX_AMPLITUDE) },
    { id: 6, amplitude: Math.round(0.1 * MAX_AMPLITUDE) },
    { id: 7, amplitude: Math.round(0.2 * MAX_AMPLITUDE) },
    { id: 8, amplitude: Math.round(0.05 * MAX_AMPLITUDE) },
    { id: 10, amplitude: Math.round(0.05 * MAX_AMPLITUDE) },
  ];
  return loadHarmonics(partials, harmonicCount);
}

function createOrganHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  const partials = [
    { id: 1, amplitude: MAX_AMPLITUDE },
    { id: 2, amplitude: MAX_AMPLITUDE },
    { id: 3, amplitude: MAX_AMPLITUDE },
  ];
  return loadHarmonics(partials, harmonicCount);
}

function createOrganGospelHarmonics(harmonicCount: number = MAX_HARMONICS): Harmonic[] {
  const partials = [
    { id: 1, amplitude: MAX_AMPLITUDE },
    { id: 2, amplitude: MAX_AMPLITUDE },
    { id: 3, amplitude: MAX_AMPLITUDE },
    { id: 4, amplitude: MAX_AMPLITUDE },
  ];
  return loadHarmonics(partials, harmonicCount);
}




export const BUILT_IN_PRESETS: Preset[] = [
  // Geometric
  { name: "Sine", harmonics: createSineHarmonics() },
  { name: "Triangle", harmonics: createTriangleHarmonics() },
  { name: "Square", harmonics: createSquareHarmonics() },
  { name: "Sawtooth", harmonics: createSawtoothHarmonics() },
  { name: "Pulse 15%", harmonics: createPulseHarmonicsNormalized(0.15) },
  { name: "Pulse 25%", harmonics: createPulseHarmonicsNormalized(0.25) },
  { name: "Stairs 25%", harmonics: createStairsHarmonics(4) },
  { name: "Stairs 12.5%", harmonics: createStairsHarmonics(8) },
  
  // Woodwinds
  { name: "Bassoon", harmonics: createBassoonHarmonics() },
  { name: "Flute", harmonics: createFluteHarmonics() },
  
  // Brass
  { name: "French Horn (Stop)", harmonics: createFrenchHornHarmonics() },
  
  // Tuned Percussion
  { name: "Vibraphone", harmonics: createVibraphoneHarmonics() },
  
  // Keys & Organ
  { name: "Rhodes Clean", harmonics: createRhodesCleanHarmonics() },
  { name: "Rhodes Bark", harmonics: createRhodesBarkHarmonics() },
  { name: "Wurlitzer", harmonics: createWurlitzerHarmonics() },
  { name: "Organ (Jimmy)", harmonics: createOrganHarmonics() },
  { name: "Organ (Gospel)", harmonics: createOrganGospelHarmonics() },
  { name: "Organ Cornet V", harmonics: createOrganCornetHarmonics() },
  
];
