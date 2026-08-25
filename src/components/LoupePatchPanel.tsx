import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ArrowCounterClockwiseIcon,
  X,
  CubeFocusIcon,
  FlaskIcon,
  ArrowsCounterClockwiseIcon,
  Plus,
  ArrowsClockwiseIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type { DistractionDetection } from "@/lib/distractionDetection";
import SuggestObjectModal from "./SuggestObjectModal";
import AlbumScanModal, { type AlbumCategoryStatus } from "./AlbumScanModal";
import Tooltip from "./Tooltip";
import graphic1 from "@/assets/Graphic_1.png";

const MODEL_TO_UI: Record<string, string> = {
  "Exit Sign": "Exit Signs",
  "Smoke Detector": "Fire Alarms",
  "Fire Extinguisher": "Fire Extinguishers",
  Thermostat: "Thermostats",
};

// Every category we scan for — used to surface the ones with zero
// instances on this image (not just the ones actually detected) once a
// scan has run.
const SCAN_LABELS = Object.values(MODEL_TO_UI);

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

const Toggle = ({ checked, onChange }: ToggleProps) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative flex items-center p-0.5 rounded-full w-8 h-[18px] transition-colors shrink-0 ${
      checked ? "bg-[#2563eb]" : "bg-[#303030]"
    }`}
  >
    <div
      className={`w-3 h-3 rounded-full transition-transform duration-200 ${
        checked ? "translate-x-[14px] bg-white" : "translate-x-0 bg-[#ababab]"
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
  onInpaintCanvas?: () => void;
  /** Detection instance keys resolved directly on the canvas (Skip, or Edit ->
   *  Save) for the current image — subtracted from counts below so the
   *  "Remove N Objects" CTA matches what will actually be removed. */
  dismissedDetectionKeys?: Set<string>;
  /** Detection instance keys actually inpainted so far on this image — the
   *  permanent "done" record. Used (alongside removedItems) to tell a fully
   *  resolved label apart from one with leftovers, since a label can be
   *  resolved across several partial passes without ever setting removedItems. */
  appliedDetectionKeys?: Set<string>;
  /** UI labels that still have at least one Skipped-and-unresolved instance on
   *  this image — excluded from the "removed" set Remove Object marks, so the
   *  label stays a normal checkbox (with the remaining count) instead of
   *  flipping to the done/restore tile. */
  labelsWithSkips?: Set<string>;
  /** Re-confirm "select all occurrences" for a label after a partial skip —
   *  undoes the skip(s) so every instance is back in the removal batch. */
  onSelectAllOccurrences?: (label: string) => void;
  onRemoveAfterStrokeChange?: (v: boolean) => void;
  onRemovingChange?: (v: boolean) => void;
  /** Whether brush strokes on the canvas actually run inpainting — off by
   *  default so a stray stroke doesn't trigger a real removal. */
  brushEnabled?: boolean;
  onBrushEnabledChange?: (v: boolean) => void;
  /** Whether the Manual (brush-only) sub-tab exists at all — Option 1's entry
   *  point is Auto-only with no brush tool; Option 2 exposes both. */
  manualBrushAvailable?: boolean;
  distractionMap?: Map<number, DistractionDetection[]>;
  /** Whether the current image specifically has been scanned — an album scan
   *  covers every image, but a single "Scan this image" only covers one, so
   *  this can't be derived from distractionMap being defined alone. */
  hasScanned?: boolean;
  /** UI labels a scan has actually covered for this image. A partial scan (only
   *  some categories) that finds nothing shouldn't claim the image is clean —
   *  other distraction types may still be unscanned, so keep offering a scan. */
  scannedLabels?: Set<string>;
  /** Number of images selected in the filmstrip when it's a multi-selection
   *  (>1) — undefined means "whole album". Swaps "Scan Entire Album" for
   *  "Scan N Images" and scopes the modal it opens to just those photos. */
  selectedImageCount?: number;
  /** The actual filmstrip multi-selection (superset info behind
   *  selectedImageCount) — when it holds more than one image, the detected
   *  summary below combines every selected image instead of just
   *  currentImageIndex. */
  selectedImageIndices?: Set<number>;
  /** Per-image versions of appliedDetectionKeys/dismissedDetectionKeys's
   *  inputs — needed to compute dismissed/applied status for every image in
   *  a multi-selection, not just currentImageIndex. */
  appliedDetectionsByImage?: Record<number, Set<string>>;
  skippedDetectionsByImage?: Record<number, Set<string>>;
  pendingEditedMasksByImage?: Record<number, Record<string, unknown>>;
  isModelScanning?: boolean;
  onRerun?: () => void;
  /** Scan just the current image. */
  onScanImage?: () => void;
  /** Run a find-and-remove pass across the whole album for the given
   *  UI labels — triggered from the "Remove Distractions from Album" modal. */
  onScanAlbum?: (labels: string[]) => void;
  /** Non-null while a scan+remove pass triggered from the album modal is running. */
  albumRemoveProgress?: { percent: number; eta: string } | null;
  onCancelAlbumRemove?: () => void;
  /** Current status of all 4 album-wide distraction categories, within
   *  whatever scope (whole album vs. filmstrip selection) applies right
   *  now — drives the modal's unified picker/summary screen. */
  albumCategoryStatus?: AlbumCategoryStatus[];
  /** Restore one UI label's removed instances across the album scan's scope
   *  — undoes the removal only, does not rescan/re-remove. */
  onResetAlbumRemove?: (label: string) => void;
  onReport?: () => void;
  onSuggestSubmit?: (suggestion: string) => void;
  removedItems?: Set<string>;
  onRemove?: (labels: Set<string>) => void;
  onResetItem?: (label: string) => void;
  /** Reset one removed object (by UI label) — re-inpaints with survivors. */
  onResetImage?: (label: string) => void;
  onSelectedLabelsChange?: (labels: Set<string>) => void;
  onHoveredLabelChange?: (label: string | null) => void;
  onRemoveSuccess?: (count: number, brushOnly: boolean) => void;
  /** Raised after a label-based removal succeeds (not brush-only). */
  onBatchOffer?: (labels: string[]) => void;
}

