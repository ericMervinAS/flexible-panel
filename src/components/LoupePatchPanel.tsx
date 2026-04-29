import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, ArrowCounterClockwiseIcon, X, CubeFocusIcon, FlaskIcon, MagnifyingGlassIcon, Plus } from "@phosphor-icons/react";
import type { DistractionDetection } from "@/lib/distractionDetection";
import SuggestObjectModal from "./SuggestObjectModal";
import Tooltip from "./Tooltip";

const MODEL_TO_UI: Record<string, string> = {
  "Exit Sign": "Exit Signs",
  "Smoke Detector": "Fire Alarms",
  "Fire Extinguisher": "Fire Extinguishers",
  "Electrical Outlet": "Electricity Sockets",
  "Thermostat": "Thermostats",
  "Trash Can": "Garbage Cans",
};

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

const Toggle = ({ checked, onChange }: ToggleProps) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative flex items-center p-0.5 rounded-full w-8 h-[18px] transition-colors shrink-0 ${checked ? "bg-[#2563eb]" : "bg-[#303030]"
      }`}
  >
    <div
      className={`w-3 h-3 rounded-full transition-transform duration-200 ${checked ? "translate-x-[14px] bg-white" : "translate-x-0 bg-[#ababab]"
        }`}
    />
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface LoupePatchPanelProps {
  onScrollChange?: (atBottom: boolean) => void;
  currentImageIndex?: number;
  canvasHasStrokes?: boolean;
  onClearCanvas?: () => void;
  onRemoveAfterStrokeChange?: (v: boolean) => void;
  onRemovingChange?: (v: boolean) => void;
  distractionMap?: Map<number, DistractionDetection[]>;
  isModelScanning?: boolean;
  onRerun?: () => void;
  onReport?: () => void;
  onSuggestSubmit?: (suggestion: string) => void;
  removedItems?: Set<string>;
  onRemove?: (labels: Set<string>) => void;
  onResetItem?: (label: string) => void;
  onSelectedLabelsChange?: (labels: Set<string>) => void;
  onHoveredLabelChange?: (label: string | null) => void;
  onRemoveSuccess?: (count: number, brushOnly: boolean) => void;
}

const LoupePatchPanel = ({
  onScrollChange: _onScrollChange,
  currentImageIndex = 0,
  canvasHasStrokes = false,
  onClearCanvas,
  onRemoveAfterStrokeChange,
  onRemovingChange,
  distractionMap,
  isModelScanning = false,
  onRerun,
  onReport,
  onSuggestSubmit,
  removedItems = new Set(),
  onRemove,
  onResetItem,
  onSelectedLabelsChange,
  onHoveredLabelChange,
  onRemoveSuccess,
}: LoupePatchPanelProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removeAfterStroke, setRemoveAfterStroke] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [pendingReset, setPendingReset] = useState<{ label: string; count: number } | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [hasRescanned, setHasRescanned] = useState(false);
  const [flaskHovered, setFlaskHovered] = useState(false);

  const handleRerun = () => {
    setHasRescanned(true);
    onRerun?.();
  };

  const handleSuggestSubmit = (suggestion: string) => {
    onSuggestSubmit?.(suggestion);
    setShowSuggestModal(false);
  };


  const detected = useMemo(() => {
    const imageDets = distractionMap?.get(currentImageIndex) ?? [];
    const countMap = new Map<string, number>();
    for (const det of imageDets) {
      const uiLabel = MODEL_TO_UI[det.label];
      if (uiLabel) countMap.set(uiLabel, (countMap.get(uiLabel) ?? 0) + 1);
    }
    return Array.from(countMap.entries()).map(([label, count]) => ({ label, count }));
  }, [distractionMap, currentImageIndex]);

  const hasScanned = distractionMap !== undefined;

  // Non-removed first, removed at the bottom — same ordering as SmartObjectRemoval
  const orderedItems = [
    ...detected.filter((d) => !removedItems.has(d.label)),
    ...detected.filter((d) => removedItems.has(d.label)),
  ];

  // Notify parent when removal state changes so canvas loader can be shown
  useEffect(() => {
    onRemovingChange?.(isRemoving);
  }, [isRemoving]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset selection state on mount and image change
  useEffect(() => {
    const empty = new Set<string>();
    setSelected(empty);
    onSelectedLabelsChange?.(empty);
    setIsRemoving(false);
    setPendingReset(null);
    onHoveredLabelChange?.(null);
  }, [currentImageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Item toggle ───────────────────────────────────────────────────────────
  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      onSelectedLabelsChange?.(next);
      return next;
    });
  };

  // ── Restore ───────────────────────────────────────────────────────────────
  const handleResetClick = (label: string, count: number) => {
    if (skipConfirmation) {
      onResetItem?.(label);
      return;
    }
    setPendingReset({ label, count });
  };

  const confirmReset = () => {
    if (!pendingReset) return;
    onResetItem?.(pendingReset.label);
    setPendingReset(null);
  };

  // ── Remove ────────────────────────────────────────────────────────────────
  const totalObjectCount =
    detected
      .filter((d) => selected.has(d.label))
      .reduce((sum, d) => sum + d.count, 0) +
    (canvasHasStrokes ? 1 : 0);

  const removeLabel =
    totalObjectCount > 1 ? `Remove ${totalObjectCount} Objects` : "Remove Object";

  const canRemove = !isRemoving && (selected.size > 0 || (canvasHasStrokes && !removeAfterStroke));

  const handleRemove = () => {
    if (!canRemove) return;
    const toRemove = new Set(selected);
    const removedCount = detected
      .filter((d) => toRemove.has(d.label))
      .reduce((sum, d) => sum + d.count, 0);
    const brushOnly = toRemove.size === 0 && canvasHasStrokes;
    setIsRemoving(true);
    setTimeout(() => {
      onClearCanvas?.();
      onRemove?.(toRemove);
      const empty = new Set<string>();
      setSelected(empty);
      onSelectedLabelsChange?.(empty);
      setIsRemoving(false);
      onRemoveSuccess?.(removedCount, brushOnly);
    }, 2200);
  };

  const itemsDisabled = isModelScanning || isRemoving;

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6"
      style={{ scrollbarWidth: "none" }}
    >
      {/* ── Smart Object ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">

        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-normal text-[#e2e2e2] leading-5">Smart Object Removal</span>
            {/* <span className="px-1 py-0.5 text-[11px] font-medium leading-3 rounded backdrop-blur-[2px] bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.4)] text-[#e2e2e2]">
              Beta
            </span> */}
            <span
              className="relative inline-flex"
              onMouseEnter={() => setFlaskHovered(true)}
              onMouseLeave={() => setFlaskHovered(false)}
            >
              <Tooltip label="Beta" visible={flaskHovered} />
              <FlaskIcon className="w-4 h-4" weight="fill" color="#EAB308" />
            </span>
          </div>

          {/* Scan icon */}
          <button
            onClick={handleRerun}
            disabled={isModelScanning || isRemoving}
            title="Rerun object scan"
            className={`flex items-center justify-center w-6 h-6 rounded transition-opacity ${isRemoving
              ? "opacity-30 cursor-not-allowed"
              : isModelScanning
                ? "opacity-60 cursor-not-allowed"
                : "opacity-70 hover:opacity-100 cursor-pointer"
              }`}
          >
            {isModelScanning ? (
              <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
            ) : (
              <MagnifyingGlassIcon className="w-5 h-5 text-[#555]" />
            )}
          </button>
        </div>

        {/* Empty state */}
        {!isModelScanning && hasScanned && detected.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-1">
            <div className="flex flex-col items-center justify-center gap-4 p-5 rounded-lg bg-[#242424] w-full">
              <MagnifyingGlassIcon className="w-8 h-8 text-[#e2e2e2]" weight="duotone" />
              <div className="flex flex-col gap-1 text-center w-full">
                <p className="text-[16px] font-semibold text-[#e2e2e2] leading-5">No distractions detected</p>
                <p className="text-[13px] font-normal text-[#ababab] leading-4">Think we missed something?</p>
              </div>
              <div className="flex items-center justify-center gap-2 w-full">
                <button
                  onClick={handleRerun}
                  className="flex items-center justify-center min-w-[44px] px-3 py-2 rounded bg-[#303030] hover:bg-[#3a3a3a] transition-colors"
                >
                  <span className="text-[12px] font-medium text-[#e2e2e2] leading-4">Rescan Album</span>
                </button>
                {hasRescanned && (
                  <button
                    onClick={onReport}
                    className="flex items-center justify-center min-w-[44px] px-3 py-2 rounded hover:bg-white/5 transition-colors"
                  >
                    <span className="text-[12px] font-medium text-[#ababab] leading-4">Report Issue</span>
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowSuggestModal(true)}
              className="group relative flex items-center justify-center gap-2 h-9 w-full rounded-[8px] bg-[#1f1f1f] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#3a3a3a] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#2a2a2a] group-hover:bg-[#333333] transition-colors">
                <Plus className="w-2.5 h-2.5 text-[#ababab]" weight="bold" />
              </div>
              <span className="text-[12px] font-medium text-[#ababab] group-hover:text-[#e2e2e2] transition-colors">Suggest a new object</span>
            </button>
          </div>
        )}

        {/* Detected items grid */}
        {(!hasScanned || detected.length > 0) && (
          <div className={`grid grid-cols-2 gap-1.5 transition-opacity ${itemsDisabled ? "opacity-40 pointer-events-none" : ""}`}>
            {orderedItems.map((d) => {
              const isItemRemoved = removedItems.has(d.label);
              const isSelected = selected.has(d.label);

              if (isItemRemoved) {
                return (
                  <button
                    key={d.label}
                    onClick={() => handleResetClick(d.label, d.count)}
                    className="flex items-center justify-between h-9 px-2 rounded-[6px] bg-[#242424] hover:bg-[#2a2a2a] transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[11px] text-[#555] leading-4 truncate">{d.label}</span>
                      <span className="text-[10px] font-medium text-[#474747] leading-3 shrink-0">{d.count}</span>
                    </div>
                    <div className="shrink-0 relative w-3 h-3">
                      <Check className="absolute top-0 left-0 w-3 h-3 text-[#16a34a] transition-opacity group-hover:opacity-0" />
                      <ArrowCounterClockwiseIcon className="absolute top-0 left-0 w-3 h-3 text-[#555] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={d.label}
                  onClick={() => toggle(d.label)}
                  onMouseEnter={() => !itemsDisabled && onHoveredLabelChange?.(d.label)}
                  onMouseLeave={() => !itemsDisabled && onHoveredLabelChange?.(null)}
                  className={`flex items-center justify-between h-9 px-2 rounded-[6px] bg-[#242424] transition-colors text-left ${itemsDisabled ? "cursor-not-allowed" : "hover:bg-[#2a2a2a] cursor-pointer"
                    }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[11px] text-[#e2e2e2] leading-4 truncate">{d.label}</span>
                    <span className="text-[10px] font-medium text-[#777] leading-3 shrink-0">{d.count}</span>
                  </div>
                  <div
                    className={`shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center transition-colors ${isSelected ? "bg-[#2563eb]" : "border border-[#474747] bg-transparent"
                      }`}
                  >
                    {isSelected && <Check className="w-2 h-2 text-white stroke-[3]" />}
                  </div>
                </button>
              );
            })}
            {detected.length > 0 && (
              <button
                onClick={() => setShowSuggestModal(true)}
                className="group relative flex items-center justify-center gap-2 h-9 w-full rounded-[8px] bg-[#1f1f1f] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#3a3a3a] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#2a2a2a] group-hover:bg-[#333333] transition-colors">
                  <Plus className="w-2.5 h-2.5 text-[#ababab]" weight="bold" />
                </div>
                <span className="text-[12px] font-medium text-[#ababab] group-hover:text-[#e2e2e2] transition-colors">Suggest objects</span>
              </button>
            )}
          </div>
        )}

        {/* {detected.length > 0 && (
          <button
            onClick={() => setShowSuggestModal(true)}
            className="group relative mt-1 flex items-center justify-center gap-2 h-9 w-full rounded-[8px] bg-[#1f1f1f] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#3a3a3a] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#2a2a2a] group-hover:bg-[#333333] transition-colors">
              <Plus className="w-2.5 h-2.5 text-[#ababab]" weight="bold" />
            </div>
            <span className="text-[12px] font-medium text-[#ababab] group-hover:text-[#e2e2e2] transition-colors">Suggest a new object</span>
          </button>
        )} */}

        {/* Remove CTA — matches Grid View processing style */}
        {/* <button
          disabled={!canRemove}
          onClick={handleRemove}
          className={`flex items-center justify-center gap-2 h-9 w-full px-3 rounded text-[12px] font-medium transition-colors ${isRemoving
            ? "bg-[#1d56d1] text-white cursor-not-allowed"
            : canRemove
              ? "bg-[#2563eb] text-white hover:bg-[#1d56d1] cursor-pointer"
              : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
            }`}
        >
          <span>{isRemoving ? "Removing…" : removeLabel}</span>
        </button> */}
      </div>

      <button
        disabled={!canRemove}
        onClick={handleRemove}
        className={`flex items-center mt-1 justify-center gap-2 h-9 w-full px-3 rounded text-[12px] font-medium transition-colors ${isRemoving
          ? "bg-[#1d56d1] text-white cursor-not-allowed"
          : canRemove
            ? "bg-[#2563eb] text-white hover:bg-[#1d56d1] cursor-pointer"
            : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
          }`}
      >
        <span>{isRemoving ? "Removing…" : removeLabel}</span>
      </button>

      <div className="h-[1px] w-full bg-[#e2e2e20d]"></div>

      {/* ── Brush Options ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* <span className="text-[11px] font-semibold tracking-[0.5px] uppercase text-[#ababab] leading-3">
          Brush Options
        </span> */}

        <span className="text-[14px] font-normal text-[#e2e2e2] leading-5">Brush Options</span>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-normal text-[#e2e2e2] leading-5">
              Remove after each stroke
            </span>
            {/* <span className="text-[11px] text-[#ababab] leading-4">
              Review each removal
            </span> */}
          </div>
          <Toggle
            checked={removeAfterStroke}
            onChange={(v) => {
              setRemoveAfterStroke(v);
              onRemoveAfterStrokeChange?.(v);
              if (v && canvasHasStrokes) onClearCanvas?.();
            }}
          />
        </div>


      </div>



      {/* ── Restore confirmation modal (same as SmartObjectRemoval) ───────── */}
      {pendingReset && createPortal(
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-[#1c1c1c] border border-[#303030] rounded-[12px] p-5 flex flex-col gap-4 w-[448px]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1 pt-0.5">
                <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
                  Reset Object Removal
                </h3>
                <p className="text-[14px] font-normal text-[#ababab] leading-5">
                  This will restore {pendingReset.count} photo{pendingReset.count > 1 ? "s" : ""} affected by "{pendingReset.label}".
                </p>
              </div>
              <button
                onClick={() => setPendingReset(null)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4 text-[#777]" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSkipConfirmation((v) => !v)}
                className="flex items-center gap-1.5 shrink-0"
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${skipConfirmation ? "bg-[#2563eb] border-[#2563eb]" : "bg-[#303030] border-[#474747]"
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

      {showSuggestModal && (
        <SuggestObjectModal
          onClose={() => setShowSuggestModal(false)}
          onSubmit={handleSuggestSubmit}
        />
      )}
    </div>
  );
};

export default LoupePatchPanel;
