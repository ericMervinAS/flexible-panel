import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ThermometerIcon,
  DoorOpenIcon,
  BellRingingIcon,
  FireExtinguisherIcon,
} from "@phosphor-icons/react";

// The 4 distraction types Aftershoot currently scans for album-wide —
// fixed set, independent of what's been detected on any single image yet.
const CATEGORIES = [
  "Thermostats",
  "Exit Signs",
  "Fire Alarms",
  "Fire Extinguishers",
];

const CATEGORY_ICON: Record<string, typeof ThermometerIcon> = {
  Thermostats: ThermometerIcon,
  "Exit Signs": DoorOpenIcon,
  "Fire Alarms": BellRingingIcon,
  "Fire Extinguishers": FireExtinguisherIcon,
};

export interface AlbumRemoveResult {
  label: string;
  /** Total instances of this label removed across the album. */
  count: number;
  /** Number of images that had at least one instance removed. */
  imageCount: number;
}

interface AlbumScanModalProps {
  onClose: () => void;
  onFindAndRemove: (labels: string[]) => void;
  /** Number of images this pass is scoped to (a filmstrip multi-selection) —
   *  undefined/1 means the whole album, and the modal's copy says "Album". */
  imageCount?: number;
  /** Non-null while a scan+remove pass triggered from this modal is running. */
  progress?: { percent: number; eta: string } | null;
  onCancelProgress?: () => void;
  /** Non-null once a triggered pass has finished — shows the results screen. */
  result?: AlbumRemoveResult[] | null;
  onRetry?: () => void;
  onDone?: () => void;
}

const DialogShell = ({ children }: { children: ReactNode }) =>
  createPortal(
    <div className="fixed inset-0 bg-[#111111e4] z-50 flex items-center justify-center">
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[12px] p-5 flex flex-col gap-4 w-[448px]">
        {children}
      </div>
    </div>,
    document.body,
  );

const AlbumScanModal = ({
  onClose,
  onFindAndRemove,
  imageCount,
  progress,
  onCancelProgress,
  result,
  onRetry,
  onDone,
}: AlbumScanModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isSelection = !!imageCount && imageCount > 1;
  const scopeNoun = isSelection ? `${imageCount} Images` : "Album";
  const scopePhrase = isSelection ? `${imageCount} selected images` : "album";

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const canSubmit = selected.size > 0;
  const allSelected = selected.size === CATEGORIES.length;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onFindAndRemove(Array.from(selected));
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(CATEGORIES));
  };

  // ── Result: scan+remove finished ────────────────────────────────────────
  if (result) {
    return (
      <DialogShell>
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
            Removed Distractions from {scopeNoun}
          </h3>
          <p className="text-[14px] font-normal text-[#ababab] leading-5">
            The following distractions have been removed successfully from the{" "}
            {scopePhrase}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {result.map((r) => {
            const Icon = CATEGORY_ICON[r.label];
            return (
              <div key={r.label} className="flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-[#e2e2e2] shrink-0" />}
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-medium text-[#e2e2e2] leading-[14px] truncate">
                    {r.count} {r.label}
                  </span>
                  <span className="text-[10px] font-normal text-[#777] leading-[14px] truncate">
                    removed from {r.imageCount} images
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 justify-end">
          {/* <button
            onClick={onRetry}
            className="min-w-[44px] px-4 py-2 rounded bg-[#303030] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors"
          >
            Retry
          </button> */}
          <button
            onClick={onDone}
            className="min-w-[44px] px-4 py-2 rounded bg-[#2563eb] text-[14px] font-medium text-white hover:bg-[#1d56d1] transition-colors"
          >
            Got It
          </button>
        </div>
      </DialogShell>
    );
  }

  // ── Progress: scan+remove in flight ─────────────────────────────────────
  if (progress) {
    return (
      <DialogShell>
        <div className="flex flex-col gap-1 mb-2">
          <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
            Removing Distractions from {scopeNoun}
          </h3>
        </div>

        {/* <div className="h-[163px] w-full rounded-[8px] bg-white/5" /> */}

        <div className="flex flex-col gap-2 w-full">
          <div className="h-1 w-full rounded-full bg-[#303030] overflow-hidden">
            <div
              className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex items-center gap-2 w-full">
            <span className="text-[12px] font-medium text-[#ababab] leading-4">
              {progress.percent}%
            </span>
            <span className="text-[12px] font-normal text-[#ababab] leading-4">
              • {progress.eta}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end w-full">
          <button
            onClick={onCancelProgress}
            className="min-w-[44px] px-4 py-2 rounded bg-[#dc2626] text-[14px] font-medium text-white hover:bg-[#b91c1c] transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogShell>
    );
  }

  // ── Pick: choose which categories to scan for ───────────────────────────
  return (
    <DialogShell>
      <div className="flex flex-col gap-1">
        <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
          Remove Distractions from {scopeNoun}
        </h3>
        <p className="text-[14px] font-normal text-[#ababab] leading-5">
          Aftershoot currently removes a fixed set of 4 distraction types.
          Select the distractions that you want to remove from the {scopePhrase}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-2 mt-1">
        {CATEGORIES.map((label) => {
          const isSelected = selected.has(label);
          return (
            <button
              key={label}
              onClick={() => toggle(label)}
              className="flex items-center gap-2 justify-self-start"
            >
              <div
                className={`shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center border transition-colors ${
                  isSelected
                    ? "bg-[#2563eb] border-[#2563eb]"
                    : "border-[#474747] bg-transparent"
                }`}
              >
                {isSelected && (
                  <Check className="w-2 h-2 text-white stroke-[3]" />
                )}
              </div>
              <span className="text-[14px] font-normal text-[#ababab] leading-4 whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={toggleSelectAll}
          className=" text-[14px] font-medium text-[#ababab] hover:text-[#e2e2e2] transition-colors"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="min-w-[44px] px-4 py-2 rounded bg-[#303030] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`min-w-[44px] px-4 py-2 rounded text-[14px] font-medium transition-colors ${
              canSubmit
                ? "bg-[#2563eb] text-white hover:bg-[#1d56d1] cursor-pointer"
                : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
            }`}
          >
            Remove
          </button>
        </div>
      </div>
    </DialogShell>
  );
};

export default AlbumScanModal;