const LoupePatchPanel = ({
  onScrollChange: _onScrollChange,
  currentImageIndex = 0,
  canvasHasStrokes = false,
  onClearCanvas,
  onInpaintCanvas,
  dismissedDetectionKeys,
  appliedDetectionKeys,
  labelsWithSkips,
  onSelectAllOccurrences,
  onRemoveAfterStrokeChange,
  onRemovingChange,
  brushEnabled = false,
  onBrushEnabledChange,
  manualBrushAvailable = false,
  distractionMap,
  hasScanned: hasScannedProp,
  scannedLabels,
  selectedImageCount,
  selectedImageIndices,
  appliedDetectionsByImage,
  skippedDetectionsByImage,
  pendingEditedMasksByImage,
  isModelScanning = false,
  onRerun,
  onScanImage,
  onScanAlbum,
  albumRemoveProgress = null,
  onCancelAlbumRemove,
  albumCategoryStatus = [],
  onResetAlbumRemove,
  onReport,
  onSuggestSubmit,
  removedItems = new Set(),
  onRemove,
  onResetItem,
  onResetImage,
  onSelectedLabelsChange,
  onHoveredLabelChange,
  onRemoveSuccess,
  onBatchOffer,
}: LoupePatchPanelProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removeAfterStroke, setRemoveAfterStroke] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [pendingReset, setPendingReset] = useState<{
    label: string;
    count: number;
  } | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [showAlbumScanModal, setShowAlbumScanModal] = useState(false);
  const [hasRescanned, setHasRescanned] = useState(false);
  const [flaskHovered, setFlaskHovered] = useState(false);
  // Auto (scan-and-detect) vs Manual (brush-only) sub-tab — always lands on
  // Auto by default, regardless of import source; Manual is a deliberate
  // switch the user makes themselves.
  const [activeSubTab, setActiveSubTab] = useState<"auto" | "manual">("auto");

  const handleSubTabChange = (tab: "auto" | "manual") => {
    if (tab === activeSubTab) return;
    // Switching away from Manual with a pending stroke would leave a brush
    // mask on canvas that's no longer reachable (the Auto tab has no Remove
    // CTA for it) — clear it so the canvas starts clean on the other side.
    if (tab === "auto" && canvasHasStrokes) onClearCanvas?.();
    setActiveSubTab(tab);
    onBrushEnabledChange?.(tab === "manual");
  };

  const removeAlbumLabel =
    selectedImageCount && selectedImageCount > 1
      ? `Remove from ${selectedImageCount} Images`
      : "Remove from Album";

  const handleRerun = () => {
    setHasRescanned(true);
    onRerun?.();
  };

  // Full per-image rescan (clears any album label-filter for this image,
  // marks it fully scanned) — used when everything currently found is
  // already resolved but not every category has actually been looked for,
  // so "Remove Objects" would be meaningless.
  const handleRescanImage = () => {
    setHasRescanned(true);
    onScanImage?.();
  };

  const handleSuggestSubmit = (suggestion: string) => {
    onSuggestSubmit?.(suggestion);
    setShowSuggestModal(false);
  };

  const hasScanned = hasScannedProp ?? distractionMap !== undefined;

  // Multi-select (filmstrip) combines every selected image's distractions
  // into one summary instead of just currentImageIndex — a single selection
  // (the normal case) keeps the old current-image-only behavior.
  const isMultiSelection = (selectedImageIndices?.size ?? 0) > 1;
  const summaryImageIndices = isMultiSelection
    ? Array.from(selectedImageIndices!)
    : [currentImageIndex];

  const detected = useMemo(() => {
    const rawCountMap = new Map<string, number>();
    const remainingCountMap = new Map<string, number>();
    const appliedCountMap = new Map<string, number>();
    for (const idx of summaryImageIndices) {
      const imageDets = distractionMap?.get(idx) ?? [];
      // currentImageIndex already has its dismissed/applied sets computed
      // (and passed down) by the caller — for every other image in a
      // multi-selection, derive the equivalent from the per-image records.
      const appliedForImage =
        idx === currentImageIndex
          ? (appliedDetectionKeys ?? new Set<string>())
          : (appliedDetectionsByImage?.[idx] ?? new Set<string>());
      const dismissedForImage =
        idx === currentImageIndex
          ? (dismissedDetectionKeys ?? new Set<string>())
          : (() => {
              const combined = new Set(skippedDetectionsByImage?.[idx] ?? []);
              const edited = pendingEditedMasksByImage?.[idx];
              if (edited) Object.keys(edited).forEach((k) => combined.add(k));
              appliedForImage.forEach((k) => combined.add(k));
              return combined;
            })();

      for (const det of imageDets) {
        const uiLabel = MODEL_TO_UI[det.label];
        if (!uiLabel) continue;
        rawCountMap.set(uiLabel, (rawCountMap.get(uiLabel) ?? 0) + 1);
        const key = `${uiLabel}:${det.x1}:${det.y1}:${det.x2}:${det.y2}`;
        if (appliedForImage.has(key)) {
          appliedCountMap.set(uiLabel, (appliedCountMap.get(uiLabel) ?? 0) + 1);
        }
        // Skip instances the user already resolved directly on the canvas
        // (Skip, or Edit -> Save, or already applied) so this count matches
        // what Remove will do next.
        if (dismissedForImage.has(key)) continue;
        remainingCountMap.set(uiLabel, (remainingCountMap.get(uiLabel) ?? 0) + 1);
      }
    }
    // Once scanned, surface every scannable category — including the ones
    // with zero instances on this image — so the panel also reads as a
    // "here's what we looked for and didn't find" list.
    const labels = hasScanned
      ? new Set([...rawCountMap.keys(), ...SCAN_LABELS])
      : new Set(rawCountMap.keys());
    return Array.from(labels).map((label) => {
      const rawCount = rawCountMap.get(label) ?? 0;
      const appliedCount = appliedCountMap.get(label) ?? 0;
      return {
        label,
        rawCount,
        count: remainingCountMap.get(label) ?? 0,
        // How many instances of this label are still actually present in
        // the photo(s) — total minus whatever's been inpainted away. A skip
        // alone doesn't remove pixels, so it stays in this count; only an
        // applied instance does.
        outstandingCount: rawCount - appliedCount,
        // Every instance of this label across the selected image(s) has
        // actually been inpainted — distinct from removedItems, which a
        // partial pass (some instances Skipped) deliberately leaves unset. A
        // label with no instances at all is "not found", not "applied".
        isFullyApplied: rawCount > 0 && appliedCount === rawCount,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    distractionMap,
    currentImageIndex,
    dismissedDetectionKeys,
    appliedDetectionKeys,
    appliedDetectionsByImage,
    skippedDetectionsByImage,
    pendingEditedMasksByImage,
    hasScanned,
    isMultiSelection,
    selectedImageIndices,
  ]);

  // A label reads as "done" once every instance on this image is actually
  // applied, or (album-wide path) removedItems already says so — a partial
  // pass (some instances Skipped) deliberately leaves both unset so the
  // label stays a normal, re-selectable checkbox showing what's left.
  // removedItems is a single flat, album-wide set (not scoped per image), so
  // its rawCount > 0 fallback must also require outstandingCount === 0 —
  // otherwise a label removed on one image would trivially satisfy that on
  // every OTHER image too, including ones where it was never even detected,
  // and falsely show a "removed" tile for a category never found there. A
  // rawCount === 0 category doesn't have that ambiguity: it only reads as
  // done once THIS image was actually scanned for it and it's in
  // removedItems (set once Remove Object runs, or once a "Scan this image"
  // pass has finished covering every category — see Index.tsx) — a category
  // never scanned here isn't even in `detected` for this image to begin with.
  const isDone = (d: {
    label: string;
    rawCount: number;
    isFullyApplied: boolean;
    outstandingCount: number;
  }) =>
    d.isFullyApplied ||
    (removedItems.has(d.label) &&
      (d.rawCount === 0 || d.outstandingCount === 0));

  // Found-and-active first, removed next, not-found (zero instances) last —
  // same ordering as SmartObjectRemoval.
  const orderedItems = [
    ...detected.filter((d) => !isDone(d) && d.rawCount > 0),
    ...detected.filter((d) => isDone(d)),
    ...detected.filter((d) => !isDone(d) && d.rawCount === 0),
  ];

  // Whether every scannable category has actually been looked for on this
  // image. Defaults to "all covered" when the caller doesn't tell us, so a
  // panel without scan-tracking keeps its old all-or-nothing behavior.
  const scanned = scannedLabels ?? new Set(SCAN_LABELS);
  const allLabelsScanned = SCAN_LABELS.every((l) => scanned.has(l));
  const nothingFound = detected.every((d) => d.rawCount === 0);

  // Offer the scan entry points instead of results when nothing's been scanned
  // yet, OR when only some categories were scanned and none of them turned up
  // anything — the remaining, unscanned types might still be present, so we
  // can't honestly show an empty "clean image" state.
  const preScan =
    (!hasScanned || (!allLabelsScanned && nothingFound)) && !isModelScanning;

  // All scannable categories were looked for and came back empty — distinct
  // from "not fully scanned yet"; drives the "No distractions detected"
  // illustration instead of an itemized not-found list.
  const noneFound =
    hasScanned &&
    allLabelsScanned &&
    detected.length > 0 &&
    detected.every((d) => d.rawCount === 0);

  // Nothing currently selectable on this image (everything found so far is
  // already resolved), but not every category has actually been scanned —
  // "Remove Objects" would be meaningless here, so offer a rescan instead.
  const activeItemCount = detected.filter(
    (d) => !isDone(d) && d.rawCount > 0,
  ).length;
  const showRescanCTA =
    !preScan &&
    !isModelScanning &&
    !noneFound &&
    activeItemCount === 0 &&
    !allLabelsScanned;

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

  // A selected label reads as indeterminate only when it still has a
  // Skipped-and-unresolved instance that this Remove pass will leave behind.
  // Remaining count can also fall short of the raw total because instances
  // were already applied in an earlier partial pass, or are queued edits that
  // get folded into this same pass as extra brushes (see handleInpaintCanvas)
  // — neither of those leaves anything unresolved, so they shouldn't read as
  // a dash; only an actual skip does.
  const isLabelIndeterminate = (d: { label: string; count: number }) =>
    selected.has(d.label) && d.count > 0 && !!labelsWithSkips?.has(d.label);

  // A skip can bring a selected label's remaining count to zero (its last
  // instance was skipped) — nothing is left to remove, so drop the stale
  // selection instead of leaving a checked box over a "0" count. Only applies
  // to labels that actually had instances (rawCount > 0); a label with no
  // instances at all on this image can be deliberately checked (see the
  // rawCount === 0 render branch below) to queue it for an album-wide scan,
  // and that selection must survive detected recomputing.
  useEffect(() => {
    setSelected((prev) => {
      const zeroed = detected.filter(
        (d) => d.rawCount > 0 && d.count === 0 && prev.has(d.label),
      );
      if (zeroed.length === 0) return prev;
      const next = new Set(prev);
      zeroed.forEach((d) => next.delete(d.label));
      onSelectedLabelsChange?.(next);
      return next;
    });
  }, [detected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Item toggle ───────────────────────────────────────────────────────────
  const toggle = (label: string) => {
    const d = detected.find((det) => det.label === label);
    const isFullyChecked =
      selected.has(label) && !(d && isLabelIndeterminate(d));

    if (isFullyChecked) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(label);
        onSelectedLabelsChange?.(next);
        return next;
      });
      return;
    }

    // Moving into a selected state — whether fresh or re-confirming from the
    // dash (indeterminate) state — always means "every occurrence": undo any
    // skips on this label so none are silently left out of the batch.
    if (d && labelsWithSkips?.has(label)) {
      onSelectAllOccurrences?.(label);
    }
    setSelected((prev) => {
      if (prev.has(label)) return prev;
      const next = new Set(prev).add(label);
      onSelectedLabelsChange?.(next);
      return next;
    });
  };

  // ── Restore ───────────────────────────────────────────────────────────────
  const handleResetClick = (label: string, count: number) => {
    // Nothing was actually inpainted for a zero-instance category — skip the
    // "this restores N photos" confirmation (there's nothing to confirm) but
    // still clear it from the shared removedItems set like a real restore.
    if (count === 0 || skipConfirmation) {
      onResetItem?.(label);
      onResetImage?.(label);
      return;
    }
    setPendingReset({ label, count });
  };

  const confirmReset = () => {
    if (!pendingReset) return;
    onResetItem?.(pendingReset.label);
    onResetImage?.(pendingReset.label);
    setPendingReset(null);
  };

  // ── Remove ────────────────────────────────────────────────────────────────
  const selectedDetected = detected.filter((d) => selected.has(d.label));
  const remainingObjectCount =
    selectedDetected.reduce((sum, d) => sum + d.count, 0) +
    (canvasHasStrokes ? 1 : 0);

  const removeLabel =
    remainingObjectCount > 1
      ? `Remove ${remainingObjectCount} Objects`
      : "Remove Object";

  // A brush stroke only counts toward Remove Object on Option 2's Manual tab
  // (manualBrushAvailable) — Option 1 has no manual removal workflow, so a
  // stray stroke there (e.g. while editing a detection's mask) must never by
  // itself enable the CTA, AND must block the checkbox-based path too —
  // otherwise a label checked before the stroke was drawn would keep Remove
  // Object enabled even though itemsDisabled has already locked the list.
  const canRemove =
    !isRemoving &&
    (canvasHasStrokes
      ? manualBrushAvailable && !removeAfterStroke
      : selected.size > 0 && remainingObjectCount > 0);

  const handleRemove = () => {
    if (!canRemove) return;
    const toRemove = new Set(selected);
    // A label with a Skipped-and-unresolved instance isn't fully handled by
    // this click — leave it out of the "removed" set so it stays a normal,
    // re-selectable checkbox (with the remaining count) instead of flipping
    // to the done/restore tile. A selected label with zero instances on this
    // image has nothing to inpaint, but — now that it's scanned-for and
    // explicitly selected — it should still land in the same "removed" set
    // as a real removal so it reads as done rather than lingering as the
    // manual album-queue checkbox (isDone's rawCount === 0 branch relies on
    // exactly this).
    const toMarkRemoved = new Set(
      [...toRemove].filter((label) => {
        if (labelsWithSkips?.has(label)) return false;
        const d = detected.find((det) => det.label === label);
        return !!d;
      }),
    );

    // Real inpainting happens in LoupeView, which owns the source image and the
    // mask. It builds the mask from the brush strokes and/or the selected
    // detection boxes (captured by the parent when onInpaintCanvas fires), shows
    // its own spinner, clears the canvas, and fires the success toast via
    // onCanvasRemoveSuccess. So we only trigger it and mark the list here.
    onInpaintCanvas?.();
    onRemove?.(toMarkRemoved);

    // Label-based removal (not brush-only) — raise the album-wide batch offer.
    // Skip-only labels didn't actually get removed, so don't offer to scan the
    // album for them yet.
    if (toMarkRemoved.size > 0) {
      onBatchOffer?.(Array.from(toMarkRemoved));
    }

    const empty = new Set<string>();
    setSelected(empty);
    onSelectedLabelsChange?.(empty);
  };

  // Brush strokes and object-checkbox selection are mutually exclusive removal
  // methods — once the brush has pending strokes, lock the object list until
  // those strokes are cleared or committed.
  const itemsDisabled = isModelScanning || isRemoving || canvasHasStrokes;

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6"
      style={{ scrollbarWidth: "none" }}
    >
      {/* ── Auto / Manual sub-tabs ───────────────────────────────────────────
          Two distinct removal workflows: Auto scans for known distraction
          categories and lets you check them off; Manual is just the brush,
          off the object list entirely. Kept mutually exclusive rather than a
          toggle buried in the Auto panel, since enabling the brush changes
          what the whole panel below it does. Only Option 2's entry point
          exposes Manual/the brush tool at all — Option 1 stays Auto-only, no
          switcher, brush never reachable. */}
      {manualBrushAvailable && (
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#141414] shrink-0">
          {(
            [
              { id: "auto", label: "Auto" },
              { id: "manual", label: "Manual" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleSubTabChange(id)}
              className={`flex-1 h-7 rounded-md text-[12px] font-medium transition-colors ${
                activeSubTab === id
                  ? "bg-[#2a2a2a] text-[#e2e2e2]"
                  : "text-[#777] hover:text-[#ababab]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {manualBrushAvailable && activeSubTab === "manual" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-normal text-[#e2e2e2] leading-5">
              Manual Brush
            </span>
            <p className="text-[12px] text-[#ababab] leading-4">
              Paint directly over the object you want to remove, then click
              Remove.
            </p>
          </div>
          <button
            disabled={!canRemove}
            onClick={handleRemove}
            className={`flex items-center justify-center gap-2 h-9 w-full px-3 rounded text-[12px] font-medium transition-colors ${
              isRemoving
                ? "bg-[#1d56d1] text-white cursor-not-allowed"
                : canRemove
                  ? "bg-[#2563eb] text-white hover:bg-[#1d56d1] cursor-pointer"
                  : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
            }`}
          >
            <span>{isRemoving ? "Removing…" : removeLabel}</span>
          </button>
        </div>
      ) : (
        <>
      {/* ── Smart Object ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-normal text-[#e2e2e2] leading-5">
              Distraction Removal
            </span>
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

          {/* Scan icon — always mounted (even pre-scan, as an invisible
              placeholder) so the title row's height stays constant and the
              heading doesn't shift when the panel switches states. */}
          <button
            onClick={handleRerun}
            disabled={preScan || isModelScanning || isRemoving}
            title="Rerun object scan"
            className={`flex items-center justify-center w-6 h-6 rounded transition-opacity ${
              preScan
                ? "opacity-0 pointer-events-none"
                : isRemoving
                  ? "opacity-30 cursor-not-allowed"
                  : isModelScanning
                    ? "opacity-60 cursor-not-allowed"
                    : "opacity-70 hover:opacity-100 cursor-pointer"
            }`}
          >
            {isModelScanning ? (
              <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
            ) : (
              // <ArrowsClockwiseIcon className="w-5 h-5 text-[#555]" />
              <></>
            )}
          </button>
        </div>

        {preScan && (
          <img src={graphic1} className="w-full h-100 object-cover" />
        )}

        {preScan && (
          <p className="text-[12px] text-[#ababab] leading-4">
            Scan for distracting objects like exit signs, fire alarms, fire
            extinguishers, and thermostats to remove.
          </p>
        )}

        {/* Pre-scan entry points */}
        {preScan && (
          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={onScanImage}
              disabled={canvasHasStrokes}
              className={`flex items-center justify-center h-9 px-3 rounded transition-colors ${
                canvasHasStrokes
                  ? "bg-[#1e2a45] cursor-not-allowed"
                  : "bg-[#2563eb] hover:bg-[#1d56d1]"
              }`}
              // className="flex items-center justify-center h-9 px-3 rounded bg-[#303030] hover:bg-[#3a3a3a] transition-colors"
            >
              <span
                className={`text-[12px] font-medium leading-4 ${
                  canvasHasStrokes ? "text-[#474747]" : "text-white"
                }`}
              >
                Remove from this Image
              </span>
            </button>
            <button
              onClick={() => setShowAlbumScanModal(true)}
              disabled={canvasHasStrokes}
              className={`flex items-center justify-center h-9 px-3 rounded border transition-colors ${
                canvasHasStrokes
                  ? "border-[#242424] cursor-not-allowed"
                  : "border-[#303030] hover:border-[#3a3a3a]"
              }`}
            >
              <span
                className={`text-[12px] font-medium leading-4 ${
                  canvasHasStrokes ? "text-[#474747]" : "text-[#e2e2e2]"
                }`}
              >
                {removeAlbumLabel}
              </span>
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isModelScanning && hasScanned && noneFound && (
          <div className="flex flex-col items-center gap-3 mt-1">
            <div className="flex flex-col items-center justify-center gap-4 p-5 rounded-lg bg-[#242424] w-full">
              <WarningIcon className="w-8 h-8 text-[#e2e2e2]" />
              <div className="flex flex-col gap-1 text-center w-full">
                <p className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
                  No distractions detected
                </p>
                <p className="text-[13px] font-normal text-[#ababab] leading-4">
                  Think we missed something?
                </p>
              </div>
              {/* <div className="flex items-center justify-center gap-2 w-full">
                <button
                  onClick={handleRerun}
                  className="flex items-center justify-center min-w-[44px] px-3 py-2 rounded bg-[#303030] hover:bg-[#3a3a3a] transition-colors"
                >
                  <span className="text-[12px] font-medium text-[#e2e2e2] leading-4">
                    Rescan Image
                  </span>
                </button>
                {hasRescanned && (
                  <button
                    onClick={onReport}
                    className="flex items-center justify-center min-w-[44px] px-3 py-2 rounded hover:bg-white/5 transition-colors"
                  >
                    <span className="text-[12px] font-medium text-[#ababab] leading-4">
                      Report Issue
                    </span>
                  </button>
                )}
              </div> */}
            </div>
          </div>
        )}

        {/* Detected items grid */}
        {!preScan && !noneFound && detected.length > 0 && (
          <div
            className={`grid grid-cols-2 mt-2 gap-4 transition-opacity ${itemsDisabled ? "opacity-40 pointer-events-none" : ""}`}
          >
            {orderedItems.map((d) => {
              const isItemRemoved = isDone(d);
              // A label with nothing left to remove (count 0) must never
              // render as checked, even if it's still in `selected` for a
              // tick before the cleanup effect below clears it.
              const isSelected = selected.has(d.label) && d.count > 0;
              const isIndeterminate = isLabelIndeterminate(d);

              if (isItemRemoved) {
                return (
                  <div
                    key={d.label}
                    onMouseEnter={() => onHoveredLabelChange?.(d.label)}
                    onMouseLeave={() => onHoveredLabelChange?.(null)}
                    className="flex items-center justify-between gap-2 h-4 rounded-[6px] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() =>
                          d.rawCount > 0 &&
                          handleResetClick(d.label, d.rawCount)
                        }
                        disabled={d.rawCount === 0}
                        className={`shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center bg-[#2563eb] opacity-50 ${
                          d.rawCount > 0 ? "cursor-pointer" : ""
                        }`}
                      >
                        <Check className="w-2 h-2 text-white stroke-[3]" />
                      </button>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[11px] text-[#e2e2e2] leading-4 truncate">
                          {d.label}
                        </span>
                        <span className="text-[10px] font-medium text-[#777] leading-3 shrink-0">
                          {d.rawCount}
                        </span>
                      </div>
                    </div>
                    {d.rawCount > 0 && (
                      <button
                        onClick={() => handleResetClick(d.label, d.rawCount)}
                        className="shrink-0 cursor-pointer"
                      >
                        <ArrowCounterClockwiseIcon className="w-3 h-3 text-[#777] transition-colors group-hover:text-[#e2e2e2]" />
                      </button>
                    )}
                  </div>
                );
              }

              if (d.rawCount === 0) {
                // Nothing found on this image, but the user may still want to
                // remove this category across the album — checking it here
                // just queues it as a preselected category for "Remove from
                // Album" below (there's nothing to inpaint on this photo).
                const isQueued = selected.has(d.label);
                return (
                  <button
                    key={d.label}
                    onClick={() => toggle(d.label)}
                    className="flex items-center gap-2 h-4 rounded-[6px] text-left cursor-pointer"
                  >
                    <div
                      className={`shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center transition-colors ${
                        isQueued
                          ? "bg-[#2563eb]"
                          : "border border-[#474747] bg-transparent"
                      }`}
                    >
                      {isQueued && (
                        <Check className="w-2 h-2 text-white stroke-[3]" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[11px] text-[#e2e2e2] leading-4 truncate">
                        {d.label}
                      </span>
                      <span className="text-[10px] font-medium text-[#777] leading-3 shrink-0">
                        0
                      </span>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={d.label}
                  onClick={() => toggle(d.label)}
                  onMouseEnter={() =>
                    !itemsDisabled && onHoveredLabelChange?.(d.label)
                  }
                  onMouseLeave={() =>
                    !itemsDisabled && onHoveredLabelChange?.(null)
                  }
                  className={`flex items-center gap-2 h-4 rounded-[6px] transition-colors text-left ${
                    itemsDisabled ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <div
                    className={`shrink-0 w-3 h-3 rounded-[2px] flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-[#2563eb]"
                        : "border border-[#474747] bg-transparent"
                    }`}
                  >
                    {isSelected &&
                      (isIndeterminate ? (
                        <div className="w-1.5 h-[1.5px] rounded-full bg-white" />
                      ) : (
                        <Check className="w-2 h-2 text-white stroke-[3]" />
                      ))}
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[11px] text-[#e2e2e2] leading-4 truncate">
                      {d.label}
                    </span>
                    <span className="text-[10px] font-medium text-[#777] leading-3 shrink-0">
                      {/* Once some (but not all) instances are already resolved
                          (e.g. one dot restored out of several removed), show
                          "remaining/total" instead of a bare count that reads
                          as the full total. */}
                      {d.outstandingCount !== d.rawCount
                        ? `${d.outstandingCount}/${d.rawCount}`
                        : d.rawCount}
                    </span>
                  </div>
                </button>
              );
            })}
            {/* {detected.length > 0 && (
                <button
                  onClick={() => setShowSuggestModal(true)}
                  className="group relative col-span-2 flex items-center justify-center gap-2 h-9 w-full rounded-[8px] bg-[#1f1f1f] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#3a3a3a] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-center w-4 h-4 rounded-full bg-[#2a2a2a] group-hover:bg-[#333333] transition-colors">
                    <Plus
                      className="w-2.5 h-2.5 text-[#ababab]"
                      weight="bold"
                    />
                  </div>
                  <span className="text-[12px] font-medium text-[#ababab] group-hover:text-[#e2e2e2] transition-colors">
                    Suggest objects
                  </span>
                </button>
              )} */}
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

      {!preScan && showRescanCTA && (
        <button
          onClick={handleRescanImage}
          className="flex items-center mt-[-8px] justify-center gap-2 h-9 w-full px-3 rounded text-[12px] font-medium bg-[#2563eb] text-white hover:bg-[#1d56d1] transition-colors cursor-pointer"
        >
          <span>Rescan Image</span>
        </button>
      )}

      {!preScan && !showRescanCTA && (
        <button
          disabled={!canRemove}
          onClick={handleRemove}
          className={`flex items-center mt-[-8px] justify-center gap-2 h-9 w-full px-3 rounded text-[12px] font-medium transition-colors ${
            isRemoving
              ? "bg-[#1d56d1] text-white cursor-not-allowed"
              : canRemove
                ? "bg-[#2563eb] text-white hover:bg-[#1d56d1] cursor-pointer"
                : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
          }`}
        >
          <span>{isRemoving ? "Removing…" : removeLabel}</span>
        </button>
      )}

      {/* Post-scan: still offer to scan the rest of the album */}
      {!preScan && !isModelScanning && (
        <button
          onClick={() => setShowAlbumScanModal(true)}
          disabled={canvasHasStrokes}
          className={`flex items-center justify-center h-9 px-3 mt-[-16px] rounded border transition-colors ${
            canvasHasStrokes
              ? "border-[#242424] cursor-not-allowed"
              : "border-[#303030] hover:border-[#3a3a3a]"
          }`}
        >
          <span
            className={`text-[12px] font-medium leading-4 ${
              canvasHasStrokes ? "text-[#474747]" : "text-[#e2e2e2]"
            }`}
          >
            {removeAlbumLabel}
          </span>
        </button>
      )}

      </>
      )}

      {/* ── Restore confirmation modal (same as SmartObjectRemoval) ───────── */}
      {pendingReset &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
            <div className="bg-[#1c1c1c] border border-[#303030] rounded-[12px] p-5 flex flex-col gap-4 w-[448px]">
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
                  <span className="text-[12px] text-[#777]">
                    Don't ask again
                  </span>
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
          document.body,
        )}

      {showSuggestModal && (
        <SuggestObjectModal
          onClose={() => setShowSuggestModal(false)}
          onSubmit={handleSuggestSubmit}
        />
      )}

      {(showAlbumScanModal || albumRemoveProgress) && (
        <AlbumScanModal
          onClose={() => setShowAlbumScanModal(false)}
          onSubmit={(labels) => onScanAlbum?.(labels)}
          categories={albumCategoryStatus}
          initialSelectedLabels={detected
            .filter((d) => d.rawCount === 0 && selected.has(d.label))
            .map((d) => d.label)}
          imageCount={selectedImageCount}
          progress={albumRemoveProgress}
          onCancelProgress={() => {
            onCancelAlbumRemove?.();
            setShowAlbumScanModal(false);
          }}
          onReset={onResetAlbumRemove}
        />
      )}
    </div>
  );
};

export default LoupePatchPanel;
