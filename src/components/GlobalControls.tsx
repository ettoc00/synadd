import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MiniPiano } from "@/components/MiniPiano";
import { Minus, Plus } from "lucide-react";
import { linearToDb } from "@/audio";

// Format dB value for display
function formatDb(linear: number): string {
  const db = linearToDb(linear);
  if (db === -Infinity) return "-∞";
  return db.toFixed(1);
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
  return (
    <div className="flex flex-col gap-4">
      {/* First row: Sliders */}
      <div className="flex gap-8 items-center">
        {/* Harmonic Count */}
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm text-slate-400">Harmonic Count</Label>
            <span className="text-sm font-mono text-cyan-400 tabular-nums w-8 text-right">
              {harmonicCount}
            </span>
          </div>
          <Slider
            value={harmonicCount}
            min={1}
            max={32}
            step={1}
            defaultValue={16}
            onValueChange={(value) => onHarmonicCountChange(value)}
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
      <div className="flex gap-8 items-center">
        {/* Octave Selector */}
        <div className="flex items-center gap-3">
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
        <MiniPiano 
          activeKeys={activeKeys} 
          onNoteOn={onNoteOn}
          onNoteOff={onNoteOff}
          className="flex-1" 
        />

        {/* Detuning Toggle */}
        <div className="flex items-center gap-3">
          <Label className="text-sm text-slate-400">Detuning</Label>
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
  );
}

