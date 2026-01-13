export interface Harmonic {
  id: number;        // Harmonic index (1-32)
  amplitude: number; // 0 to 127
  phase: number;     // 0 to 360 (degrees)
  tuning: number;    // -100 to +100 (cents)
  mute: boolean;
}

export type PartialHarmonic = Partial<Harmonic> & { id: number; amplitude: number; };

export type Preset = {
  name: string;
  harmonics: Harmonic[];
};
