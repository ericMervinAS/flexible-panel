import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ArrowCounterClockwise, X } from "@phosphor-icons/react";

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
  onResetConfirmed?: (label: string, count: number) => void;
  onSelectionsChange?: (hasSelections: boolean) => void;
  onStateChange?: (state: SmartObjectState) => void;
}

const SmartObjectRemoval = ({
  isScanning,
  disabled,
  resetSignal,
  removedItems,
  onResetItem,
  onResetConfirmed,
  onSelectionsChange,
  onStateChange,
}: SmartObjectRemovalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingReset, setPendingReset] = useState<{ label: string; count: number } | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState(false);

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

  const handleResetClick = (label: string, count: number) => {
    if (skipConfirmation) {
      onResetItem?.(label);
      onResetConfirmed?.(label, count);
      return;
    }
    setPendingReset({ label, count });
  };

  const confirmReset = () => {
    if (!pendingReset) return;
    onResetItem?.(pendingReset.label);
    onResetConfirmed?.(pendingReset.label, pendingReset.count);
    setPendingReset(null);
  };

  return (
    <>
      <div className={`px-5 flex flex-col gap-3 transition-opacity ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
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
              ...distractions.filter((d) => !removedItems?.has(d.label) && d.count > 0),
              ...distractions.filter((d) => removedItems?.has(d.label)),
              ...distractions.filter((d) => !removedItems?.has(d.label) && d.count === 0),
            ].map((d) => {
              const isRemoved = removedItems?.has(d.label) ?? false;
              const isSelected = selected.has(d.label);
              const isDisabled = d.count === 0;

              if (isRemoved) {
                return (
                  <button
                    key={d.label}
                    onClick={() => handleResetClick(d.label, d.count)}
                    className="flex items-center justify-between h-9 px-2 rounded-[6px] bg-[#242424] hover:bg-[#2a2a2a] transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[11px] text-[#e2e2e2] leading-4 truncate">{d.label}</span>
                      <span className="text-[10px] font-medium text-[#777] leading-3 shrink-0">{d.count}</span>
                    </div>
                    <div className="shrink-0 relative w-3 h-3">
                      <Check className="absolute top-0 left-0 w-3 h-3 text-[#16a34a] transition-opacity group-hover:opacity-0" />
                      <ArrowCounterClockwise className="absolute top-0 left-0 w-3 h-3 text-[#555] opacity-0 transition-opacity group-hover:opacity-100" />
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

      {/* Reset confirmation modal */}
      {pendingReset && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-[#1c1c1c] border border-[#303030] rounded-[12px] p-5 flex flex-col gap-4 w-[448px]">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1 pt-0.5">
                <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
                  Reset Object Removal
                </h3>
                <p className="text-[14px] font-normal text-[#ababab] leading-5">
                  This will restore {pendingReset.count} photos affected by "{pendingReset.label}".
                </p>
              </div>
              <button
                onClick={() => setPendingReset(null)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4 text-[#777]" />
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2">
              {/* Don't ask again */}
              <button
                onClick={() => setSkipConfirmation((v) => !v)}
                className="flex items-center gap-1.5 shrink-0"
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  skipConfirmation ? "bg-[#2563eb] border-[#2563eb]" : "bg-[#303030] border-[#474747]"
                }`}>
                  {skipConfirmation && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                </div>
                <span className="text-[12px] text-[#777]">Don't ask again</span>
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setPendingReset(null)}
                  className="px-4 py-2 rounded bg-[#303030] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReset}
                  className="px-4 py-2 rounded bg-[#dc2626] text-[14px] font-medium text-white hover:bg-[#b91c1c] transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SmartObjectRemoval;
