import { useState, useEffect } from "react";
import RetouchingOpportunityBanner from "../RetouchingOpportunityBanner";
import GridPanel from "./GridPanel";
import RetouchingPanel, { LoupeTab } from "./RetouchingPanel";
import EditingPanel from "./EditingPanel";
import AIEditingGridPanel from "./AIEditingGridPanel";
import TetheredGridPanel from "./TetheredGridPanel";
import type { ModelSubject } from "@/hooks/useFaceDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";

interface RightPanelProps {
  isScanning: boolean;
  isLoupeView?: boolean;
  currentImageIndex?: number;
  currentImageSrc?: string;
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
  flexibleWidth?: boolean;
  activeTopTab?: string;
  isTethering?: boolean;
  onStartTethering?: () => void;
  onCapture?: (autoAdvance: boolean) => void;
  initialEditingTab?: string;
  onCancelTethering?: () => void;
}

const RightPanel = ({
  isScanning,
  isLoupeView = false,
  currentImageIndex = 0,
  currentImageSrc,
  onTabChange,
  canvasHasStrokes = false,
  onClearCanvas,
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
  isDistractionScanning = false,
  onDistractionRerun,
  onDistractionRerunCurrent,
  onDistractionSelectionChange,
  onDistractionHoverChange,
  onDistractionRemoveSuccess,
  onSuggestObject,
  flexibleWidth = false,
  activeTopTab = "RETOUCH",
  isTethering = false,
  onStartTethering,
  onCapture,
  initialEditingTab,
  onCancelTethering,
}: RightPanelProps) => {
  const [appliedPresets, setAppliedPresets] = useState<Record<string, string>>({});
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const [tetheringTabActive, setTetheringTabActive] = useState(false);

  // Retouching opportunity overlay
  const [opportunityDismissed, setOpportunityDismissed] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [forceSubjectTabSignal, setForceSubjectTabSignal] = useState(0);

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

  const handleAddRemovedItems = (labels: Set<string>) =>
    setRemovedItems((prev) => {
      const next = new Set(prev);
      labels.forEach((l) => next.add(l));
      return next;
    });

  const handleResetRemovedItem = (label: string) =>
    setRemovedItems((prev) => {
      const next = new Set(prev);
      next.delete(label);
      return next;
    });

  return (
    <aside
      className={`${flexibleWidth ? "w-[26vw] min-w-[26vw]" : "w-[344px] min-w-[344px]"} bg-[#1c1c1c] flex flex-col relative border-l border-background`}
    >
      <RetouchingOpportunityBanner
        visible={overlayVisible}
        onRetouch={() => {
          onTabChange?.("subject");
          setOpportunityDismissed(true);
          setForceSubjectTabSignal((s) => s + 1);
        }}
      />

      {isLoupeView ? (
        <>
          <div
            className={`flex-1 flex flex-col overflow-hidden ${activeTopTab !== "EDIT" ? "hidden" : ""}`}
          >
            <EditingPanel
              currentImageSrc={currentImageSrc}
              isTethering={isTethering}
              onStartTethering={onStartTethering}
              onCapture={onCapture}
              initialTab={
                initialEditingTab as "sliders" | "crop" | "mask" | "tethering" | undefined
              }
              tetheringTabActive={tetheringTabActive}
              onTetheringTabActiveChange={setTetheringTabActive}
              onCancelTethering={onCancelTethering}
            />
          </div>
          <div
            className={`flex-1 flex flex-col overflow-hidden ${activeTopTab === "EDIT" ? "hidden" : ""}`}
          >
            <RetouchingPanel
              currentImageIndex={currentImageIndex}
              currentImageSrc={currentImageSrc}
              appliedPresets={appliedPresets}
              removedItems={removedItems}
              onAddRemovedItems={handleAddRemovedItems}
              onResetRemovedItem={handleResetRemovedItem}
              canvasHasStrokes={canvasHasStrokes}
              onClearCanvas={onClearCanvas}
              onRemoveAfterStrokeChange={onRemoveAfterStrokeChange}
              onRemovingChange={onRemovingChange}
              modelSubjects={modelSubjects}
              modelImageMap={modelImageMap}
              isModelDetecting={isModelDetecting}
              distractionMap={distractionMap}
              isDistractionScanning={isDistractionScanning}
              onDistractionRerunCurrent={onDistractionRerunCurrent}
              onDistractionSelectionChange={onDistractionSelectionChange}
              onDistractionHoverChange={onDistractionHoverChange}
              onDistractionRemoveSuccess={onDistractionRemoveSuccess}
              onSuggestObject={onSuggestObject}
              tabOverride={tabOverride}
              onTabChange={onTabChange}
              onScrollChange={setIsScrolledToBottom}
              forceSubjectTabSignal={forceSubjectTabSignal}
              isTethering={isTethering}
              onStartTethering={onStartTethering}
              onCapture={onCapture}
              tetheringTabActive={tetheringTabActive}
              onTetheringTabActiveChange={setTetheringTabActive}
              onCancelTethering={onCancelTethering}
            />
          </div>
        </>
      ) : isTethering ? (
        <TetheredGridPanel
          activeTopTab={activeTopTab}
          currentImageSrc={currentImageSrc}
          isTethering={isTethering}
          onStartTethering={onStartTethering ?? (() => {})}
          onCapture={onCapture}
          isScanning={isScanning}
          appliedPresets={appliedPresets}
          removedItems={removedItems}
          onAppliedPresetsChange={setAppliedPresets}
          onRemovedItemsSet={setRemovedItems}
          onResetRemovedItem={handleResetRemovedItem}
          distractionMap={distractionMap}
          isDistractionScanning={isDistractionScanning}
          onDistractionRerun={onDistractionRerun}
          visibleSubjectIndices={visibleSubjectIndices}
          modelSubjects={modelSubjects}
          isModelDetecting={isModelDetecting}
          modelStatusMessage={modelStatusMessage}
          modelSubjectFilter={modelSubjectFilter}
          onSuggestObject={onSuggestObject}
        />
      ) : activeTopTab === "EDIT" ? (
        <AIEditingGridPanel />
      ) : (
        <GridPanel
          isScanning={isScanning}
          appliedPresets={appliedPresets}
          removedItems={removedItems}
          onAppliedPresetsChange={setAppliedPresets}
          onRemovedItemsSet={setRemovedItems}
          onResetRemovedItem={handleResetRemovedItem}
          distractionMap={distractionMap}
          isDistractionScanning={isDistractionScanning}
          onDistractionRerun={onDistractionRerun}
          visibleSubjectIndices={visibleSubjectIndices}
          modelSubjects={modelSubjects}
          isModelDetecting={isModelDetecting}
          modelStatusMessage={modelStatusMessage}
          modelSubjectFilter={modelSubjectFilter}
          onSuggestObject={onSuggestObject}
        />
      )}

      {/* Scroll fade gradient – only visible in loupe view above the footer */}
      {isLoupeView && (
        <div
          className={`absolute left-0 right-0 h-10 pointer-events-none z-10 transition-opacity duration-300 ${
            isScrolledToBottom ? "opacity-0" : "opacity-100"
          }`}
          style={{
            bottom: 56,
            background: "linear-gradient(0deg, rgba(28, 28, 28, 0.00) 0%, #1C1C1C 88.66%)",
            transform: "rotate(180deg)",
          }}
        />
      )}
    </aside>
  );
};

export default RightPanel;
