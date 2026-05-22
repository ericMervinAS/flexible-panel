import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { UserIcon, StackIcon, EraserIcon, CameraIcon } from "@phosphor-icons/react";
import SubjectTab, { LoupeRetouchState } from "./SubjectTab";
import BackgroundTab from "./BackgroundTab";
import PatchTab from "./PatchTab";
import TetheringTab from "./TetheringTab";
import type { ModelSubject } from "@/hooks/useFaceDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";

const LOUPE_TABS = [
  { id: "subject", Icon: UserIcon },
  { id: "background", Icon: StackIcon },
  { id: "patch", Icon: EraserIcon },
  { id: "tethering", Icon: CameraIcon },
] as const;

export type LoupeTab = typeof LOUPE_TABS[number]["id"];

interface LoupePanelProps {
  currentImageIndex: number;
  currentImageSrc?: string;
  isTethering?: boolean;
  showTetheringTab?: boolean;
  onStartTethering?: () => void;
  onCapture?: (autoAdvance: boolean, captureInfo: { addRaw: boolean; addJpeg: boolean }) => void;
  tetheringTabActive?: boolean;
  onTetheringTabActiveChange?: (active: boolean) => void;
  appliedPresets: Record<string, string>;
  removedItems: Set<string>;
  onAddRemovedItems: (labels: Set<string>) => void;
  onResetRemovedItem: (label: string) => void;
  canvasHasStrokes?: boolean;
  onClearCanvas?: () => void;
  onRemoveAfterStrokeChange?: (v: boolean) => void;
  onRemovingChange?: (v: boolean) => void;
  modelSubjects?: ModelSubject[];
  modelImageMap?: Map<number, number[]>;
  isModelDetecting?: boolean;
  distractionMap?: Map<number, DistractionDetection[]>;
  isDistractionScanning?: boolean;
  onDistractionRerunCurrent?: () => void;
  onDistractionSelectionChange?: (labels: Set<string>) => void;
  onDistractionHoverChange?: (label: string | null) => void;
  onDistractionRemoveSuccess?: (count: number, brushOnly: boolean) => void;
  onSuggestObject?: (suggestion: string) => void;
  tabOverride?: { tab: LoupeTab; seq: number } | null;
  onTabChange?: (tab: string) => void;
  onScrollChange?: (atBottom: boolean) => void;
  forceSubjectTabSignal?: number;
  onStateChange?: (index: number, state: LoupeRetouchState) => void;
  onCancelTethering?: () => void;
  filmstripSelection?: Set<number>;
  directPanel?: boolean;
}

