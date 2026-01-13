import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { VoicePool, setMasterVolume } from "@/audio";
import { BUILT_IN_PRESETS } from "@/lib/presets";
import { useHistory } from "./useHistory";
import type { Harmonic } from "@/types";

interface SynthEngineState {
  harmonics: Harmonic[];
  harmonicCount: number;
  masterGain: number;
  isDrawMode: boolean;
  octaveShift: number;
  detuningAllowed: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

interface SynthEngineActions {
  setHarmonic: (id: number, updates: Partial<Omit<Harmonic, "id">>) => void;
  setHarmonics: (harmonics: Harmonic[]) => void;
  setHarmonicCount: (count: number) => void;
  setMasterGain: (gain: number) => void;
  setDrawMode: (enabled: boolean) => void;
  setOctaveShift: (shift: number) => void;
  setDetuningAllowed: (allowed: boolean) => void;
  playNote: (midiNote: number, frequency: number) => void;
  stopNote: (midiNote: number) => void;
  undo: () => void;
  redo: () => void;
}

// Helper to get default harmonics from our presets file
function getDefaultHarmonics(): Harmonic[] {
  return BUILT_IN_PRESETS[0].harmonics;
}

export function useSynthEngine(): SynthEngineState & SynthEngineActions {
  const {
    state: harmonics,
    setState: setHarmonicsState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<Harmonic[]>(getDefaultHarmonics);
  const [harmonicCount, setHarmonicCountState] = useState(16);
  const [masterGain, setMasterGainState] = useState(0.8);
  const [isDrawMode, setDrawModeState] = useState(false);
  const [octaveShift, setOctaveShiftState] = useState(0);
  const [detuningAllowed, setDetuningAllowedState] = useState(true);

  const voicePoolRef = useRef<VoicePool | null>(null);

  // Initialize voice pool
  useEffect(() => {
    voicePoolRef.current = new VoicePool();
    return () => {
      voicePoolRef.current?.dispose();
    };
  }, []);

  // Compute effective harmonics (zero out tuning when disabled)
  const effectiveHarmonics = useMemo(() => {
    if (detuningAllowed) {
      return harmonics.slice(0, harmonicCount);
    }
    return harmonics.slice(0, harmonicCount).map((h) => ({
      ...h,
      tuning: 0,
    }));
  }, [harmonics, harmonicCount, detuningAllowed]);

  // Sync harmonics to voice pool
  useEffect(() => {
    voicePoolRef.current?.updateHarmonics(effectiveHarmonics);
  }, [effectiveHarmonics]);

  // Sync master gain
  useEffect(() => {
    setMasterVolume(masterGain);
  }, [masterGain]);

  const setHarmonic = useCallback((id: number, updates: Partial<Omit<Harmonic, "id">>) => {
    setHarmonicsState((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  }, []);

  const setHarmonics = useCallback((harmonics: Harmonic[]) => {
    setHarmonicsState(harmonics);
  }, []);

  const setHarmonicCount = useCallback((count: number) => {
    setHarmonicCountState(Math.max(1, Math.min(32, count)));
  }, []);

  const setMasterGain = useCallback((gain: number) => {
    setMasterGainState(Math.max(0, Math.min(1, gain)));
  }, []);

  const setDrawMode = useCallback((enabled: boolean) => {
    setDrawModeState(enabled);
  }, []);

  const setOctaveShift = useCallback((shift: number) => {
    setOctaveShiftState(Math.max(-2, Math.min(2, shift)));
  }, []);

  const setDetuningAllowed = useCallback((allowed: boolean) => {
    setDetuningAllowedState(allowed);
  }, []);

  const playNote = useCallback((midiNote: number, frequency: number) => {
    // Apply octave shift to frequency
    const shiftedFrequency = frequency * Math.pow(2, octaveShift);
    voicePoolRef.current?.noteOn(midiNote, shiftedFrequency);
  }, [octaveShift]);

  const stopNote = useCallback((midiNote: number) => {
    voicePoolRef.current?.noteOff(midiNote);
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.shiftKey && e.key === "Z") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    harmonics,
    harmonicCount,
    masterGain,
    isDrawMode,
    octaveShift,
    detuningAllowed,
    canUndo,
    canRedo,
    setHarmonic,
    setHarmonics,
    setHarmonicCount,
    setMasterGain,
    setDrawMode,
    setOctaveShift,
    setDetuningAllowed,
    playNote,
    stopNote,
    undo,
    redo,
  };
}

