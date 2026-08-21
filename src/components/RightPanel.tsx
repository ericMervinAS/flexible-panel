import { useState, useRef, useEffect } from "react";
import {
  User,
  Stack,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  Diamond,
} from "@phosphor-icons/react";
import SubjectSync, { SubjectSyncState } from "./SubjectSync";
import SmartObjectRemoval, { SmartObjectState } from "./SmartObjectRemoval";
import { RetouchHistoryEntry } from "./RetouchHistory";
import LoupeSubjectPanel, { LoupeRetouchState } from "./LoupeSubjectPanel";
import LoupePatchPanel from "./LoupePatchPanel";
import RetouchingOpportunityBanner from "./RetouchingOpportunityBanner";
import BatchRemovalOffer from "./BatchRemovalOffer";
import type { ModelSubject } from "@/hooks/useFaceDetection";
import { MODEL_TO_UI } from "@/lib/distractionDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";

const LOUPE_TABS = [
  { id: "subject", label: "Subject", Icon: User },
  { id: "background", label: "Background", Icon: Stack },
  { id: "patch", label: "Patch", Icon: Eraser },
] as const;

type LoupeTab = "subject" | "background" | "patch";

interface RightPanelProps {
  isScanning: boolean;
  isLoupeView?: boolean;
  currentImageIndex?: number;
  onTabChange?: (tab: string) => void;
  canvasHasStrokes?: boolean;
  onClearCanvas?: () => void;
  onInpaintCanvas?: () => void;
  /** Detection instance keys resolved directly on the canvas (Skip, or Edit ->
   *  Save) for the current image — subtracted from the patch panel's counts
   *  so the "Remove N Objects" CTA matches what will actually be removed. */
  dismissedDetectionKeys?: Set<string>;
  /** Detection instance keys actually inpainted so far on this image — the
   *  permanent "done" record, independent of the label-level removedItems
   *  flag, so a label resolved across several partial passes still shows the
   *  right remaining count / done-vs-checkbox state. */
  appliedDetectionKeys?: Set<string>;
  /** UI labels that still have at least one Skipped-and-unresolved instance on
   *  this image — Remove Object should not flip these to "removed". */
  labelsWithSkips?: Set<string>;
  /** Panel checkbox re-confirmed as "select all occurrences" for a label
   *  after a partial skip — undo the skip(s) so every instance is back in
   *  the removal batch. */
  onSelectAllOccurrences?: (label: string) => void;
  onResetImage?: (label: string) => void;
  /** Grid-level batch: remove these UI labels across all already-scanned photos
   *  (or, when `indices` is given, only those specific images). Returns a
   *  promise that resolves once the batch inpaint actually finishes, so
   *  callers can wait for it before flagging labels as "removed". */
  onBatchRemove?: (
    uiLabels: string[],
    indices?: number[],
  ) => void | Promise<void>;
  /** Patch tab: scan just the current image. */
  onScanImage?: () => void;
  /** Grid: run album-wide detection for the selected UI labels. */
  onScanAlbumRun?: (labels: string[]) => void;
  /** Scan only these image indices (a filmstrip multi-selection) for the given
   *  UI labels — used instead of onScanAlbumRun when more than one image is
   *  selected in the loupe filmstrip. */
  onScanIndices?: (labels: string[], indices: number[]) => void;
  /** Filmstrip multi-selection (loupe view) — when it holds more than one
   *  image, "Scan Entire Album" scopes itself to just these instead. */
  selectedImageIndices?: Set<number>;
  onRemoveAfterStrokeChange?: (v: boolean) => void;
  onRemovingChange?: (v: boolean) => void;
  visibleSubjectIndices?: Set<number> | null;
  modelSubjects?: ModelSubject[];
  modelImageMap?: Map<number, number[]>;
  isModelDetecting?: boolean;
  modelStatusMessage?: string;
  modelSubjectFilter?: number[];
  tabOverride?: { tab: LoupeTab; seq: number } | null;
  hasRetouchingOpportunity?: boolean;
  distractionMap?: Map<number, DistractionDetection[]>;
  /** Whether a full album-wide scan has completed — distinct from distractionMap
   *  being defined, since a single-image scan (from loupe) also populates it. */
  hasScannedAlbum?: boolean;
  /** Whether the current image (loupe) has itself been scanned — distinct from
   *  distractionMap being defined, since a single-image scan only covers one index. */
  currentImageScanned?: boolean;
  isDistractionScanning?: boolean;
  /** 0–100 album-scan progress, driven by the distraction model's per-image
   *  callback — only meaningful while isDistractionScanning is true. */
  distractionScanProgress?: number;
  /** UI labels actually included in a completed album scan — distinct from
   *  which ones currently have a nonzero count, so an object type nobody has
   *  scanned for yet reads as "not yet searched" rather than "found none". */
  scannedLabels?: Set<string>;
  onDistractionRerunCurrent?: () => void;
  onDistractionSelectionChange?: (labels: Set<string>) => void;
  onDistractionHoverChange?: (label: string | null) => void;
  onDistractionRemoveSuccess?: (count: number, brushOnly: boolean) => void;
  onSuggestObject?: (suggestion: string) => void;
  /** Shared removed-items state (Set of removed object UI labels) — owned by the page. */
  removedItems?: Set<string>;
  /** Merge a set of labels into the shared removed set. */
  onAddRemovedItems?: (labels: Set<string>) => void;
  /** Delete one label from the shared removed set. */
  onResetRemovedItem?: (label: string) => void;
  /** Replace the shared removed set wholesale. */
  onSetRemovedItems?: (labels: Set<string>) => void;
  flexibleWidth?: boolean;
  /** Show a one-time coachmark pointing at "Smart Object Removal" in the grid
   *  (surfaced after the user clicks "Scan this album" from the loupe patch tab). */
  showObjectCoachmark?: boolean;
  onDismissObjectCoachmark?: () => void;
  /** Switch the app back to the grid view. Receives the labels that were just
   *  removed on the current photo (from the batch-removal offer), if any. */
  onGoToGrid?: (labels: string[]) => void;
  /** UI labels to preselect in the grid's Smart Object Removal on arrival —
   *  set when the user got here via the batch-removal offer's "Scan the album". */
  initialObjectSelection?: string[];
  /** Switch the app to Loupe view — retouching only happens there now that
   *  Smart Object Removal is hidden in the grid. */
  onSwitchToLoupe?: () => void;
  /** Fires whenever the set of images with slider/preset ("AI Retouched")
   *  edits changes, so the page can drive the Edit Status filter. */
  onEditStateChange?: (indices: Set<number>) => void;
}

