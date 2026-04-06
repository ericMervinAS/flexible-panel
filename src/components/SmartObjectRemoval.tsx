import { useState, useEffect } from "react";
import { Check, RotateCcw } from "lucide-react";

const distractions = [
  { label: "Exit Signs", count: 30 },
  { label: "Fire Alarms", count: 80 },
  { label: "Fire Extinguishers", count: 3 },
  { label: "Electricity Sockets", count: 40 },
  { label: "Thermostats", count: 8 },
  { label: "Garbage Cans", count: 0 },
];

export interface SmartObjectState {
  selectedWithCounts: { label: string; count: number }[];
}

interface SmartObjectRemovalProps {
  isScanning: boolean;
  disabled?: boolean;
  resetSignal?: number;
  removedItems?: Set<string>;
  onResetItem?: (label: string) => void;
  onSelectionsChange?: (hasSelections: boolean) => void;
  onStateChange?: (state: SmartObjectState) => void;
}

const SmartObjectRemoval = ({
  isScanning,
  disabled,
  resetSignal,
  removedItems,
  onResetItem,
  onSelectionsChange,
  onStateChange,
}: SmartObjectRemovalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!resetSignal) return;
    setSelected(new Set());
    onSelectionsChange?.(false);
    onStateChange?.({ selectedWithCounts: [] });
  }, [resetSignal]);

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      onSelectionsChange?.(next.size > 0);
      onStateChange?.({
        selectedWithCounts: distractions
          .filter((d) => next.has(d.label))
          .map((d) => ({ label: d.label, count: d.count })),
      });
      return next;
    });
  };

  return (
    <div className={`px-5 pb-4 flex flex-col gap-3 transition-opacity ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-normal text-[#e2e2e2]">Smart Object Removal</h3>
          <span className="px-1 py-0.5 text-[11px] font-medium leading-[12px] rounded backdrop-blur-[2px] bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.4)] text-[#e2e2e2]">
            Beta
          </span>
          {isScanning && (
            <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
          )}
        </div>
        <p className="text-[12px] text-[#ababab] leading-4">
          Smart object detection will automatically identify and remove distractions you select
        </p>
      </div>

      {!isScanning && (
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ...distractions.filter((d) => !(removedItems?.has(d.label))),
            ...distractions.filter((d) => removedItems?.has(d.label)),
          ].map((d) => {
            const isRemoved = removedItems?.has(d.label) ?? false;
            const isSelected = selected.has(d.label);
            const isDisabled = d.count === 0;

            if (isRemoved) {
              return (
                <button
                  key={d.label}
                  onClick={() => onResetItem?.(d.label)}
                  className="flex items-center justify-between h-9 px-2 rounded-[6px] bg-[#242424] hover:bg-[#2a2a2a] transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[11px] text-[#555] leading-4 truncate">{d.label}</span>
                    <span className="text-[10px] font-medium text-[#474747] leading-3 shrink-0">{d.count}</span>
                  </div>
                  <div className="shrink-0 relative w-3 h-3">
                    <Check className="absolute top-0 left-0 w-3 h-3 text-[#16a34a] transition-opacity group-hover:opacity-0" />
                    <RotateCcw className="absolute top-0 left-0 w-3 h-3 text-[#555] opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              );
            }

            return (
              <button
                key={d.label}
                disabled={isDisabled}
                onClick={() => toggle(d.label)}
                className={`flex items-center justify-between h-9 px-2 rounded-[6px] bg-[#242424] transition-colors text-left ${
                  isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#2a2a2a] cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] text-[#e2e2e2] leading-4 truncate">{d.label}</span>
                  <span className="text-[10px] font-medium text-[#777] leading-3 shrink-0">{d.count}</span>
                </div>
                <div
                  className={`shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center transition-colors ${
                    isSelected ? "bg-[#2563eb]" : "border border-[#474747] bg-transparent"
                  }`}
                >
                  {isSelected && <Check className="w-2 h-2 text-white stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SmartObjectRemoval;
