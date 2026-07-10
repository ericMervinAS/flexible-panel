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
  onResetImage?: (label: string) => void;
  /** Grid-level batch: remove these UI labels across all already-scanned photos. */
  onBatchRemove?: (uiLabels: string[]) => void;
  /** Patch tab: scan just the current image. */
  onScanImage?: () => void;
  /** Patch tab: jump to the grid to scan the whole album. */
  onScanAlbum?: () => void;
  /** Grid: run album-wide detection for the selected UI labels. */
  onScanAlbumRun?: (labels: string[]) => void;
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
  onDistractionRerun?: () => void;
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
  /** Switch the app back to the grid view. */
  onGoToGrid?: () => void;
}

const RightPanel = ({
  isScanning,
  isLoupeView = false,
  currentImageIndex = 0,
  onTabChange,
  canvasHasStrokes = false,
  onClearCanvas,
  onInpaintCanvas,
  onResetImage,
  onBatchRemove,
  onScanImage,
  onScanAlbum,
  onScanAlbumRun,
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
  onDistractionRerun,
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
}: RightPanelProps) => {
  const [activeTab, setActiveTab] = useState<LoupeTab>("subject");
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [subjectActive, setSubjectActive] = useState(false);
  const [objectActive, setObjectActive] = useState(false);
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
  const [pendingAutoRemove, setPendingAutoRemove] = useState<string[] | null>(
    null,
  );
  const wasScanningRef = useRef(false);

  useEffect(() => {
    const justFinishedScanning =
      wasScanningRef.current && !isDistractionScanning;
    wasScanningRef.current = isDistractionScanning;
    if (!justFinishedScanning || !pendingAutoRemove) return;

    const labels = pendingAutoRemove;
    setPendingAutoRemove(null);

    const countForLabel = (label: string) => {
      if (!distractionMap) return 0;
      let count = 0;
      for (const dets of distractionMap.values()) {
        if (dets.some((d) => MODEL_TO_UI[d.label] === label)) count++;
      }
      return count;
    };
    const selectedWithCounts = labels.map((label) => ({
      label,
      count: countForLabel(label),
    }));

    onBatchRemove?.(labels);

    const newRemoved = new Set(removedItems);
    labels.forEach((label) => newRemoved.add(label));
    onSetRemovedItems?.(newRemoved);

    // Preselect the Patch tab so the removal dots are already visible if the
    // user jumps into Loupe for an individual photo right after this.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDistractionScanning, pendingAutoRemove, distractionMap]);

  const handleFindAndRemove = () => {
    const labels = objectStateRef.current.selectedWithCounts.map(
      (o) => o.label,
    );
    if (!labels.length) return;
    setPendingAutoRemove(labels);
    onScanAlbumRun?.(labels);
  };

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
    if (objectLabels.length) onBatchRemove?.(objectLabels);

    setIsProcessing(true);

    setTimeout(() => {
      setHistory((prev) => [...prev, entry]);
      setAppliedPresets(newApplied);
      onSetRemovedItems?.(newRemoved);
      setResetSignal((s) => s + 1);
      setIsProcessing(false);
    }, 3000);
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
                onRemoveAfterStrokeChange={onRemoveAfterStrokeChange}
                onRemovingChange={onRemovingChange}
                distractionMap={distractionMap}
                hasScanned={currentImageScanned}
                isModelScanning={isDistractionScanning}
                onRerun={onDistractionRerunCurrent}
                onScanImage={onScanImage}
                onScanAlbum={onScanAlbum}
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
            <div className="py-5">
              <SmartObjectRemoval
                isScanning={isDistractionScanning}
                preScan={!hasScannedAlbum && !isDistractionScanning}
                disabled={isProcessing}
                resetSignal={resetSignal}
                removedItems={removedItems}
                distractionMap={distractionMap}
                onRerun={onDistractionRerun}
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
                }}
                coachmarkVisible={showObjectCoachmark}
              />
            </div>
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

        {!isLoupeView &&
          (() => {
            const isFindingAndRemoving = pendingAutoRemove !== null;
            const preScan =
              (!hasScannedAlbum && !isDistractionScanning) ||
              isFindingAndRemoving;
            if (preScan) {
              return (
                <div className="p-4">
                  <button
                    disabled={
                      isProcessing || isFindingAndRemoving || !objectActive
                    }
                    onClick={handleFindAndRemove}
                    className={`w-full py-2 rounded text-[12px] font-medium transition-colors ${
                      isFindingAndRemoving
                        ? "bg-[#1d56d1] text-white cursor-not-allowed"
                        : objectActive
                          ? "bg-[#2563eb] text-white hover:bg-[#1d56d1]"
                          : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
                    }`}
                  >
                    {isFindingAndRemoving
                      ? "Finding and removing…"
                      : "Find and remove"}
                  </button>
                </div>
              );
            }
            return (
              <div className="p-4">
                <button
                  disabled={isProcessing || !isActive}
                  onClick={handleStart}
                  className={`w-full py-2 rounded text-[12px] font-medium transition-colors ${
                    isProcessing
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
          })()}
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
      {isLoupeView && activeTab === "patch" && batchOffer && (
        <div className="absolute left-0 right-0 bottom-0 z-20 px-4 pb-4">
          <BatchRemovalOffer
            labels={batchOffer.labels}
            onDismiss={() => setBatchOffer(null)}
            onGoToGrid={onGoToGrid}
          />
        </div>
      )}
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
