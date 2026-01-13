import { useState } from "react";
import { Download, X, FileJson, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { type Preset } from "@/types";
import { exportPresets } from "@/lib/storage";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreset: Preset;
}

export function ExportDialog({ isOpen, onClose, currentPreset }: ExportDialogProps) {
  const [scope, setScope] = useState<"single" | "all">("single");
  const [format, setFormat] = useState<"minified" | "full">("minified");

  // State resets automatically because component unmounts when !isOpen

  if (!isOpen) return null;

  const handleExport = () => {
    exportPresets({
      scope,
      format,
      targetPreset: currentPreset,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <Download className="w-5 h-5 text-cyan-400" />
                Export Presets
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-slate-400">
              Choose what and how you want to export.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Scope Selection */}
            <div className="space-y-3">
              <Label className="text-slate-300 text-sm font-medium">Export Scope</Label>
              <div className="grid grid-cols-2 gap-3">
                <label 
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-md border-2 cursor-pointer transition-all
                    ${scope === 'single' 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-100' 
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:bg-slate-800'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="single"
                    checked={scope === "single"}
                    onChange={() => setScope("single")}
                    className="sr-only"
                  />
                  <FileJson className="w-6 h-6 mb-2 opacity-80" />
                  <span className="text-sm font-semibold">Current Only</span>
                  <span className="text-[10px] opacity-70 mt-1">Just "{currentPreset.name}"</span>
                </label>

                <label 
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-md border-2 cursor-pointer transition-all
                    ${scope === 'all' 
                      ? 'border-cyan-500 bg-cyan-950/20 text-cyan-100' 
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:bg-slate-800'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                    className="sr-only"
                  />
                  <Layers className="w-6 h-6 mb-2 opacity-80" />
                  <span className="text-sm font-semibold">All Presets</span>
                  <span className="text-[10px] opacity-70 mt-1">Entire Library</span>
                </label>
              </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-slate-300 text-sm font-medium">Output Format</Label>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setFormat("minified")}
                  className={`
                    flex-1 flex items-center justify-center py-1.5 text-xs font-medium rounded-md transition-all
                    ${format === 'minified'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                    }
                  `}
                >
                  Compressed (Sparse)
                </button>
                <button
                  onClick={() => setFormat("full")}
                  className={`
                    flex-1 flex items-center justify-center py-1.5 text-xs font-medium rounded-md transition-all
                    ${format === 'full'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300'
                    }
                  `}
                >
                  Full (Verbose)
                </button>
              </div>
              <p className="text-[11px] text-slate-500 px-1">
                {format === 'minified' 
                  ? "Removes zero-amplitude harmonics and defaults. Minimal file size." 
                  : "Includes all 32 harmonics with extensive detail. Larger file size."}
              </p>
            </div>

          </CardContent>
          
          <CardFooter className="pt-2">
            <Button 
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
              onClick={handleExport}
            >
              Download JSON
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
