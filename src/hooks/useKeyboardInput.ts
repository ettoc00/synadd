import { useEffect, useState, useRef } from "react";
import { resumeAudioContext } from "@/audio";

interface KeyboardInputResult {
  activeNote: number | null;
  frequency: number | null;
  activeKeys: Set<string>;
}

// Key to MIDI note mapping (C4 = 60)
const KEY_TO_MIDI: Record<string, number> = {
  // White keys: C4 - D5
  a: 60, // C4
  s: 62, // D4
  d: 64, // E4
  f: 65, // F4
  g: 67, // G4
  h: 69, // A4
  j: 71, // B4
  k: 72, // C5
  l: 74, // D5
  // Black keys
  w: 61, // C#4
  e: 63, // D#4
  t: 66, // F#4
  y: 68, // G#4
  u: 70, // A#4
  o: 73, // C#5
};

// Minimum time a key stays visually highlighted (ms)
const MIN_VISUAL_HOLD_MS = 60;

/**
 * Convert MIDI note number to frequency
 * f = 440 × 2^((n - 69) / 12)
 */
function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

interface UseKeyboardInputOptions {
  onNoteOn?: (midiNote: number, frequency: number) => void;
  onNoteOff?: (midiNote: number) => void;
  isEnabled?: boolean;
}

export function useKeyboardInput({
  onNoteOn,
  onNoteOff,
  isEnabled = true,
}: UseKeyboardInputOptions = {}): KeyboardInputResult {
  // Ref for tracking actual physical key state (for audio)
  const physicalKeysRef = useRef<Set<string>>(new Set());
  // Ref for tracking visual key state with timers
  const visualKeysRef = useRef<Set<string>>(new Set());
  // Ref to track when each key was pressed (for minimum hold time)
  const keyPressTimeRef = useRef<Map<string, number>>(new Map());
  // Pending visual releases (key -> timeout id)
  const pendingReleasesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  // State for visual updates
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [currentNote, setCurrentNote] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  
  // Keep callbacks in refs to avoid dependency issues
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  
  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOn, onNoteOff]);

  useEffect(() => {
    if (!isEnabled) return;

    // Capture ref value for cleanup
    const pendingReleases = pendingReleasesRef.current;

    const updateVisualState = () => {
      setActiveKeys(new Set(visualKeysRef.current));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];

      // Ignore if typing in a TEXT input (but allow notes when slider is focused)
      const activeEl = document.activeElement;
      const isTextInput = 
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLInputElement && 
          activeEl.type !== 'range' && 
          activeEl.type !== 'checkbox' &&
          activeEl.type !== 'radio');
          
      if (isTextInput) return;
      if (midiNote === undefined) return;
      if (physicalKeysRef.current.has(key)) return;

      // Cancel any pending visual release for this key
      const pendingTimeout = pendingReleasesRef.current.get(key);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingReleasesRef.current.delete(key);
      }

      // Mark key as physically pressed
      physicalKeysRef.current.add(key);
      
      // Mark key as visually active and record press time
      visualKeysRef.current.add(key);
      keyPressTimeRef.current.set(key, performance.now());
      updateVisualState();

      // Polyphonic: each key triggers its own note
      const freq = midiToFrequency(midiNote);
      setCurrentNote(midiNote);
      setFrequency(freq);

      // Fire-and-forget resume (only needed on first interaction)
      resumeAudioContext();
      onNoteOnRef.current?.(midiNote, freq);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const midiNote = KEY_TO_MIDI[key];

      if (midiNote === undefined) return;
      if (!physicalKeysRef.current.has(key)) return;

      // Mark key as physically released (audio releases immediately)
      physicalKeysRef.current.delete(key);
      onNoteOffRef.current?.(midiNote);

      // Calculate how long the key has been visually active
      const pressTime = keyPressTimeRef.current.get(key) || 0;
      const elapsed = performance.now() - pressTime;
      const remainingHoldTime = Math.max(0, MIN_VISUAL_HOLD_MS - elapsed);

      // Schedule visual release after minimum hold time
      const releaseVisual = () => {
        visualKeysRef.current.delete(key);
        keyPressTimeRef.current.delete(key);
        pendingReleasesRef.current.delete(key);
        updateVisualState();

        // Update current note state (for display purposes)
        if (physicalKeysRef.current.size === 0) {
          setCurrentNote(null);
          setFrequency(null);
        } else {
          const lastKey = Array.from(physicalKeysRef.current).pop();
          if (lastKey) {
            const lastMidi = KEY_TO_MIDI[lastKey];
            if (lastMidi !== undefined) {
              setCurrentNote(lastMidi);
              setFrequency(midiToFrequency(lastMidi));
            }
          }
        }
      };

      if (remainingHoldTime > 0) {
        // Key was released too quickly - delay visual release
        const timeoutId = setTimeout(releaseVisual, remainingHoldTime);
        pendingReleasesRef.current.set(key, timeoutId);
      } else {
        // Key was held long enough - release immediately
        releaseVisual();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Clean up any pending timeouts
      pendingReleases.forEach((timeout) => clearTimeout(timeout));
      pendingReleases.clear();
    };
  }, [isEnabled]);

  return {
    activeNote: currentNote,
    frequency,
    activeKeys,
  };
}
