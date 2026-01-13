import { Card } from "@/components/ui/card";
import { WaveformCanvas } from "@/components/WaveformCanvas";
import { PresetsPanel } from "@/components/PresetsPanel";
import { GlobalControls } from "@/components/GlobalControls";
import { HarmonicList } from "@/components/HarmonicList";
import { useSynthEngine, useKeyboardInput } from "@/hooks";

export function App() {
  const {
    harmonics,
    harmonicCount,
    masterGain,
    isDrawMode,
    octaveShift,
    detuningAllowed,
    setHarmonic,
    setHarmonics,
    setHarmonicCount,
    setMasterGain,
    setDrawMode,
    setOctaveShift,
    setDetuningAllowed,
    playNote,
    stopNote,
  } = useSynthEngine();

  // Keyboard input
  const { activeKeys } = useKeyboardInput({
    onNoteOn: playNote,
    onNoteOff: stopNote,
    isEnabled: true,
  });

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Main container - 16:9 aspect ratio */}
      <div className="w-full max-w-7xl aspect-video bg-slate-950 rounded-xl border border-slate-800 p-6 flex gap-6">
        {/* Left column - 35% */}
        <div className="w-[35%] flex flex-col gap-6">
          {/* Waveform canvas */}
          <Card className="flex-1 bg-slate-900 border-slate-800 p-0 overflow-hidden">
            <WaveformCanvas
              harmonics={harmonics}
              harmonicCount={harmonicCount}
              detuningAllowed={detuningAllowed}
              isDrawMode={isDrawMode}
              onDrawModeChange={setDrawMode}
              onDrawComplete={setHarmonics}
              className="h-full"
            />
          </Card>

          {/* Presets panel */}
          <PresetsPanel
            onPresetSelect={(h) => {
              setHarmonics(h);
              setDrawMode(false);
            }}
            currentHarmonics={harmonics}
          />
        </div>

        {/* Right column - 65% */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Global controls */}
          <GlobalControls
            harmonicCount={harmonicCount}
            masterGain={masterGain}
            octaveShift={octaveShift}
            detuningAllowed={detuningAllowed}
            activeKeys={activeKeys}
            onHarmonicCountChange={setHarmonicCount}
            onMasterGainChange={setMasterGain}
            onOctaveShiftChange={setOctaveShift}
            onDetuningAllowedChange={setDetuningAllowed}
            onNoteOn={playNote}
            onNoteOff={stopNote}
          />

          {/* Harmonic list */}
          <HarmonicList
            harmonics={harmonics}
            harmonicCount={harmonicCount}
            detuningAllowed={detuningAllowed}
            onHarmonicUpdate={setHarmonic}
          />
        </div>
      </div>
    </div>
  );
}

export default App;