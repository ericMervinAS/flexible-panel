import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ThermometerIcon,
  DoorOpenIcon,
  BellRingingIcon,
  FireExtinguisherIcon,
  ArrowCounterClockwiseIcon,
  X,
} from "@phosphor-icons/react";

// The 4 distraction types Aftershoot currently scans for album-wide —
// fixed set, independent of what's been detected on any single image yet.
export const ALBUM_CATEGORIES = [
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

export interface AlbumCategoryStatus {
  label: string;
  /** Whether this category has ever been removed within the current scope
   *  (whole album, or a filmstrip multi-selection) — drives the
   *  checked/disabled "done" row vs. a plain checkbox. */
  done: boolean;
  /** Total instances removed so far — only meaningful when `done`. */
  count: number;
  /** Number of images touched by that removal — only meaningful when `done`. */
  imageCount: number;
  /** Instances currently found but not (yet) removed — only meaningful when
   *  `!done`, and only once `scanned` is true. */
  foundCount: number;
  /** Whether this category has been scanned for at all within scope — a
   *  category never scanned reads as "not yet scanned" rather than "found
   *  none", same distinction LoupePatchPanel makes per-image. */
  scanned: boolean;
}

interface AlbumScanModalProps {
  onClose: () => void;
  /** Current status of every one of the 4 categories, within whatever scope
   *  (whole album vs. filmstrip selection) this modal was opened for — the
   *  single source of truth for the unified picker/summary screen below. */
  categories: AlbumCategoryStatus[];
  /** Categories to preselect on open — e.g. a category the user already
   *  checked in the per-image panel despite it having zero instances there,
   *  as a shortcut into scanning the rest of the album for it. */
  initialSelectedLabels?: string[];
  /** Number of images this pass is scoped to (a filmstrip multi-selection) —
   *  undefined/1 means the whole album, and the modal's copy says "Album". */
  imageCount?: number;
  /** Non-null while a scan+remove pass triggered from this modal is running. */
  progress?: { percent: number; eta: string } | null;
  onCancelProgress?: () => void;
  /** Run find-and-remove for these UI labels — covers a never-scanned
   *  category, a category with found-but-unremoved instances, and a
   *  previously-removed category the user reset and checked again; the
   *  screen doesn't distinguish between them. */
  onSubmit: (labels: string[]) => void;
  /** Restore one already-removed category's instances across the scope —
   *  undoes the removal only, does NOT rescan/re-remove. The row simply
   *  flips back to a plain checkbox once `categories` reflects it. */
  onReset?: (label: string) => void;
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
  categories,
  initialSelectedLabels,
  imageCount,
  progress,
  onCancelProgress,
  onSubmit,
  onReset,
}: AlbumScanModalProps) => {
  // Always start with every checkable (not-yet-removed) category selected —
  // opt-out, not opt-in, same as the old picker screen. Already-removed
  // categories aren't selectable at all, so they're excluded here regardless
  // of initialSelectedLabels.
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set([
        ...categories.filter((c) => !c.done).map((c) => c.label),
        ...(initialSelectedLabels ?? []),
      ]),
  );
  // Confirm before restoring a removed category's instances — same pattern
  // as LoupePatchPanel's per-image restore confirmation.
  const [pendingReset, setPendingReset] = useState<{
    label: string;
    count: number;
  } | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState(false);

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
  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(Array.from(selected));
    setSelected(new Set());
  };

  // Done rows aren't selectable (they use the reset icon instead), so
  // Select All only ever covers the not-yet-removed ones.
  const selectableLabels = categories.filter((c) => !c.done).map((c) => c.label);
  const allSelected =
    selectableLabels.length > 0 &&
    selectableLabels.every((label) => selected.has(label));
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableLabels));
  };

  const handleResetClick = (label: string, imageCount: number) => {
    if (imageCount === 0 || skipConfirmation) {
      onReset?.(label);
      return;
    }
    setPendingReset({ label, count: imageCount });
  };

  const confirmReset = () => {
    if (!pendingReset) return;
    onReset?.(pendingReset.label);
    setPendingReset(null);
  };

  // ── Progress: scan+remove in flight ─────────────────────────────────────
  if (progress) {
    return (
      <DialogShell>
        <div className="flex flex-col gap-1 mb-2">
          <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
            Removing Distractions from {scopeNoun}
          </h3>
        </div>

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

  // ── Confirm: restoring a removed category ───────────────────────────────
  if (pendingReset) {
    return (
      <DialogShell>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 pt-0.5">
            <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
              Reset Object Removal
            </h3>
            <p className="text-[14px] font-normal text-[#ababab] leading-5">
              This will restore {pendingReset.count} photo
              {pendingReset.count > 1 ? "s" : ""} affected by "
              {pendingReset.label}".
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
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                skipConfirmation
                  ? "bg-[#2563eb] border-[#2563eb]"
                  : "bg-[#303030] border-[#474747]"
              }`}
            >
              {skipConfirmation && (
                <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
              )}
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
      </DialogShell>
    );
  }

  // ── Unified picker/summary screen — every category, always ─────────────
  const nothingDoneYet = categories.every((c) => !c.done);
  const doneCategories = categories.filter((c) => c.done);
  const notDoneCategories = categories.filter((c) => !c.done);

  const renderCategory = (c: AlbumCategoryStatus) => {
    const Icon = CATEGORY_ICON[c.label];

    if (c.done) {
      return (
        <div
          key={c.label}
          className="flex items-center gap-2 text-left group"
        >
          <div className="shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center bg-[#2563eb] opacity-50">
            <Check className="w-2 h-2 text-white stroke-[3]" />
          </div>
          {Icon && <Icon className="w-4 h-4 text-[#e2e2e2] shrink-0" />}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[12px] font-medium text-[#e2e2e2] leading-[14px] truncate">
              {c.count} {c.label}
            </span>
            <span className="text-[10px] font-normal text-[#777] leading-[14px] truncate">
              removed from {c.imageCount} images
            </span>
          </div>
          {onReset && (
            <button
              onClick={() => handleResetClick(c.label, c.imageCount)}
              className="shrink-0 cursor-pointer"
            >
              <ArrowCounterClockwiseIcon className="w-3 h-3 text-[#777] transition-colors group-hover:text-[#e2e2e2]" />
            </button>
          )}
        </div>
      );
    }

    const isChecked = selected.has(c.label);
    // Before the album's ever had a real "Remove from Album" pass, this is
    // a fresh picker — no per-category counts, even if a partial per-image
    // scan happens to have found something.
    const sub =
      !nothingDoneYet && c.scanned
        ? c.foundCount > 0
          ? `${c.foundCount} found`
          : "none found"
        : null;
    return (
      <button
        key={c.label}
        onClick={() => toggle(c.label)}
        className="flex items-center gap-2 text-left cursor-pointer"
      >
        <div
          className={`shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center border transition-colors ${
            isChecked
              ? "bg-[#2563eb] border-[#2563eb]"
              : "border-[#474747] bg-transparent"
          }`}
        >
          {isChecked && <Check className="w-2 h-2 text-white stroke-[3]" />}
        </div>
        {Icon && <Icon className="w-4 h-4 text-[#e2e2e2] shrink-0" />}
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] font-medium text-[#e2e2e2] leading-[14px] truncate">
            {c.label}
          </span>
          {sub && (
            <span className="text-[10px] font-normal text-[#777] leading-[14px] truncate">
              {sub}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <DialogShell>
      <div className="flex flex-col gap-1">
        <h3 className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
          {nothingDoneYet
            ? `Remove Distractions from ${scopeNoun}`
            : `Distractions in ${scopeNoun}`}
        </h3>
        <p className="text-[14px] font-normal text-[#ababab] leading-5">
          {nothingDoneYet
            ? `Aftershoot currently removes a fixed set of 4 distraction types. Select the distractions you want to remove from the ${scopePhrase}.`
            : "Check a category to remove it. Not happy with a removed one? Reset it, then check it to run it again."}
        </p>
      </div>

      {nothingDoneYet ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {notDoneCategories.map(renderCategory)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notDoneCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-[#666] uppercase tracking-[0.04em]">
                Not Removed
              </span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                {notDoneCategories.map(renderCategory)}
              </div>
            </div>
          )}
          {doneCategories.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-[#666] uppercase tracking-[0.04em]">
                Removed
              </span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                {doneCategories.map(renderCategory)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        {selectableLabels.length > 0 ? (
          <button
            onClick={toggleSelectAll}
            className="text-[14px] font-medium text-[#ababab] hover:text-[#e2e2e2] transition-colors"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          {canSubmit && (
            <button
              onClick={onClose}
              className="min-w-[44px] px-4 py-2 rounded bg-[#303030] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors"
            >
              Cancel
            </button>
          )}
          {canSubmit ? (
            <button
              onClick={handleSubmit}
              className="min-w-[44px] px-4 py-2 rounded text-[14px] font-medium bg-[#2563eb] text-white hover:bg-[#1d56d1] transition-colors cursor-pointer"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={onClose}
              className="min-w-[44px] px-4 py-2 rounded bg-[#303030] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors"
            >
              Got It
            </button>
          )}
        </div>
      </div>
    </DialogShell>
  );
};

export default AlbumScanModal;
