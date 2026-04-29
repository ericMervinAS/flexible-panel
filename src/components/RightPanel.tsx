import { useState, useRef, useEffect } from "react";
import { User, Stack, Eraser } from "@phosphor-icons/react";
import SubjectSync, { SubjectSyncState } from "./SubjectSync";
import SmartObjectRemoval, { SmartObjectState } from "./SmartObjectRemoval";
import { RetouchHistoryEntry } from "./RetouchHistory";
import LoupeSubjectPanel, { LoupeRetouchState } from "./LoupeSubjectPanel";
import LoupePatchPanel from "./LoupePatchPanel";
import RetouchingOpportunityBanner from "./RetouchingOpportunityBanner";
import type { ModelSubject } from "@/hooks/useFaceDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";

const LOUPE_TABS = [
  { id: "subject", label: "Subject", Icon: User },
  { id: "background", label: "Background", Icon: Stack },
  { id: "patch", label: "Patch", Icon: Eraser },
] as const;

type LoupeTab = typeof LOUPE_TABS[number]["id"];

interface RightPanelProps {
  isScanning: boolean;
  isLoupeView?: boolean;
  currentImageIndex?: number;
  onTabChange?: (tab: string) => void;
  canvasHasStrokes?: boolean;
  onClearCanvas?: () => void;
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
  isDistractionScanning?: boolean;
  onDistractionRerun?: () => void;
  onDistractionRerunCurrent?: () => void;
  onDistractionSelectionChange?: (labels: Set<string>) => void;
  onDistractionHoverChange?: (label: string | null) => void;
  onDistractionRemoveSuccess?: (count: number, brushOnly: boolean) => void;
  onSuggestObject?: (suggestion: string) => void;
}

