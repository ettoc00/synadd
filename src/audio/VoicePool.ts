import type { Harmonic } from "@/types";
import { AdditiveVoice } from "./AdditiveVoice";

const POOL_SIZE = 8;

interface VoiceEntry {
  voice: AdditiveVoice;
  midiNote: number | null;
  startTime: number;
}

/**
 * VoicePool manages a fixed pool of AdditiveVoice instances for polyphony.
 * Allocates voices on note-on, releases on note-off.
 * Uses oldest-voice stealing when pool is exhausted.
 */
export class VoicePool {
  private voices: VoiceEntry[] = [];

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.voices.push({
        voice: new AdditiveVoice(),
        midiNote: null,
        startTime: 0,
      });
    }
  }

  /**
   * Update harmonics for all voices
   */
  updateHarmonics(harmonics: Harmonic[]): void {
    for (const entry of this.voices) {
      entry.voice.updateHarmonics(harmonics);
    }
  }

  /**
   * Start a note - allocates a voice from the pool
   */
  noteOn(midiNote: number, frequency: number): void {
    // Check if this note is already playing
    const existing = this.voices.find((v) => v.midiNote === midiNote);
    if (existing) {
      // Retrigger the same voice
      existing.voice.start(frequency);
      existing.startTime = performance.now();
      return;
    }

    // Find a free voice
    let entry = this.voices.find((v) => v.midiNote === null);

    // No free voice - steal the oldest
    if (!entry) {
      entry = this.voices.reduce((oldest, current) =>
        current.startTime < oldest.startTime ? current : oldest
      );
      entry.voice.stop();
    }

    // Allocate and start
    entry.midiNote = midiNote;
    entry.startTime = performance.now();
    entry.voice.start(frequency);
  }

  /**
   * Stop a specific note
   */
  noteOff(midiNote: number): void {
    const entry = this.voices.find((v) => v.midiNote === midiNote);
    if (entry) {
      entry.voice.stop();
      entry.midiNote = null;
    }
  }

  /**
   * Stop all notes
   */
  allNotesOff(): void {
    for (const entry of this.voices) {
      if (entry.midiNote !== null) {
        entry.voice.stop();
        entry.midiNote = null;
      }
    }
  }

  dispose(): void {
    for (const entry of this.voices) {
      entry.voice.dispose();
    }
    this.voices = [];
  }
}
