import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Harmonic } from "@/types";
import { cn } from "@/lib/utils";
import { MAX_AMPLITUDE, MAX_PHASE, MAX_TUNING, MIN_TUNING } from "@/lib/constants";
import { useState, useRef, type KeyboardEvent, type MouseEvent } from "react";

interface HarmonicSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  format?: (value: number) => string;
  className?: string;
  textClassName?: string;
  disabled?: boolean;
}

function HarmonicSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  defaultValue,
  format,
  className,
  textClassName,
  disabled = false,
}: HarmonicSliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startEditing = () => {
    setTempValue(value.toString());
    setIsEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const handleSpanClick = (e: MouseEvent<HTMLSpanElement>) => {
    // Using detail to detect single vs double click
    if (e.detail === 1) {
      // Single click - wait briefly to see if it becomes a double click
      clickTimeoutRef.current = setTimeout(() => {
        startEditing();
      }, 250);
    } else if (e.detail === 2) {
      // Double click - display original interface
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      if (defaultValue !== undefined) {
        onValueChange(defaultValue);
      }
    }
  };

  // Focus effect only (optional, merged above is better)

  const commit = () => {
    let newValue = parseFloat(tempValue);
    if (!isNaN(newValue)) {
      if (min !== undefined) newValue = Math.max(min, newValue);
      if (max !== undefined) newValue = Math.min(max, newValue);
      onValueChange(newValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1 transition-all duration-300 ease-out", disabled && "opacity-50", className)}>
      <div
        className={cn(
          "transition-[flex-basis,flex-grow] duration-300 ease-out",
          isEditing ? "basis-1/3 grow-0" : "basis-0 grow"
        )}
      >
        <Slider
          value={value}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          disabled={disabled}
          className="[&_[data-slider-track]]:bg-slate-700 [&_[data-slider-range]]:bg-cyan-500 [&_[data-slider-thumb]]:bg-cyan-400 [&_[data-slider-thumb]]:border-cyan-500 [&_[data-slider-track]]:h-1"
        />
      </div>
      
      {/* Both Input and Span exist in DOM to allow transition */}
      <Input
        ref={inputRef}
        type="number"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={!isEditing}
        className={cn(
          "h-5 px-1 py-0 text-xs font-mono text-right bg-slate-800 border-slate-700 focus-visible:ring-1 focus-visible:ring-cyan-500 min-w-0 transition-all duration-300 ease-out origin-right",
          isEditing 
            ? "flex-1 opacity-100 scale-100 ml-0" 
            : "w-0 p-0 border-0 opacity-0 scale-95 ml-0 pointer-events-none"
        )}
        style={{
            // Hard force width to 0 when not editing to ensure it disappears totally
            width: isEditing ? undefined : 0,
            flexGrow: isEditing ? 1 : 0
        }}
        min={min}
        max={max}
        step={step}
      />

      <span
        className={cn(
          "cursor-text hover:text-cyan-400 transition-all duration-300 ease-out text-xs font-mono text-slate-400 tabular-nums text-right whitespace-nowrap",
          textClassName,
          !isEditing 
            ? "opacity-100 translate-x-0" 
            : "w-0 overflow-hidden opacity-0 translate-x-4 pointer-events-none"
        )}
        onClick={handleSpanClick}
      >
        {format ? format(value) : value}
      </span>
    </div>
  );
}

interface HarmonicRowProps {
  harmonic: Harmonic;
  detuningAllowed: boolean;
  onUpdate: (updates: Partial<Omit<Harmonic, "id">>) => void;
}

export function HarmonicRow({ harmonic, detuningAllowed, onUpdate }: HarmonicRowProps) {
  const isFundamental = harmonic.id === 1;

  // Format tuning with sign
  const formatTuning = (value: number): string => {
    if (value > 0) return `+${value}c`;
    if (value < 0) return `${value}c`;
    return "0c";
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[30px_30px_1fr_1fr_1fr] gap-4 items-center px-3 py-2 rounded",
        harmonic.id % 2 === 0 ? "bg-slate-900/50" : "bg-slate-900"
      )}
    >
      {/* Mute checkbox */}
      <div className="flex justify-center">
        <Checkbox
          checked={!harmonic.mute}
          onCheckedChange={(checked) => onUpdate({ mute: !checked })}
          className="data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
        />
      </div>

      {/* Harmonic number */}
      <div className="text-sm text-slate-400 font-mono tabular-nums text-center">
        {harmonic.id}
      </div>

      <HarmonicSlider
        value={harmonic.amplitude}
        onValueChange={(value) => onUpdate({ amplitude: value })}
        min={0}
        max={MAX_AMPLITUDE}
        step={1}
        defaultValue={isFundamental ? MAX_AMPLITUDE : 0}
        format={(v) => v.toFixed(0)}
        textClassName="w-12"
      />

      {/* Phase slider */}
      <HarmonicSlider
        value={harmonic.phase}
        onValueChange={(value) => onUpdate({ phase: value })}
        min={0}
        max={MAX_PHASE}
        step={1}
        defaultValue={0}
        format={(v) => `${v}°`}
        textClassName="w-10"
        className="pl-8" // Extra spacing
      />

      {/* Tuning slider */}
      <HarmonicSlider
        value={detuningAllowed ? harmonic.tuning : 0}
        onValueChange={(value) => onUpdate({ tuning: value })}
        min={MIN_TUNING}
        max={MAX_TUNING}
        step={1}
        defaultValue={0}
        format={detuningAllowed ? formatTuning : () => "0c"}
        textClassName="w-12"
        className="pl-8" // Extra spacing
        disabled={!detuningAllowed}
      />
    </div>
  );
}
