import { useRef, useCallback, useState } from "react";
import { resumeAudioContext } from "@/audio";

interface MiniPianoProps {
  activeKeys: Set<string>;
  onNoteOn?: (midiNote: number, frequency: number) => void;
  onNoteOff?: (midiNote: number) => void;
  className?: string;
}

// Piano key layout: C4 to D5
const PIANO_KEYS = [
  { key: "a", note: "C", midi: 60, isBlack: false },
  { key: "w", note: "C#", midi: 61, isBlack: true },
  { key: "s", note: "D", midi: 62, isBlack: false },
  { key: "e", note: "D#", midi: 63, isBlack: true },
  { key: "d", note: "E", midi: 64, isBlack: false },
  { key: "f", note: "F", midi: 65, isBlack: false },
  { key: "t", note: "F#", midi: 66, isBlack: true },
  { key: "g", note: "G", midi: 67, isBlack: false },
  { key: "y", note: "G#", midi: 68, isBlack: true },
  { key: "h", note: "A", midi: 69, isBlack: false },
  { key: "u", note: "A#", midi: 70, isBlack: true },
  { key: "j", note: "B", midi: 71, isBlack: false },
  { key: "k", note: "C", midi: 72, isBlack: false },
  { key: "o", note: "C#", midi: 73, isBlack: true },
  { key: "l", note: "D", midi: 74, isBlack: false },
];

// Group white and black keys
const whiteKeys = PIANO_KEYS.filter((k) => !k.isBlack);
const blackKeys = PIANO_KEYS.filter((k) => k.isBlack);

// Black key positions (offset from left edge, in terms of white key widths)
const blackKeyPositions: Record<string, number> = {
  w: 0.65,  // C#4
  e: 1.65,  // D#4
  t: 3.65,  // F#4
  y: 4.65,  // G#4
  u: 5.65,  // A#4
  o: 7.65,  // C#5
};

// Map MIDI note to key for visual feedback
const midiToKey: Record<number, string> = Object.fromEntries(
  PIANO_KEYS.map((k) => [k.midi, k.key])
);

/**
 * Convert MIDI note number to frequency
 * f = 440 × 2^((n - 69) / 12)
 */
function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export function MiniPiano({ 
  activeKeys, 
  onNoteOn, 
  onNoteOff, 
  className = "" 
}: MiniPianoProps) {
  const whiteKeyWidth = 100 / whiteKeys.length;
  const activeMouseNotesRef = useRef<Set<number>>(new Set());
  // Track mouse-pressed keys for visual feedback
  const [activeMouseKeys, setActiveMouseKeys] = useState<Set<string>>(new Set());

  const handleMouseDown = useCallback((midi: number) => {
    if (!onNoteOn) return;
    resumeAudioContext();
    activeMouseNotesRef.current.add(midi);
    // Update visual state
    const key = midiToKey[midi];
    if (key) {
      setActiveMouseKeys((prev) => new Set(prev).add(key));
    }
    onNoteOn(midi, midiToFrequency(midi));
  }, [onNoteOn]);

  const handleMouseUp = useCallback((midi: number) => {
    if (!onNoteOff) return;
    if (activeMouseNotesRef.current.has(midi)) {
      activeMouseNotesRef.current.delete(midi);
      // Update visual state
      const key = midiToKey[midi];
      if (key) {
        setActiveMouseKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
      onNoteOff(midi);
    }
  }, [onNoteOff]);

  const handleMouseLeave = useCallback((midi: number) => {
    // Release note when mouse leaves while pressed
    if (activeMouseNotesRef.current.has(midi)) {
      activeMouseNotesRef.current.delete(midi);
      // Update visual state
      const key = midiToKey[midi];
      if (key) {
        setActiveMouseKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
      onNoteOff?.(midi);
    }
  }, [onNoteOff]);

  // Check if key is active (either via keyboard or mouse)
  const isKeyActive = (key: string) => activeKeys.has(key) || activeMouseKeys.has(key);

  return (
    <div className={`relative h-10 select-none ${className}`}>
      {/* White keys */}
      <div className="absolute inset-0 flex">
        {whiteKeys.map((k) => {
          const isActive = isKeyActive(k.key);
          return (
            <div
              key={k.key}
              className={`
                flex-1 border border-slate-600 rounded-b-sm
                flex items-end justify-center pb-0.5
                cursor-pointer
                ${isActive
                  ? "bg-cyan-400 border-cyan-500 text-slate-900"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                }
              `}
              onMouseDown={() => handleMouseDown(k.midi)}
              onMouseUp={() => handleMouseUp(k.midi)}
              onMouseLeave={() => handleMouseLeave(k.midi)}
            >
              <span className="text-[10px] font-mono uppercase font-medium pointer-events-none">
                {k.key}
              </span>
            </div>
          );
        })}
      </div>

      {/* Black keys */}
      {blackKeys.map((k) => {
        const isActive = isKeyActive(k.key);
        const leftPercent = blackKeyPositions[k.key] * whiteKeyWidth;
        return (
          <div
            key={k.key}
            className={`
              absolute top-0 h-[60%] rounded-b-sm
              flex items-end justify-center pb-0.5
              z-10 cursor-pointer
              ${isActive
                ? "bg-cyan-500 border-cyan-400 text-cyan-100"
                : "bg-slate-800 hover:bg-slate-700 text-slate-400"
              }
            `}
            style={{
              width: `${whiteKeyWidth * 0.6}%`,
              left: `${leftPercent}%`,
            }}
            onMouseDown={() => handleMouseDown(k.midi)}
            onMouseUp={() => handleMouseUp(k.midi)}
            onMouseLeave={() => handleMouseLeave(k.midi)}
          >
            <span className="text-[8px] font-mono uppercase font-medium pointer-events-none">
              {k.key}
            </span>
          </div>
        );
      })}
    </div>
  );
}