const RightPanel = ({ isScanning, isLoupeView = false, currentImageIndex = 0, onTabChange, canvasHasStrokes = false, onClearCanvas, onRemoveAfterStrokeChange, onRemovingChange, visibleSubjectIndices, modelSubjects, modelImageMap, isModelDetecting, modelStatusMessage, modelSubjectFilter, tabOverride, hasRetouchingOpportunity = false, distractionMap, isDistractionScanning = false, onDistractionRerun, onDistractionRerunCurrent, onDistractionSelectionChange, onDistractionHoverChange, onDistractionRemoveSuccess, onSuggestObject }: RightPanelProps) => {
  const [activeTab, setActiveTab] = useState<LoupeTab>("subject");
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [subjectActive, setSubjectActive] = useState(false);
  const [objectActive, setObjectActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [history, setHistory] = useState<RetouchHistoryEntry[]>([]);
  const [appliedPresets, setAppliedPresets] = useState<Record<string, string>>({});
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());

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
  const [perImageState, setPerImageState] = useState<Record<number, LoupeRetouchState>>({});
  const [pasteSourceIndex, setPasteSourceIndex] = useState<number | null>(null);
  const [loupeResetSignal, setLoupeResetSignal] = useState(0);
  const [loupePasteSignal, setLoupePasteSignal] = useState<{ state: LoupeRetouchState; seq: number } | null>(null);
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
      layer.some((row) => row.some((v) => v !== null))
    );
    const hasPresets = Object.values(state.localPresets).some((v) => v !== null);
    return hasSliders || hasPresets || state.customized.size > 0;
  };

  const canPaste = pasteSourceIndex !== null && hasRetouches(perImageState[pasteSourceIndex]);
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

  const isActive = subjectActive || objectActive;

  const handleStart = () => {
    const ss = subjectStateRef.current;
    const os = objectStateRef.current;

    const presets = [
      ...ss.selectedSubjects
        .filter((i) => !!ss.presets[`subject-${i}`])
        .map((i) => ({ label: `Subject ${i + 1}`, preset: ss.presets[`subject-${i}`]! })),
      ...ss.selectedGroups
        .filter((label) => !!ss.presets[`group-${label}`])
        .map((label) => ({ label, preset: ss.presets[`group-${label}`]! })),
      ...(ss.selectedModelSubjects ?? [])
        .filter((id) => !!(ss.modelPresets?.[`model-${id}`]))
        .map((id) => ({ label: `Person ${id + 1}`, preset: ss.modelPresets![`model-${id}`]! })),
    ];

    const subjectPhotoCount = ss.selectedSubjects.reduce(
      (sum, i) => sum + (ss.subjectCounts[i] ?? 0),
      0
    );
    const modelPhotoCount = (ss.selectedModelSubjects ?? []).reduce(
      (sum, id) => sum + (modelSubjects?.find((s) => s.id === id)?.photoCount ?? 0),
      0
    );
    const objectPhotoCount = os.selectedWithCounts.reduce(
      (sum, o) => sum + o.count,
      0
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

    setIsProcessing(true);

    setTimeout(() => {
      setHistory((prev) => [...prev, entry]);
      setAppliedPresets(newApplied);
      setRemovedItems(newRemoved);
      setResetSignal((s) => s + 1);
      setIsProcessing(false);
    }, 3000);
  };

  return (
    <aside className="w-[344px] min-w-[344px] bg-[#1c1c1c] flex flex-col relative border-l border-background">
      {/* Loupe tab bar */}
      {isLoupeView && (
        <div className="flex items-center gap-3 px-5 pt-3 shrink-0">
          {LOUPE_TABS.map(({ id, label, Icon }) => {
            const isDisabled = id === "background";
            return (
              <button
                key={id}
                disabled={isDisabled}
                onClick={() => { if (!isDisabled) { setActiveTab(id); onTabChange?.(id); } }}
                className={`flex items-center gap-1 pl-1 pr-1.5 py-2 -mb-px border-b transition-colors ${isDisabled
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
        onRetouch={() => { setActiveTab("subject"); onTabChange?.("subject"); setOpportunityDismissed(true); }}
      />

      <div className={`flex-1 flex flex-col relative${isLoupeView ? " overflow-hidden" : " overflow-y-auto"}`}>
        {isLoupeView ? (
          <>
            {activeTab === "subject" && (
              <LoupeSubjectPanel
                onScrollChange={setIsScrolledToBottom}
                currentImageIndex={currentImageIndex}
                syncedPresets={appliedPresets}
                onStateChange={(state) => setPerImageState((prev) => ({ ...prev, [currentImageIndex]: state }))}
                pasteSignal={loupePasteSignal}
                loupeResetSignal={loupeResetSignal}
                modelSubjects={modelSubjects}
                modelImageMap={modelImageMap}
                isModelDetecting={isModelDetecting}
              />
            )}
            {activeTab === "background" && (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[12px] text-[#474747]">Background coming soon</span>
              </div>
            )}
            {activeTab === "patch" && (
              <LoupePatchPanel
                onScrollChange={setIsScrolledToBottom}
                currentImageIndex={currentImageIndex}
                canvasHasStrokes={canvasHasStrokes}
                onClearCanvas={onClearCanvas}
                onRemoveAfterStrokeChange={onRemoveAfterStrokeChange}
                onRemovingChange={onRemovingChange}
                distractionMap={distractionMap}
                isModelScanning={isDistractionScanning}
                onRerun={onDistractionRerunCurrent}
                onReport={() => console.log('[DistractionDetection] User reported a missed detection')}
                removedItems={removedItems}
                onRemove={(labels) =>
                  setRemovedItems((prev) => {
                    const next = new Set(prev);
                    labels.forEach((l) => next.add(l));
                    return next;
                  })
                }
                onResetItem={(label) =>
                  setRemovedItems((prev) => {
                    const next = new Set(prev);
                    next.delete(label);
                    return next;
                  })
                }
                onSelectedLabelsChange={onDistractionSelectionChange}
                onHoveredLabelChange={onDistractionHoverChange}
                onRemoveSuccess={onDistractionRemoveSuccess}
                onSuggestSubmit={onSuggestObject}
              />
            )}
          </>
        ) : (
          <>
            <div className="py-5">
              <SubjectSync
                isScanning={isScanning}
                disabled={isProcessing}
                resetSignal={resetSignal}
                appliedPresets={appliedPresets}
                visibleSubjectIndices={visibleSubjectIndices}
                onSelectionsChange={setSubjectActive}
                onStateChange={(s) => { subjectStateRef.current = s; }}
                modelSubjects={modelSubjects}
                isModelDetecting={isModelDetecting}
                modelStatusMessage={modelStatusMessage}
                modelSubjectFilter={modelSubjectFilter}
              />
            </div>
            <div className="h-px bg-background" />
            <div className="py-5">
              <SmartObjectRemoval
                isScanning={isDistractionScanning}
                disabled={isProcessing}
                resetSignal={resetSignal}
                removedItems={removedItems}
                distractionMap={distractionMap}
                onRerun={onDistractionRerun}
                onReport={() => console.log('[DistractionDetection] User reported a missed detection')}
                onSuggestSubmit={onSuggestObject}
                onResetItem={(label) =>
                  setRemovedItems((prev) => {
                    const next = new Set(prev);
                    next.delete(label);
                    return next;
                  })
                }
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
                onSelectionsChange={setObjectActive}
                onStateChange={(s) => { objectStateRef.current = s; }}
              />
            </div>
          </>
        )}
      </div>
      {!isLoupeView && (
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
      )}
      {isLoupeView && (
        <div
          className={`absolute left-0 right-0 h-10 pointer-events-none z-10 transition-opacity duration-300 ${isScrolledToBottom ? "opacity-0" : "opacity-100"
            }`}
          style={{
            bottom: 56,
            background: "linear-gradient(0deg, rgba(28, 28, 28, 0.00) 0%, #1C1C1C 88.66%)",
            transform: "rotate(180deg)",
          }}
        />
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
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded text-[12px] font-medium transition-colors ${canPaste
              ? "bg-[#303030] text-[#e2e2e2] hover:bg-[#3a3a3a] cursor-pointer"
              : "bg-[#303030] text-[#474747] cursor-not-allowed"
              }`}
          >
            Paste
          </button>
          <button
            disabled={!canReset}
            onClick={() => canReset && setLoupeResetSignal((s) => s + 1)}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded text-[12px] font-medium transition-colors ${canReset
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
