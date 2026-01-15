import { ExportDialog } from "./ExportDialog";
import { Save, Trash2, Download, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState, useRef } from "react";
import { BUILT_IN_PRESETS } from "@/lib/presets";
import { type Preset, type Harmonic } from "@/types";
import { 
  loadUserPresets, 
  saveUserPreset, 
  deleteUserPreset, 
  // exportPresets removed (imported in dialog)
  importPresets 
} from "@/lib/storage";

interface PresetsPanelProps {
  onPresetSelect: (harmonics: Harmonic[]) => void;
  currentHarmonics: Harmonic[];
}

export function PresetsPanel({ onPresetSelect, currentHarmonics }: PresetsPanelProps) {
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets());
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ... (refreshUserPresets, handleSave, handleDelete, handleImport same as before) ...
  const refreshUserPresets = () => {
    setUserPresets(loadUserPresets());
  };

  const handleSave = () => {
    if (!newPresetName.trim()) return;
    
    saveUserPreset({
      name: newPresetName.trim(),
      harmonics: currentHarmonics,
    });
    
    setNewPresetName("");
    setIsSaving(false);
    refreshUserPresets();
  };

  const handleDelete = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete preset "${name}"?`)) {
      deleteUserPreset(name);
      refreshUserPresets();
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importPresets(file);
      refreshUserPresets();
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert("Failed to import presets: Invalid file format");
      console.error(err);
    }
  };

  return (
    <>
      <Card className="bg-slate-900 border-slate-800 flex flex-col h-full max-h-[400px]">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-300">
              Presets Library
            </CardTitle>
            <div className="flex gap-1">
               <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-cyan-400"
                title="Export Presets"
                onClick={() => setIsExportOpen(true)}
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-cyan-400"
                title="Import Presets"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".json" 
            onChange={handleImport}
          />

          {/* Single scroll area for all presets */}
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {/* User Presets Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Presets</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 px-2"
                  onClick={() => setIsSaving(!isSaving)}
                >
                  <Save className="h-3 w-3 mr-1" />
                  SAVE NEW
                </Button>
              </div>

              {isSaving && (
                <div className="flex gap-2 mb-2 animate-in slide-in-from-top-2 fade-in duration-200">
                  <Input
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset Name..."
                    className="h-7 text-xs bg-slate-950 border-slate-700 focus-visible:ring-cyan-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") setIsSaving(false);
                    }}
                  />
                  <Button 
                    size="sm" 
                    className="h-7 px-2 bg-cyan-600 hover:bg-cyan-500 text-white"
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {userPresets.length === 0 ? (
                  <div className="col-span-2 text-center py-4 text-xs text-slate-600 italic">
                    No saved presets
                  </div>
                ) : (
                  userPresets.map((preset) => (
                    <div 
                      key={preset.name} 
                      className="group relative flex items-center"
                    >
                      <Button
                        variant="secondary"
                        className="w-full h-10 md:h-8 text-sm md:text-xs bg-slate-800/50 hover:bg-slate-800 text-slate-300 justify-start pl-2 pr-8 truncate"
                        onClick={() => onPresetSelect(preset.harmonics)}
                      >
                        {preset.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 h-8 w-8 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(preset.name, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator className="bg-slate-800 my-4" />

            {/* Built-in Presets Section */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Built-in</h4>
              <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {BUILT_IN_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="secondary"
                    className="h-10 md:h-8 text-sm md:text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 truncate px-2"
                    onClick={() => onPresetSelect(preset.harmonics)}
                    title={preset.name}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExportDialog 
        isOpen={isExportOpen} 
        onClose={() => setIsExportOpen(false)} 
        currentPreset={{
          name: "Current Workbench",
          harmonics: currentHarmonics
        }}
      />
    </>
  );
}
