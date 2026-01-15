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
    <div className="min-h-screen bg-slate-950 flex md:items-center justify-center p-2 md:p-4">
      {/* Main container */}
      <div className="w-full max-w-7xl bg-slate-950 md:rounded-xl md:border border-slate-800 p-0 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 md:aspect-video">
        {/* Left column */}
        <div className="w-full md:w-[35%] flex flex-col gap-4 md:gap-6 shrink-0">
          {/* Waveform canvas */}
          <Card className="bg-slate-900 border-slate-800 p-0 overflow-hidden min-h-[250px] md:min-h-0 md:aspect-video shrink-0">
            <WaveformCanvas
              harmonics={harmonics}
              harmonicCount={harmonicCount}
              detuningAllowed={detuningAllowed}
              isDrawMode={isDrawMode}
              onDrawModeChange={setDrawMode}
              onDrawComplete={setHarmonics}
              className="h-full w-full"
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

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
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