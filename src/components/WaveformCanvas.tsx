import { useRef, useEffect, useCallback, useState, useMemo, type MouseEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { generateWaveformFromHarmonics, computeHarmonicsFromWaveform } from "@/lib/dft";
import { loadHarmonics } from "@/lib/presets";
import type { Harmonic } from "@/hooks";
import { cn } from "@/lib/utils";

interface WaveformCanvasProps {
  harmonics: Harmonic[];
  harmonicCount: number;
  detuningAllowed: boolean;
  isDrawMode: boolean;
  onDrawModeChange: (enabled: boolean) => void;
  onDrawComplete: (harmonics: Harmonic[]) => void;
  className?: string;
}

export function WaveformCanvas({
  harmonics,
  harmonicCount,
  detuningAllowed,
  isDrawMode,
  onDrawModeChange,
  onDrawComplete,
  className,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const rawPointsRef = useRef<number[]>([]); // Persisted raw points (before smoothing)
  const currentStrokePointsRef = useRef<Map<number, number>>(new Map()); // Points drawn in current stroke
  const animationRef = useRef<number>(0);
  const [smoothing, setSmoothing] = useState(0); // 0-100
  const [isSmoothingDragging, setIsSmoothingDragging] = useState(false);
  const [isSharpMode, setIsSharpMode] = useState(false); // Secret sharpen mode
  const [isActivelyDrawing, setIsActivelyDrawing] = useState(false); // For UI reactivity
  const lastHarmonicsRef = useRef<Harmonic[]>(harmonics);

  // Compute effective harmonics (zero out tuning when disabled)
  const effectiveHarmonics = useMemo(() => {
    if (detuningAllowed) {
      return harmonics;
    }
    return harmonics.map((h) => ({
      ...h,
      tuning: 0,
    }));
  }, [harmonics, detuningAllowed]);

  // Convert mouse Y to amplitude (-1 to 1)
  const yToAmplitude = useCallback((y: number, height: number): number => {
    const centerY = height / 2;
    return -(y - centerY) / (height / 2);
  }, []);

  // Process waveform: smooth or sharpen based on mode
  const smoothWaveform = useCallback((points: number[], strength: number): number[] => {
    if (strength <= 0 || points.length === 0) return [...points];

    const maxWindow = Math.max(5, points.length * 0.1); 
    const windowSize = Math.floor(1 + (strength / 100) * maxWindow);
    
    if (windowSize <= 1) return [...points];

    // First compute smoothed version (moving average with periodic wrapping)
    const smoothed = new Array(points.length).fill(0);
    const len = points.length;
    
    for (let i = 0; i < len; i++) {
      let sum = 0;
      
      for (let j = -windowSize; j <= windowSize; j++) {
        const idx = (i + j + len) % len;
        sum += points[idx];
      }
      smoothed[i] = sum / (2 * windowSize + 1);
    }
    
    // If in sharpen mode, apply unsharp masking: sharpened = original + amount * (original - smoothed)
    if (isSharpMode) {
      const sharpAmount = 1 + (strength / 100) * 3; // 1x to 4x sharpening
      const result = new Array(len).fill(0);
      for (let i = 0; i < len; i++) {
        const highFreq = points[i] - smoothed[i];
        result[i] = Math.max(-1, Math.min(1, points[i] + highFreq * sharpAmount));
      }
      return result;
    }

    return smoothed;
  }, [isSharpMode]);

  // Initialize rawPoints from harmonics if empty or if harmonics changed externally
  useEffect(() => {
     // Check if harmonics changed externally (not by us)
     // We can't easily detect "by us" vs "external" without a flag or deep comparison.
     // But `onDrawComplete` passes new harmonics up.
     // If `harmonics` prop changes, and it's DIFFERENT from what we last thought it was...
     
     // Simple approach: When `isDrawMode` becomes true, OR if `harmonics` change while NOT drawing:
     const hasHarmonicsChanged = harmonics !== lastHarmonicsRef.current;
     
     if (hasHarmonicsChanged) {
         if (canvasRef.current) {
             const { width } = canvasRef.current;
             // Regenerate raw buffer from current effective harmonics
             rawPointsRef.current = generateWaveformFromHarmonics(effectiveHarmonics, width, harmonicCount);
         }
         lastHarmonicsRef.current = harmonics;
     }
  }, [harmonics, effectiveHarmonics, harmonicCount, isDrawMode]);
  
  // Re-run smoothing when slider changes without drawing
  // Handle commiting the smoothing (expensive operation)
  const handleSmoothingCommit = useCallback(() => {
    if (rawPointsRef.current.length > 0) {
        const smoothedPoints = smoothWaveform(rawPointsRef.current, smoothing);
      const rawHarmonics = computeHarmonicsFromWaveform(smoothedPoints, harmonicCount);
      const newHarmonics = loadHarmonics(rawHarmonics, harmonicCount);
        
        lastHarmonicsRef.current = newHarmonics; // optimistic update
        onDrawComplete(newHarmonics);
    }
  }, [smoothing, smoothWaveform, onDrawComplete, harmonicCount]);

  // Global pointer up handler for slider dragging
  useEffect(() => {
    if (isSmoothingDragging) {
      const handleGlobalPointerUp = () => {
        setIsSmoothingDragging(false);
        handleSmoothingCommit();
      };
      
      window.addEventListener('pointerup', handleGlobalPointerUp);
      return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
    }
  }, [isSmoothingDragging, handleSmoothingCommit]);

  // Draw the waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Draw zero-crossing line
    ctx.strokeStyle = "#334155"; // slate-700
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw grid lines (subtle)
    ctx.strokeStyle = "#1e293b"; // slate-800
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Generate waveform from harmonics (Source of Truth for visual)
    // Determine what to display:
    // 1. If smoothing dragging: Show smoothed raw points
    // 2. Normal: Show harmonics
    let samples: number[];
    
    if (isSmoothingDragging && rawPointsRef.current.length > 0) {
      samples = smoothWaveform(rawPointsRef.current, smoothing);
    } else {
      // Source of Truth for visual when not interacting - use effective harmonics
      samples = generateWaveformFromHarmonics(effectiveHarmonics, width, harmonicCount);
    }

    // Draw waveform
    ctx.strokeStyle = "#22d3ee"; // cyan-400
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const val = samples[x] ?? 0;
      const y = centerY - val * (height / 2) * 0.9;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // If in draw mode but not actively drawing, add overlay
    if (isDrawMode && !isDrawingRef.current) {
      ctx.fillStyle = "rgba(249, 115, 22, 0.05)"; // orange-500 subtle
      ctx.fillRect(0, 0, width, height);
    }

    // If actively drawing, show preview
    if (isDrawingRef.current && rawPointsRef.current.length > 0) {
      // We need to visualize the merged result of rawPoints + currentStroke
      // Since currentStroke modifies rawPoints in real-time (in my proposed implementation), 
      // rawPointsRef ALREADY contains the merged result if we update it in mouseMove.
      
      // 1. Draw smoothed preview (opaque/thick) - this is what matters
      const smoothedPoints = smoothWaveform(rawPointsRef.current, smoothing);
      
      ctx.strokeStyle = "#f97316"; // orange-500
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x < smoothedPoints.length; x++) {
        const y = centerY - smoothedPoints[x] * (height / 2) * 0.9;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [effectiveHarmonics, harmonicCount, isDrawMode, smoothing, smoothWaveform, isSmoothingDragging]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawWaveform();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawWaveform]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Re-init raw points on resize to match new width - use effective harmonics
      rawPointsRef.current = generateWaveformFromHarmonics(effectiveHarmonics, canvas.width, harmonicCount);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [effectiveHarmonics, harmonicCount]); // Re-init if harmonics or detuning change

  // Drawing handlers
  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawMode) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Ensure rawPoints are initialized if they happen to be empty (e.g. first click)
      if (rawPointsRef.current.length !== canvas.width) {
           // generateWaveformFromHarmonics likely assumes normalized harmonics?
           // If we pass 0-127, output is scaled by 127.
           // We'll handle scaling in dft utils or here. 
           // Let's defer to dft utils update. Assuming dft utils will handle 0-127 -> -1..1
           rawPointsRef.current = generateWaveformFromHarmonics(effectiveHarmonics, canvas.width, harmonicCount);
      }

      isDrawingRef.current = true;
      setIsActivelyDrawing(true);
      currentStrokePointsRef.current.clear();
      setSmoothing(0); // Reset to show raw waveform during drawing

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(e.clientX - rect.left);
      const y = e.clientY - rect.top;
      const amplitude = yToAmplitude(y, canvas.height); // returns -1 to 1

      if (x >= 0 && x < canvas.width) {
          rawPointsRef.current[x] = amplitude;
          currentStrokePointsRef.current.set(x, amplitude);
      }
    },
    [isDrawMode, yToAmplitude, effectiveHarmonics, harmonicCount]
  );


  
  // Enhance MouseMove to interpolate
  const lastMousePosRef = useRef<{x: number, y: number} | null>(null);
  
  // Wrap handlers to track last pos
  const handleMouseDownWrapped = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
      handleMouseDown(e);
      const canvas = canvasRef.current;
      if (canvas) {
          const rect = canvas.getBoundingClientRect();
          lastMousePosRef.current = {
              x: Math.floor(e.clientX - rect.left),
              y: yToAmplitude(e.clientY - rect.top, canvas.height)
          };
      }
  }, [handleMouseDown, yToAmplitude]);
  
  const handleMouseMoveWrapped = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawMode || !isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const currentX = Math.floor(e.clientX - rect.left);
      const currentAmp = yToAmplitude(e.clientY - rect.top, canvas.height);
      
      if (lastMousePosRef.current) {
          const { x: lastX, y: lastAmp } = lastMousePosRef.current;
          
          // Interpolate
          const dist = Math.abs(currentX - lastX);
          const step = currentX > lastX ? 1 : -1;
          
          for (let i = 0; i <= dist; i++) {
              const x = lastX + i * step;
              const t = i / dist;
              const val = dist === 0 ? currentAmp : lastAmp + (currentAmp - lastAmp) * t;
              
              if (x >= 0 && x < rawPointsRef.current.length) {
                  rawPointsRef.current[x] = val;
              }
          }
      }
      
      lastMousePosRef.current = { x: currentX, y: currentAmp };
  }, [isDrawMode, yToAmplitude]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawMode || !isDrawingRef.current) return;

    isDrawingRef.current = false;
    setIsActivelyDrawing(false);
    currentStrokePointsRef.current.clear(); // End stroke
    lastMousePosRef.current = null;

    // Apply smoothing to the updated raw points
    const smoothedPoints = smoothWaveform(rawPointsRef.current, smoothing);

    // Convert to harmonics via DFT
    const rawHarmonics = computeHarmonicsFromWaveform(smoothedPoints, harmonicCount);
    const newHarmonics = loadHarmonics(rawHarmonics, harmonicCount);
    
    // Update
    lastHarmonicsRef.current = newHarmonics;
    onDrawComplete(newHarmonics);
  }, [isDrawMode, onDrawComplete, smoothing, smoothWaveform, harmonicCount]);

  return (
    <div ref={containerRef} className={cn("relative w-full h-full", className)}>
      <canvas
        ref={canvasRef}
        className={cn(
          "w-full h-full rounded-lg touch-none",
          isDrawMode && "cursor-crosshair"
        )}
        onMouseDown={handleMouseDownWrapped}
        onMouseMove={handleMouseMoveWrapped}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        // Add touch events for mobile/tablet support if needed later
      />

      {/* Draw mode controls */}
      <div 
        className={cn(
          "absolute top-2 right-2 flex items-center gap-3 bg-slate-900/50 backdrop-blur-sm p-1 rounded-full border border-slate-800 transition-all duration-300",
          isActivelyDrawing && "opacity-10 pointer-events-none"
        )}
      >
        {isDrawMode && (
             <div className="flex items-center gap-2 pl-3 pr-1 animate-in fade-in slide-in-from-right-4 duration-300">
            <span
              className={cn(
                "text-[10px] font-mono uppercase tracking-wider cursor-default select-none transition-colors",
                isSharpMode ? "text-pink-400" : "text-slate-400"
              )}
              onDoubleClick={() => setIsSharpMode(prev => !prev)}
            >
              {isSharpMode ? "Sharp" : "Smooth"}
            </span>
                <div className="w-24" onPointerDown={() => setIsSmoothingDragging(true)}>
                    <Slider
                        value={smoothing}
                        onValueChange={(v) => {
                            setSmoothing(v);
                            if (!isSmoothingDragging) setIsSmoothingDragging(true);
                        }}
                        min={0}
                        max={100}
                        step={1}
                        className="[&_[data-slider-track]]:h-1 [&_[data-slider-thumb]]:h-3 [&_[data-slider-thumb]]:w-3"
                    />
                </div>
             </div>
        )}

        <Button
          variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full group",
            isDrawMode && "bg-orange-500 text-white hover:bg-orange-600 hover:text-white"
            )}
            onClick={() => onDrawModeChange(!isDrawMode)}
        >
            <Pencil
            className={cn(
              "h-4 w-4 text-white/50 transition-colors",
              !isDrawMode && "group-hover/button:text-slate-500",
              isDrawMode && "drop-shadow-sm text-white"
            )}
            />
        </Button>
      </div>
    </div>
  );
}
