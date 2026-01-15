import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MiniPiano } from "@/components/MiniPiano";
import { Minus, Plus } from "lucide-react";
import { linearToDb } from "@/audio";
import { cn } from "@/lib/utils";

// Format dB value for display
function formatDb(linear: number): string {
  const db = linearToDb(linear);
  if (db === -Infinity) return "-∞";
  return db.toFixed(1);
}

/**
 * Maps slider position (1-64) to actual harmonic count (1-128)
 * - Positions 1-32: Linear mapping to harmonics 1-32
 * - Positions 33-64: Exponential mapping to harmonics 33-128
 */
function sliderToHarmonicCount(sliderValue: number): number {
  if (sliderValue <= 32) {
    // Linear region: slider 1-32 → harmonics 1-32
    return sliderValue;
  } else {
    // Exponential region: slider 33-64 → harmonics 33-128
    // Map slider 33-64 to t=0-1, then exponentially interpolate 32-128
    const t = (sliderValue - 32) / 32; // 0 to 1
    // Exponential: 32 * 2^(2*t) gives us 32 at t=0 and 128 at t=1
    return Math.round(32 * Math.pow(2, 2 * t));
  }
}

/**
 * Maps actual harmonic count (1-128) back to slider position (1-64)
 */
function harmonicCountToSlider(harmonicCount: number): number {
  if (harmonicCount <= 32) {
    // Linear region: harmonics 1-32 → slider 1-32
    return harmonicCount;
  } else {
    // Exponential region: harmonics 33-128 → slider 33-64
    // Inverse of: count = 32 * 2^(2*t)
    // t = log2(count/32) / 2
    const t = Math.log2(harmonicCount / 32) / 2;
    return Math.round(32 + t * 32);
  }
}

interface GlobalControlsProps {
  harmonicCount: number;
  masterGain: number;
  octaveShift: number;
  detuningAllowed: boolean;
  activeKeys: Set<string>;
  onHarmonicCountChange: (value: number) => void;
  onMasterGainChange: (value: number) => void;
  onOctaveShiftChange: (value: number) => void;
  onDetuningAllowedChange: (value: boolean) => void;
  onNoteOn?: (midiNote: number, frequency: number) => void;
  onNoteOff?: (midiNote: number) => void;
}

export function GlobalControls({
  harmonicCount,
  masterGain,
  octaveShift,
  detuningAllowed,
  activeKeys,
  onHarmonicCountChange,
  onMasterGainChange,
  onOctaveShiftChange,
  onDetuningAllowedChange,
  onNoteOn,
  onNoteOff,
}: GlobalControlsProps) {
  const [isUltraMode, setIsUltraMode] = useState(false);

  const toggleUltraMode = () => {
    const newMode = !isUltraMode;
    setIsUltraMode(newMode);

    // If disabling ultra mode and count is high, clamp it
    if (!newMode && harmonicCount > 32) {
      onHarmonicCountChange(32);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* First row: Sliders */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-stretch md:items-center">
        {/* Harmonic Count */}
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm text-slate-400">Harmonic <span className={cn("transition-colors select-none", isUltraMode ? "text-cyan-400 font-medium drop-shadow-sm" : "")} onDoubleClick={toggleUltraMode}>Count</span>{isUltraMode && " ✨"}</Label>
            <span className="text-sm font-mono text-cyan-400 tabular-nums w-8 text-right">
              {harmonicCount}
            </span>
          </div>
          <Slider
            value={isUltraMode ? harmonicCountToSlider(harmonicCount) : harmonicCount}
            min={1}
            max={isUltraMode ? 64 : 32}
            step={1}
            defaultValue={16}
            onValueChange={(val) => {
              const newValue = isUltraMode ? sliderToHarmonicCount(val) : val;
              onHarmonicCountChange(newValue);
            }}
            className="[&_[data-slider-track]]:bg-slate-700 [&_[data-slider-range]]:bg-cyan-500 [&_[data-slider-thumb]]:bg-cyan-400 [&_[data-slider-thumb]]:border-cyan-500"
          />
        </div>

        {/* Master Gain */}
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm text-slate-400">Master Gain</Label>
            <span className="text-sm font-mono text-cyan-400 tabular-nums w-16 text-right">
              {formatDb(masterGain)} dB
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <Slider
              value={masterGain}
              min={0}
              max={1}
              step={0.01}
              defaultValue={0.5}
              onValueChange={(value) => onMasterGainChange(value)}
              className="flex-1 [&_[data-slider-track]]:bg-slate-700 [&_[data-slider-range]]:bg-cyan-500 [&_[data-slider-thumb]]:bg-cyan-400 [&_[data-slider-thumb]]:border-cyan-500"
            />
            {/* Level meter */}
            <div className="w-2 h-8 bg-slate-800 rounded overflow-hidden flex flex-col-reverse">
              <div
                className="bg-gradient-to-t from-cyan-500 to-cyan-400 transition-all duration-75"
                style={{ height: `${masterGain * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Second row: Octave & Detuning */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-between md:justify-start">
        {/* Octave Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <Label className="text-sm text-slate-400">Octave</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-slate-700 bg-slate-800 hover:bg-slate-700"
              onClick={() => onOctaveShiftChange(octaveShift - 1)}
              disabled={octaveShift <= -2}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-mono text-cyan-400 tabular-nums w-8 text-center">
              {octaveShift > 0 ? `+${octaveShift}` : octaveShift}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-slate-700 bg-slate-800 hover:bg-slate-700"
              onClick={() => onOctaveShiftChange(octaveShift + 1)}
              disabled={octaveShift >= 2}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Mini Piano */}
        <div className="w-full md:flex-1">
          <MiniPiano
            activeKeys={activeKeys}
            onNoteOn={onNoteOn}
            onNoteOff={onNoteOff}
            className="w-full"
          />
        </div>

        {/* Detuning Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <Label className="text-sm text-slate-400">Detuning</Label>
          <div className="flex items-center gap-3">
            <Switch
              checked={detuningAllowed}
              onCheckedChange={onDetuningAllowedChange}
              className="data-checked:bg-cyan-500"
            />
            <span className="text-xs text-slate-500 w-14">
              {detuningAllowed ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

