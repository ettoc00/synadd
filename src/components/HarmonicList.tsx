import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { HarmonicRow } from "./HarmonicRow";
import type { Harmonic } from "@/types";
import { useThrottledCallback } from "@tanstack/react-pacer";
import { MAX_AMPLITUDE } from "@/lib/constants";


interface HarmonicListProps {
  harmonics: Harmonic[];
  harmonicCount: number;
  detuningAllowed: boolean;
  onHarmonicUpdate: (id: number, updates: Partial<Omit<Harmonic, "id">>) => void;
}

export function HarmonicList({
  harmonics,
  harmonicCount,
  detuningAllowed,
  onHarmonicUpdate,
}: HarmonicListProps) {
  const visibleHarmonics = harmonics.slice(0, harmonicCount);

  const handleUpdate = useThrottledCallback(
    (id: number, updates: Partial<Omit<Harmonic, "id">>) => {
      onHarmonicUpdate(id, updates);
    },
    { wait: 20 }
  );

  return (
    <Card className="bg-slate-900 border-slate-800 flex-1 overflow-hidden">
      {/* Header row */}
      <div className="hidden md:flex gap-4 items-center px-3 py-2 border-b border-slate-800 bg-slate-900/80 text-xs text-slate-500 font-medium">
        <div className="text-center w-[30px]">Mute</div>
        <div className="text-center w-[30px]">H#</div>
        <div className="flex-1 grid grid-cols-3 gap-4">
          <div>Amplitude (0-{MAX_AMPLITUDE})</div>
          <div className="pl-8">Phase (0-360°)</div>
          <div className="pl-8">Tuning (-100..+100c)</div>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="h-[calc(100%-40px)]">
        <div className="p-1">
          {visibleHarmonics.map((harmonic) => (
            <HarmonicRow
              key={harmonic.id}
              harmonic={harmonic}
              detuningAllowed={detuningAllowed}
              onUpdate={(updates) => handleUpdate(harmonic.id, updates)}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