const RightPanel = ({
  isScanning,
  isLoupeView = false,
  currentImageIndex = 0,
  onTabChange,
  canvasHasStrokes = false,
  onClearCanvas,
  onInpaintCanvas,
  dismissedDetectionKeys,
  appliedDetectionKeys,
  labelsWithSkips,
  onSelectAllOccurrences,
  onResetImage,
  onBatchRemove,
  onScanImage,
  onScanAlbumRun,
  onScanIndices,
  selectedImageIndices,
  onRemoveAfterStrokeChange,
  onRemovingChange,
  visibleSubjectIndices,
  modelSubjects,
  modelImageMap,
  isModelDetecting,
  modelStatusMessage,
  modelSubjectFilter,
  tabOverride,
  hasRetouchingOpportunity = false,
  distractionMap,
  hasScannedAlbum = false,
  currentImageScanned,
  isDistractionScanning = false,
  distractionScanProgress = 0,
  scannedLabels,
  onDistractionRerunCurrent,
  onDistractionSelectionChange,
  onDistractionHoverChange,
  onDistractionRemoveSuccess,
  onSuggestObject,
  removedItems = new Set(),
  onAddRemovedItems,
  onResetRemovedItem,
  onSetRemovedItems,
  flexibleWidth = false,
  showObjectCoachmark = false,
  onDismissObjectCoachmark,
  onGoToGrid,
  initialObjectSelection,
  onSwitchToLoupe,
  onEditStateChange,
}: RightPanelProps) => {
  const [activeTab, setActiveTab] = useState<LoupeTab>("subject");
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [subjectActive, setSubjectActive] = useState(false);
  const [objectActive, setObjectActive] = useState(false);
  // Reactive copy of the object labels currently checked in the grid panel —
  // objectStateRef holds the same data but a ref won't re-render the CTA, and
  // the button text depends on whether any selected label is still unscanned.
  const [selectedObjectLabels, setSelectedObjectLabels] = useState<string[]>(
    [],
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [history, setHistory] = useState<RetouchHistoryEntry[]>([]);
  const [appliedPresets, setAppliedPresets] = useState<Record<string, string>>(
    {},
  );

  // ── Album-wide batch-removal offer (owned here; card rendered near the footer) ──
  const [batchOffer, setBatchOffer] = useState<{ labels: string[] } | null>(
    null,
  );

  // Dismiss any pending offer when the user navigates to another image.
  useEffect(() => {
    setBatchOffer(null);
  }, [currentImageIndex]);

  // Auto-dismiss the "Smart Object Removal" coachmark after a few seconds so
  // it doesn't linger if the user doesn't interact with it.
  useEffect(() => {
    if (!showObjectCoachmark) return;
    const timer = setTimeout(() => onDismissObjectCoachmark?.(), 5000);
    return () => clearTimeout(timer);
  }, [showObjectCoachmark, onDismissObjectCoachmark]);

  // ── Retouching opportunity overlay ──────────────────────────────────────────
  const [opportunityDismissed, setOpportunityDismissed] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    setOpportunityDismissed(false);
  }, [currentImageIndex]);

  useEffect(() => {
    if (hasRetouchingOpportunity && !opportunityDismissed && isLoupeView) {
      const t = setTimeout(() => setOverlayVisible(true), 80);
      return () => clearTimeout(t);
    }
    setOverlayVisible(false);
  }, [hasRetouchingOpportunity, opportunityDismissed, isLoupeView]);

  // ── Loupe view state ────────────────────────────────────────────────────────
  const [perImageState, setPerImageState] = useState<
    Record<number, LoupeRetouchState>
  >({});
  const [pasteSourceIndex, setPasteSourceIndex] = useState<number | null>(null);
  const [loupeResetSignal, setLoupeResetSignal] = useState(0);
  const [loupePasteSignal, setLoupePasteSignal] = useState<{
    state: LoupeRetouchState;
    seq: number;
  } | null>(null);
  const prevImageIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoupeView) return;
    if (prevImageIndexRef.current === null) {
      prevImageIndexRef.current = currentImageIndex;
      return;
    }
    if (prevImageIndexRef.current !== currentImageIndex) {
      setPasteSourceIndex(prevImageIndexRef.current);
      prevImageIndexRef.current = currentImageIndex;
    }
  }, [currentImageIndex, isLoupeView]);

  useEffect(() => {
    if (!tabOverride) return;
    setActiveTab(tabOverride.tab);
    onTabChange?.(tabOverride.tab);
  }, [tabOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasRetouches = (state: LoupeRetouchState | undefined): boolean => {
    if (!state) return false;
    const hasSliders = Object.values(state.sliderLayers).some((layer) =>
      layer.some((row) => row.some((v) => v !== null)),
    );
    const hasPresets = Object.values(state.localPresets).some(
      (v) => v !== null,
    );
    return hasSliders || hasPresets || state.customized.size > 0;
  };

  useEffect(() => {
    const edited = new Set(
      Object.entries(perImageState)
        .filter(([, state]) => hasRetouches(state))
        .map(([idx]) => Number(idx)),
    );
    onEditStateChange?.(edited);
  }, [perImageState]); // eslint-disable-line react-hooks/exhaustive-deps

  const canPaste =
    pasteSourceIndex !== null && hasRetouches(perImageState[pasteSourceIndex]);
  const canReset = hasRetouches(perImageState[currentImageIndex]);

  const subjectStateRef = useRef<SubjectSyncState>({
    selectedSubjects: [],
    selectedGroups: [],
    presets: {},
    subjectCounts: [],
    selectedModelSubjects: [],
    modelPresets: {},
  });
  const objectStateRef = useRef<SmartObjectState>({ selectedWithCounts: [] });

  // "Find and remove" (grid pre-scan CTA): kicks off the album scan, then once
  // it completes, immediately removes every selected label with no extra click.
  // pendingAutoRemove only gates the scan->remove handoff effect below; the
  // whole click-to-inpaint-done span (what the progress bar tracks) is
  // isAutoRemoveInFlight, which stays true through both the scan and the
  // batch-inpaint promise.
  const [pendingAutoRemove, setPendingAutoRemove] = useState<string[] | null>(
    null,
  );
  const [isAutoRemoveInFlight, setIsAutoRemoveInFlight] = useState(false);
  const wasScanningRef = useRef(false);

  // Results screen for the "Remove Distractions from Album" modal — set once
  // a triggered pass finishes; cleared on retry or dismissal. lastAlbumLabels
  // remembers what was scanned for so Retry can run the exact same pass.
  const [albumRemoveResults, setAlbumRemoveResults] = useState<
    { label: string; count: number; imageCount: number }[] | null
  >(null);
  const lastAlbumLabelsRef = useRef<string[]>([]);
  // Non-null while the in-flight (or last) find-and-remove pass is scoped to a
  // filmstrip multi-selection rather than the whole album — read by the
  // completion effect, the count helpers, and the batch-remove call below so
  // every part of the pass stays scoped to the same set of images.
  const lastScanIndicesRef = useRef<number[] | null>(null);
  /** Number of images the *next* "Scan Entire Album" pass would actually
   *  touch — the filmstrip selection when it holds more than one image,
   *  otherwise undefined (whole album). */
  const scanSelectionCount =
    selectedImageIndices && selectedImageIndices.size > 1
      ? selectedImageIndices.size
      : undefined;

  // Whether the album itself has no scan data yet — drives the object panel's
  // switch from checkbox-picker to results.
  const albumPreScan = !hasScannedAlbum && !isDistractionScanning;
  // A selected object we haven't actually scanned for yet still needs finding
  // before it can be removed, so the CTA has to run a fresh scan+remove pass
  // rather than the plain retouch. Empty scannedLabels (pre-scan) makes every
  // selection count as unscanned, matching albumPreScan.
  const hasUnscannedSelection = selectedObjectLabels.some(
    (label) => !(scannedLabels?.has(label) ?? false),
  );
  // Show the "Find and remove" CTA whenever there's still something to scan
  // for (nothing scanned yet, or a newly-picked object outside the last scan),
  // or while a find-and-remove pass is already in flight.
  const showFindAndRemove =
    albumPreScan || hasUnscannedSelection || isAutoRemoveInFlight;

  useEffect(() => {
    const justFinishedScanning =
      wasScanningRef.current && !isDistractionScanning;
    wasScanningRef.current = isDistractionScanning;
    if (!justFinishedScanning || !pendingAutoRemove) return;

    const labels = pendingAutoRemove;
    setPendingAutoRemove(null);

    // Images touched — one per image that had at least one instance. Scoped
    // to lastScanIndicesRef when this pass was a filmstrip multi-selection,
    // so counts/results only reflect the images actually scanned this time.
    const scanIndices = lastScanIndicesRef.current;
    const inScope = (idx: number) => !scanIndices || scanIndices.includes(idx);
    const countForLabel = (label: string) => {
      if (!distractionMap) return 0;
      let count = 0;
      for (const [idx, dets] of distractionMap) {
        if (!inScope(idx)) continue;
        if (dets.some((d) => MODEL_TO_UI[d.label] === label)) count++;
      }
      return count;
    };
    // Raw instances removed across the scanned scope, for the modal's results
    // screen (e.g. "120 Thermostats").
    const instanceCountForLabel = (label: string) => {
      if (!distractionMap) return 0;
      let count = 0;
      for (const [idx, dets] of distractionMap) {
        if (!inScope(idx)) continue;
        count += dets.filter((d) => MODEL_TO_UI[d.label] === label).length;
      }
      return count;
    };
    const selectedWithCounts = labels.map((label) => ({
      label,
      count: countForLabel(label),
    }));

    const newRemoved = new Set(removedItems);
    labels.forEach((label) => newRemoved.add(label));

    // Wait for the batch inpaint to actually finish before flagging labels as
    // removed, so the Loupe dot indicators (keyed off removedItems) don't
    // fall out of sync with the real pixel patch in useInpaintStore.
    void Promise.resolve(
      onBatchRemove?.(labels, scanIndices ?? undefined),
    ).then(() => {
      onSetRemovedItems?.(newRemoved);

      // Preselect the Patch tab so the removal dots are already visible if
      // the user jumps into Loupe for an individual photo right after this.
      setActiveTab("patch");
      onTabChange?.("patch");

      setHistory((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          photoCount: selectedWithCounts.reduce((sum, o) => sum + o.count, 0),
          presets: [],
          objectsRemoved: selectedWithCounts,
        },
      ]);
      setResetSignal((s) => s + 1);
      setIsAutoRemoveInFlight(false);
      setAlbumRemoveResults(
        labels.map((label) => ({
          label,
          count: instanceCountForLabel(label),
          imageCount: countForLabel(label),
        })),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDistractionScanning, pendingAutoRemove, distractionMap]);

  // Shared core of "find and remove across the album" — scans for the given
  // labels, then (via the effect above) inpaints every match once the scan
  // completes. Used by both the grid's Smart Object Removal picker and the
  // loupe's "Remove Distractions from Album" modal.
  const runAlbumFindAndRemove = (labels: string[]) => {
    if (!labels.length) return;
    lastAlbumLabelsRef.current = labels;
    setAlbumRemoveResults(null);
    setPendingAutoRemove(labels);
    setIsAutoRemoveInFlight(true);
    if (selectedImageIndices && selectedImageIndices.size > 1) {
      const indices = Array.from(selectedImageIndices);
      lastScanIndicesRef.current = indices;
      onScanIndices?.(labels, indices);
    } else {
      lastScanIndicesRef.current = null;
      onScanAlbumRun?.(labels);
    }
  };

  const handleRetryAlbumRemove = () => {
    runAlbumFindAndRemove(lastAlbumLabelsRef.current);
  };

  const handleFindAndRemove = () => {
    runAlbumFindAndRemove(
      objectStateRef.current.selectedWithCounts.map((o) => o.label),
    );
  };

  // Cancelling only stops us from acting on the result once the in-flight
  // scan/inpaint settles — there's no abort hook into the model or the
  // batch inpaint promise itself, so the work already queued still runs.
  const handleCancelFindAndRemove = () => {
    setPendingAutoRemove(null);
    setIsAutoRemoveInFlight(false);
  };

  // Ticks once a second while the operation is running so the ETA below
  // keeps counting down even during the batch-inpaint sub-phase, where the
  // percent itself has no finer-grained signal to move on.
  const findAndRemoveStartRef = useRef<number | null>(null);
  const [, setFindAndRemoveTick] = useState(0);
  useEffect(() => {
    if (!isAutoRemoveInFlight) {
      findAndRemoveStartRef.current = null;
      return;
    }
    findAndRemoveStartRef.current ??= Date.now();
    const id = setInterval(() => setFindAndRemoveTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isAutoRemoveInFlight]);

  // Scanning reports real per-image progress; the batch-inpaint sub-phase
  // that follows has no equivalent signal, so it just holds just shy of done.
  const findAndRemovePercent = isDistractionScanning
    ? Math.min(95, Math.max(0, Math.round(distractionScanProgress)))
    : 97;
  const findAndRemoveEta = (() => {
    const elapsedMs = findAndRemoveStartRef.current
      ? Date.now() - findAndRemoveStartRef.current
      : 0;
    if (findAndRemovePercent <= 1 || elapsedMs < 1000) return "estimating…";
    const totalEstimateMs = (elapsedMs / findAndRemovePercent) * 100;
    const remainingMs = Math.max(0, totalEstimateMs - elapsedMs);
    if (remainingMs < 60000) return "<1 min";
    const mins = Math.round(remainingMs / 60000);
    return `${mins} min${mins === 1 ? "" : "s"}`;
  })();

  const isActive = subjectActive || objectActive;

  const handleStart = () => {
    const ss = subjectStateRef.current;
    const os = objectStateRef.current;

    const presets = [
      ...ss.selectedSubjects
        .filter((i) => !!ss.presets[`subject-${i}`])
        .map((i) => ({
          label: `Subject ${i + 1}`,
          preset: ss.presets[`subject-${i}`]!,
        })),
      ...ss.selectedGroups
        .filter((label) => !!ss.presets[`group-${label}`])
        .map((label) => ({ label, preset: ss.presets[`group-${label}`]! })),
      ...(ss.selectedModelSubjects ?? [])
        .filter((id) => !!ss.modelPresets?.[`model-${id}`])
        .map((id) => ({
          label: `Person ${id + 1}`,
          preset: ss.modelPresets![`model-${id}`]!,
        })),
    ];

    const subjectPhotoCount = ss.selectedSubjects.reduce(
      (sum, i) => sum + (ss.subjectCounts[i] ?? 0),
      0,
    );
    const modelPhotoCount = (ss.selectedModelSubjects ?? []).reduce(
      (sum, id) =>
        sum + (modelSubjects?.find((s) => s.id === id)?.photoCount ?? 0),
      0,
    );
    const objectPhotoCount = os.selectedWithCounts.reduce(
      (sum, o) => sum + o.count,
      0,
    );
    const photoCount = subjectPhotoCount + modelPhotoCount + objectPhotoCount;

    const entry: RetouchHistoryEntry = {
      id: history.length + 1,
      photoCount,
      presets,
      objectsRemoved: os.selectedWithCounts,
    };

    // Build persistent applied state from this run
    const newApplied: Record<string, string> = { ...appliedPresets };
    ss.selectedSubjects.forEach((i) => {
      const preset = ss.presets[`subject-${i}`];
      if (preset) newApplied[`subject-${i}`] = preset;
    });
    ss.selectedGroups.forEach((label) => {
      const preset = ss.presets[`group-${label}`];
      if (preset) newApplied[`group-${label}`] = preset;
    });
    (ss.selectedModelSubjects ?? []).forEach((id) => {
      const preset = ss.modelPresets?.[`model-${id}`];
      if (preset) newApplied[`model-${id}`] = preset;
    });

    const newRemoved = new Set(removedItems);
    os.selectedWithCounts.forEach(({ label }) => newRemoved.add(label));

    // Grid-level batch inpaint: actually patch every already-scanned photo that
    // contains one of the selected object types.
    const objectLabels = os.selectedWithCounts.map(({ label }) => label);
    const batchDone = objectLabels.length
      ? Promise.resolve(onBatchRemove?.(objectLabels))
      : Promise.resolve();

    setIsProcessing(true);

    // Wait for the actual batch inpaint to finish before flagging labels as
    // removed — a fixed timer here would let the Loupe dot indicators (which
    // key off removedItems) show or update out of sync with the real pixel
    // patch in useInpaintStore.
    void batchDone.then(() => {
      setHistory((prev) => [...prev, entry]);
      setAppliedPresets(newApplied);
      onSetRemovedItems?.(newRemoved);
      setResetSignal((s) => s + 1);
      setIsProcessing(false);
    });
  };

  return (
    <aside
      className={`${flexibleWidth ? "w-[26vw] min-w-[26vw]" : "w-[344px] min-w-[344px]"} bg-[#1c1c1c] flex flex-col relative border-l border-background`}
    >
      {/* Loupe tab bar */}
      {isLoupeView && (
        <div className="flex items-center gap-3 px-5 pt-3 shrink-0">
          {LOUPE_TABS.map(({ id, label, Icon }) => {
            const isDisabled = id === "background";
            return (
              <button
                key={id}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    setActiveTab(id);
                    onTabChange?.(id);
                  }
                }}
                className={`flex items-center gap-1 pl-1 pr-1.5 py-2 -mb-px border-b transition-colors ${
                  isDisabled
                    ? "border-transparent text-[#474747] cursor-not-allowed"
                    : activeTab === id
                      ? "border-[#e2e2e2] text-[#e2e2e2]"
                      : "border-transparent text-[#777] hover:text-[#ababab]"
                }`}
              >
                <Icon size={12} />
                <span className="text-[11px] font-semibold tracking-[0.5px] uppercase leading-3">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Retouching opportunity banner ──────────────────────────────────── */}
      <RetouchingOpportunityBanner
        visible={overlayVisible}
        onRetouch={() => {
          setActiveTab("subject");
          onTabChange?.("subject");
          setOpportunityDismissed(true);
        }}
      />

      <div
        className={`flex-1 flex flex-col relative${isLoupeView ? " overflow-hidden" : " overflow-y-auto"}`}
      >
        {isLoupeView ? (
          <>
            {activeTab === "subject" && (
              <LoupeSubjectPanel
                onScrollChange={setIsScrolledToBottom}
                currentImageIndex={currentImageIndex}
                syncedPresets={appliedPresets}
                onStateChange={(state) =>
                  setPerImageState((prev) => ({
                    ...prev,
                    [currentImageIndex]: state,
                  }))
                }
                pasteSignal={loupePasteSignal}
                loupeResetSignal={loupeResetSignal}
                modelSubjects={modelSubjects}
                modelImageMap={modelImageMap}
                isModelDetecting={isModelDetecting}
              />
            )}
            {activeTab === "background" && (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[12px] text-[#474747]">
                  Background coming soon
                </span>
              </div>
            )}
            {activeTab === "patch" && (
              <LoupePatchPanel
                onScrollChange={setIsScrolledToBottom}
                currentImageIndex={currentImageIndex}
                canvasHasStrokes={canvasHasStrokes}
                onClearCanvas={onClearCanvas}
                onInpaintCanvas={onInpaintCanvas}
                dismissedDetectionKeys={dismissedDetectionKeys}
                appliedDetectionKeys={appliedDetectionKeys}
                labelsWithSkips={labelsWithSkips}
                onSelectAllOccurrences={onSelectAllOccurrences}
                onRemoveAfterStrokeChange={onRemoveAfterStrokeChange}
                onRemovingChange={onRemovingChange}
                distractionMap={distractionMap}
                hasScanned={currentImageScanned}
                scannedLabels={scannedLabels}
                selectedImageCount={scanSelectionCount}
                isModelScanning={isDistractionScanning}
                onRerun={onDistractionRerunCurrent}
                onScanImage={onScanImage}
                // "Scan this album" opens the "Remove Distractions from Album"
                // modal (LoupePatchPanel-owned); this fires once the user
                // confirms which categories to find and remove.
                onScanAlbum={runAlbumFindAndRemove}
                albumRemoveProgress={
                  isAutoRemoveInFlight
                    ? {
                        percent: findAndRemovePercent,
                        eta: findAndRemoveEta,
                      }
                    : null
                }
                onCancelAlbumRemove={handleCancelFindAndRemove}
                albumRemoveResults={albumRemoveResults}
                onRetryAlbumRemove={handleRetryAlbumRemove}
                onDismissAlbumRemoveResults={() => setAlbumRemoveResults(null)}
                onReport={() =>
                  console.log(
                    "[DistractionDetection] User reported a missed detection",
                  )
                }
                removedItems={removedItems}
                onRemove={(labels) => onAddRemovedItems?.(labels)}
                onResetItem={(label) => onResetRemovedItem?.(label)}
                onBatchOffer={(labels) => setBatchOffer({ labels })}
                onResetImage={onResetImage}
                onSelectedLabelsChange={onDistractionSelectionChange}
                onHoveredLabelChange={onDistractionHoverChange}
                onRemoveSuccess={onDistractionRemoveSuccess}
                onSuggestSubmit={onSuggestObject}
              />
            )}
          </>
        ) : (
          <>
            {/* Subject sync hidden for now. */}
            {/* Smart Object Removal hidden in Grid view for now.
            <div className="py-5">
              {isAutoRemoveInFlight && (
                <div className="px-5 pb-4 flex flex-col gap-2">
                  <span className="text-[14px] text-[#e2e2e2] leading-4">
                    Finding and removing detections
                  </span>
                  <div className="h-1 w-full rounded-full bg-[#2e2e2e] overflow-hidden">
                    <div
                      className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
                      style={{ width: `${findAndRemovePercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#777] leading-4">
                      {findAndRemovePercent}% • {findAndRemoveEta}
                    </span>
                    <button
                      onClick={handleCancelFindAndRemove}
                      className="text-[12px] text-[#777] hover:text-[#e2e2e2] leading-4 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="h-px bg-[#303030] mt-2" />
                </div>
              )}
              <div
                className={`transition-opacity ${isAutoRemoveInFlight ? "opacity-25 pointer-events-none" : ""}`}
              >
                <SmartObjectRemoval
                  isScanning={isDistractionScanning}
                  preScan={albumPreScan}
                  disabled={isProcessing}
                  resetSignal={resetSignal}
                  removedItems={removedItems}
                  distractionMap={distractionMap}
                  scannedLabels={scannedLabels}
                  onRerun={(labels) => onScanAlbumRun?.(labels)}
                  onReport={() =>
                    console.log(
                      "[DistractionDetection] User reported a missed detection",
                    )
                  }
                  onSuggestSubmit={onSuggestObject}
                  onResetItem={(label) => onResetRemovedItem?.(label)}
                  onResetConfirmed={(label, count) =>
                    setHistory((prev) => [
                      ...prev,
                      {
                        id: prev.length + 1,
                        photoCount: count,
                        presets: [],
                        objectsRemoved: [],
                        restoredObjects: [{ label, count }],
                      },
                    ])
                  }
                  onSelectionsChange={(hasSelections) => {
                    setObjectActive(hasSelections);
                    if (hasSelections) onDismissObjectCoachmark?.();
                  }}
                  onStateChange={(s) => {
                    objectStateRef.current = s;
                    setSelectedObjectLabels(
                      s.selectedWithCounts.map((o) => o.label),
                    );
                  }}
                  coachmarkVisible={showObjectCoachmark}
                  initialSelectedLabels={initialObjectSelection}
                />
              </div>
            </div>
            */}
            {/* <div className="h-px bg-background" /> */}
            {/* <div className="px-5 py-5">
              <div className="w-1/2 flex gap-2">
                <div className="flex-1 h-8 flex items-center bg-[#242424] border-[0.5px] border-[#303030] rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { }}
                    className="flex-1 h-full flex items-center justify-center text-[#ababab] hover:text-[#e2e2e2] hover:bg-[#ffffff1a] transition-colors"
                  >
                    <FlipHorizontal size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { }}
                    className="flex-1 h-full flex items-center justify-center text-[#ababab] hover:text-[#e2e2e2] hover:bg-[#ffffff1a] transition-colors"
                  >
                    <FlipVertical size={16} />
                  </button>
                </div>
                <div className="flex-1 h-8 flex items-center bg-[#242424] border-[0.5px] border-[#303030] rounded-md overflow-hidden ">
                  <button
                    type="button"
                    onClick={() => { }}
                    className="flex-1 h-full flex items-center justify-center text-[#ababab] hover:text-[#e2e2e2] hover:bg-[#ffffff1a] transition-colors"
                  >
                    <Diamond size={16} className="-scale-x-100" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { }}
                    className="flex-1 h-full flex items-center justify-center text-[#ababab] hover:text-[#e2e2e2] hover:bg-[#ffffff1a] transition-colors"
                  >
                    <Diamond size={16} />
                  </button>
                </div>
              </div>
            </div> */}
          </>
        )}

        {!isLoupeView && (
          <div className="p-0">
            <div className="rounded-lg bg-[#1c1c1c] p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold text-[#e2e2e2] leading-5">
                  Begin Retouching
                </span>
                <span className="text-[13px] text-[#777] leading-4">
                  Retouching is only available in loupe view.
                </span>
              </div>
              <button
                onClick={onSwitchToLoupe}
                className="w-full py-2 rounded text-[12px] font-medium bg-[#303030] text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors"
              >
                Switch to Loupe View
              </button>
            </div>
          </div>
        )}
      </div>
      {/* {!isLoupeView && (() => {
        const isFindingAndRemoving = pendingAutoRemove !== null;
        const preScan = (!hasScannedAlbum && !isDistractionScanning) || isFindingAndRemoving;
        if (preScan) {
          return (
            <div className="p-4">
              <button
                disabled={isProcessing || isFindingAndRemoving || !objectActive}
                onClick={handleFindAndRemove}
                className={`w-full py-2 rounded text-[12px] font-medium transition-colors ${isFindingAndRemoving
                  ? "bg-[#1d56d1] text-white cursor-not-allowed"
                  : objectActive
                    ? "bg-[#2563eb] text-white hover:bg-[#1d56d1]"
                    : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
                  }`}
              >
                {isFindingAndRemoving ? "Finding and removing…" : "Find and remove"}
              </button>
            </div>
          );
        }
        return (
          <div className="p-4">
            <button
              disabled={isProcessing || !isActive}
              onClick={handleStart}
              className={`w-full py-2 rounded text-[12px] font-medium transition-colors ${isProcessing
                ? "bg-[#1d56d1] text-white cursor-not-allowed"
                : isActive
                  ? "bg-[#2563eb] text-white hover:bg-[#1d56d1]"
                  : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
                }`}
            >
              {isProcessing ? "Processing..." : "Start AI Retouching"}
            </button>
          </div>
        );
      })()} */}
      {isLoupeView && (
        <div
          className={`absolute left-0 right-0 h-10 pointer-events-none z-10 transition-opacity duration-300 ${
            isScrolledToBottom ? "opacity-0" : "opacity-100"
          }`}
          style={{
            bottom: 56,
            background:
              "linear-gradient(0deg, rgba(28, 28, 28, 0.00) 0%, #1C1C1C 88.66%)",
            transform: "rotate(180deg)",
          }}
        />
      )}
      {/* ── Album-wide batch-removal offer — pinned above the footer, above the
           scroll-fade gradient (z-20 > z-10). ─────────────────────────────── */}
      {/* {isLoupeView && activeTab === "patch" && batchOffer && (
        <div className="absolute left-0 right-0 bottom-0 z-20 px-4 pb-4">
          <BatchRemovalOffer
            labels={batchOffer.labels}
            onDismiss={() => setBatchOffer(null)}
            onGoToGrid={onGoToGrid}
          />
        </div>
      )} */}
      {isLoupeView && activeTab === "subject" && (
        <div className="flex gap-3 items-center px-4 py-3 bg-[#1c1c1c] shrink-0">
          <button
            disabled={!canPaste}
            onClick={() => {
              if (!canPaste || pasteSourceIndex === null) return;
              setLoupePasteSignal((prev) => ({
                state: perImageState[pasteSourceIndex],
                seq: (prev?.seq ?? 0) + 1,
              }));
            }}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded text-[12px] font-medium transition-colors ${
              canPaste
                ? "bg-[#303030] text-[#e2e2e2] hover:bg-[#3a3a3a] cursor-pointer"
                : "bg-[#303030] text-[#474747] cursor-not-allowed"
            }`}
          >
            Paste
          </button>
          <button
            disabled={!canReset}
            onClick={() => canReset && setLoupeResetSignal((s) => s + 1)}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded text-[12px] font-medium transition-colors ${
              canReset
                ? "bg-[#303030] text-[#e2e2e2] hover:bg-[#3a3a3a] cursor-pointer"
                : "bg-[#303030] text-[#474747] cursor-not-allowed"
            }`}
          >
            Reset
          </button>
        </div>
      )}
    </aside>
  );
};

export default RightPanel;
