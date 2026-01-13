import type { Preset } from "@/types";
import { loadHarmonics, compressHarmonics } from "./presets";

const STORAGE_KEY = "synadd_user_presets";

export function loadUserPresets(): Preset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load presets", e);
    return [];
  }
}

export function saveUserPreset(preset: Preset): void {
  const current = loadUserPresets();
  // Overwrite if exists, otherwise append
  const index = current.findIndex((p) => p.name === preset.name);
  if (index >= 0) {
    current[index] = preset;
  } else {
    current.push(preset);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function deleteUserPreset(name: string): void {
  const current = loadUserPresets();
  const filtered = current.filter((p) => p.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export interface ExportOptions {
  scope: 'single' | 'all';
  format: 'minified' | 'full';
  targetPreset?: Preset;
}

export function exportPresets(options: ExportOptions): void {
  // Determine what to export
  let dataToExport: unknown;

  if (options.scope === 'single') {
    if (!options.targetPreset) throw new Error("Target preset required for single export");
    const p = options.targetPreset;
    const exportObj = {
      name: p.name,
      harmonics: options.format === 'minified' ? compressHarmonics(p.harmonics) : p.harmonics
    };
    // Normalize to array for consistent JSON format
    dataToExport = [exportObj]; 
  } else {
    const presets = loadUserPresets();
    dataToExport = presets.map(p => ({
      name: p.name,
      harmonics: options.format === 'minified' ? compressHarmonics(p.harmonics) : p.harmonics
    }));
  }

  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `synadd_presets_${options.scope}_${options.format}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Define expected structure for imported JSON
interface RawPreset {
  name: unknown;
  harmonics: unknown;
}

function isRawPreset(p: unknown): p is RawPreset {
  return (
    typeof p === 'object' && 
    p !== null && 
    'name' in p && 
    'harmonics' in p
  );
}

export async function importPresets(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        let parsed: unknown = JSON.parse(content);
        
        // Normalize single object to array
        if (!Array.isArray(parsed)) {
          parsed = [parsed];
        }

        const newPresets: Preset[] = (parsed as unknown[]).map((p) => {
           if (!isRawPreset(p) || typeof p.name !== 'string' || !Array.isArray(p.harmonics)) {
             throw new Error("Invalid preset format");
           }
           
           // Hydrate sparse harmonics if needed
           // loadHarmonics handles both sparse and full-ish inputs
           return {
             name: p.name,
             // We know p.harmonics is any[] (from Array.isArray check) but TypeScript needs help
             // Using 'as any' here is unavoidable without a complex recursive type check for Harmonic structure,
             // but we've validated it's an array. loadHarmonics will handle the Items.
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             harmonics: loadHarmonics(p.harmonics as any[])
           };
        });
        
        const current = loadUserPresets();
        // Merge strategy: incoming overwrites existing names
        const merged = [...current];
        for (const p of newPresets) {
            const idx = merged.findIndex((mp) => mp.name === p.name);
            if (idx >= 0) merged[idx] = p;
            else merged.push(p);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