const RetouchingPanel = ({
  currentImageIndex,
  currentImageSrc,
  isTethering = false,
  showTetheringTab = false,
  onStartTethering,
  onCapture,
  tetheringTabActive,
  onTetheringTabActiveChange,
  appliedPresets,
  removedItems,
  onAddRemovedItems,
  onResetRemovedItem,
  canvasHasStrokes,
  onClearCanvas,
  onRemoveAfterStrokeChange,
  onRemovingChange,
  modelSubjects,
  modelImageMap,
  isModelDetecting,
  distractionMap,
  isDistractionScanning,
  onDistractionRerunCurrent,
  onDistractionSelectionChange,
  onDistractionHoverChange,
  onDistractionRemoveSuccess,
  onSuggestObject,
  tabOverride,
  onTabChange,
  onScrollChange,
  forceSubjectTabSignal,
  onCancelTethering,
  filmstripSelection,
  directPanel = false,
}: LoupePanelProps) => {
  const [activeTab, setActiveTab] = useState<LoupeTab>("subject");
  const [perImageState, setPerImageState] = useState<Record<number, LoupeRetouchState>>({});
  const previousTabRef = useRef<LoupeTab>("subject");

  useEffect(() => {
    if (tetheringTabActive) setActiveTab("tethering");
  }, [tetheringTabActive]);

  const handleTabChange = (tab: LoupeTab) => {
    if (tab === "tethering") previousTabRef.current = activeTab;
    setActiveTab(tab);
    onTabChange?.(tab);
    onTetheringTabActiveChange?.(tab === "tethering");
  };

  const handleCancelSetup = useCallback(() => {
    const prev = previousTabRef.current;
    setActiveTab(prev);
    onTabChange?.(prev);
    onTetheringTabActiveChange?.(false);
  }, [onTabChange, onTetheringTabActiveChange]);
  const [pasteSourceIndex, setPasteSourceIndex] = useState<number | null>(null);
  const [loupeResetSignal, setLoupeResetSignal] = useState(0);
  const [loupePasteSignal, setLoupePasteSignal] = useState<{ state: LoupeRetouchState; seq: number } | null>(null);
  const prevImageIndexRef = useRef<number | null>(null);
  // Always holds the latest perImageState so effects can read it without stale closure issues
  const perImageStateRef = useRef(perImageState);
  perImageStateRef.current = perImageState;

  useEffect(() => {
    if (prevImageIndexRef.current === null) {
      prevImageIndexRef.current = currentImageIndex;
      return;
    }
    if (prevImageIndexRef.current !== currentImageIndex) {
      setPasteSourceIndex(prevImageIndexRef.current);
      prevImageIndexRef.current = currentImageIndex;
      // Restore any previously-saved or synced state for the new image.
      // perImageStateRef still holds the pre-navigation snapshot here because
      // SubjectTab's onStateChange setState hasn't flushed a new render yet.
      const savedState = perImageStateRef.current[currentImageIndex];
      if (savedState && hasRetouches(savedState)) {
        setLoupePasteSignal((prev) => ({ state: savedState, seq: (prev?.seq ?? 0) + 1 }));
      }
    }
  }, [currentImageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tabOverride) return;
    setActiveTab(tabOverride.tab);
    onTabChange?.(tabOverride.tab);
  }, [tabOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (forceSubjectTabSignal) setActiveTab("subject");
  }, [forceSubjectTabSignal]);

  const hasRetouches = (state: LoupeRetouchState | undefined): boolean => {
    if (!state) return false;
    const hasSliders = Object.values(state.sliderLayers).some((layer) =>
      layer.some((row) => row.some((v) => v !== null))
    );
    const hasPresets = Object.values(state.localPresets).some((v) => v !== null);
    return hasSliders || hasPresets || state.customized.size > 0;
  };

  const isSync = useMemo(() => (filmstripSelection?.size ?? 0) > 0, [filmstripSelection]);
  const canPaste = !isSync && pasteSourceIndex !== null && hasRetouches(perImageState[pasteSourceIndex]);
  const canSync = isSync && hasRetouches(perImageState[currentImageIndex]);
  const canReset = hasRetouches(perImageState[currentImageIndex]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-5 pt-3 shrink-0">
        <div className="flex items-center gap-3">
          {LOUPE_TABS.slice(0, -1).map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-1 pl-1 pr-1.5 py-2 -mb-px border-b transition-colors ${activeTab === id
                ? "border-[#e2e2e2] text-[#e2e2e2]"
                : "border-transparent text-[#777] hover:text-[#ababab]"
                }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        {showTetheringTab && (() => {
          const { id, Icon } = LOUPE_TABS[LOUPE_TABS.length - 1];
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-1 pl-1 pr-1.5 py-2 -mb-px border-b transition-colors ${activeTab === id
                ? "border-[#e2e2e2] text-[#e2e2e2]"
                : "border-transparent text-[#777] hover:text-[#ababab]"
                }`}
            >
              <Icon size={16} />
            </button>
          );
        })()}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {activeTab === "subject" && (
          <SubjectTab
            onScrollChange={onScrollChange}
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
        {activeTab === "background" && <BackgroundTab />}
        {activeTab === "patch" && (
          <PatchTab
            onScrollChange={onScrollChange}
            currentImageIndex={currentImageIndex}
            canvasHasStrokes={canvasHasStrokes}
            onClearCanvas={onClearCanvas}
            onRemoveAfterStrokeChange={onRemoveAfterStrokeChange}
            onRemovingChange={onRemovingChange}
            distractionMap={distractionMap}
            isDistractionScanning={isDistractionScanning}
            onDistractionRerunCurrent={onDistractionRerunCurrent}
            onDistractionSelectionChange={onDistractionSelectionChange}
            onDistractionHoverChange={onDistractionHoverChange}
            onDistractionRemoveSuccess={onDistractionRemoveSuccess}
            onSuggestObject={onSuggestObject}
            removedItems={removedItems}
            onAddRemovedItems={onAddRemovedItems}
            onResetRemovedItem={onResetRemovedItem}
          />
        )}
        {activeTab === "tethering" && (
          <TetheringTab
            currentImageSrc={currentImageSrc}
            isTethering={isTethering}
            isLoupeView={true}
            onStartTethering={onStartTethering ?? (() => {})}
            onCancelSetup={handleCancelSetup}
            onCancelTethering={onCancelTethering}
            onCapture={onCapture}
            directPanel={directPanel}
          />
        )}
      </div>

      {/* Paste / Reset footer */}
      {(activeTab === "subject" || activeTab === "tethering") && (
        <div className="flex gap-3 items-center px-4 py-3 bg-[#1c1c1c] shrink-0">
          <button
            disabled={isSync ? !canSync : !canPaste}
            onClick={() => {
              if (isSync) {
                if (!canSync) return;
                const sourceState = perImageState[currentImageIndex];
                setPerImageState((prev) => {
                  const next = { ...prev };
                  filmstripSelection!.forEach((idx) => {
                    if (idx !== currentImageIndex) next[idx] = sourceState;
                  });
                  return next;
                });
              } else {
                if (!canPaste || pasteSourceIndex === null) return;
                setLoupePasteSignal((prev) => ({
                  state: perImageState[pasteSourceIndex],
                  seq: (prev?.seq ?? 0) + 1,
                }));
              }
            }}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded text-[12px] font-medium transition-colors ${(isSync ? canSync : canPaste)
              ? "bg-[#303030] text-[#e2e2e2] hover:bg-[#3a3a3a] cursor-pointer"
              : "bg-[#303030] text-[#474747] cursor-not-allowed"
              }`}
          >
            {isSync ? "Sync" : "Paste"}
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
    </div>
  );
};

export default RetouchingPanel;
