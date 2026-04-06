import { Sparkles } from "lucide-react";
import { useState } from "react";

const distractions = [
  { label: "Exit Signs", count: 30 },
  { label: "Fire Alarms", count: 80 },
  { label: "Fire Extinguishers", count: 3 },
  { label: "Electricity Sockets", count: 40 },
  { label: "Thermostats", count: 8 },
  { label: "Garbage Cans", count: 0 },
];

interface SmartObjectRemovalProps {
  isScanning: boolean;
}

const SmartObjectRemoval = ({ isScanning }: SmartObjectRemovalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-foreground">Smart Object Removal</h3>
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-warning text-primary-foreground">
          Beta
        </span>
        {isScanning && (
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Smart object detection will automatically identify and remove distractions you select
      </p>

      {!isScanning && (
        <div className="grid grid-cols-2 gap-2">
          {distractions.map((d) => (
            <label
              key={d.label}
              className={`flex items-center justify-between px-3 py-2 rounded border cursor-pointer transition-colors text-xs ${
                selected.has(d.label)
                  ? "border-primary bg-accent"
                  : "border-border hover:border-muted-foreground"
              } ${d.count === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
              onClick={() => d.count > 0 && toggle(d.label)}
            >
              <span className="text-secondary-foreground">{d.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{d.count}</span>
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                    selected.has(d.label)
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {selected.has(d.label) && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartObjectRemoval;
