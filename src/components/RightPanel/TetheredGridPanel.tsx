import { useState } from "react";
import { CameraIcon } from "@phosphor-icons/react";
import AIEditingGridPanel from "./AIEditingGridPanel";
import GridPanel from "./GridPanel";
import TetheringTab from "./RetouchingPanel/TetheringTab";
import type { ModelSubject } from "@/hooks/useFaceDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";

type PanelTab = "ai" | "tethering";

interface TetheredGridPanelProps {
  activeTopTab: string;
  // TetheringTab props
  currentImageSrc?: string;
  isTethering: boolean;
  isLoupeView?: boolean;
  onStartTethering: () => void;
  onCapture?: (autoAdvance: boolean, captureInfo: { addRaw: boolean; addJpeg: boolean; rawExt: string }) => void;
  initialTetherTab?: boolean;
  onTabChange?: (tab: PanelTab) => void;
  // GridPanel props (used when activeTopTab === "RETOUCH")
  isScanning: boolean;
  appliedPresets: Record<string, string>;
  removedItems: Set<string>;
  onAppliedPresetsChange: (presets: Record<string, string>) => void;
  onRemovedItemsSet: (items: Set<string>) => void;
  onResetRemovedItem: (label: string) => void;
  distractionMap?: Map<number, DistractionDetection[]>;
  isDistractionScanning?: boolean;
  onDistractionRerun?: () => void;
  visibleSubjectIndices?: Set<number> | null;
  modelSubjects?: ModelSubject[];
  isModelDetecting?: boolean;
  modelStatusMessage?: string;
  modelSubjectFilter?: number[];
  onSuggestObject?: (suggestion: string) => void;
}

const TetheredGridPanel = ({
  activeTopTab,
  currentImageSrc,
  isTethering,
  isLoupeView = false,
  onStartTethering,
  onCapture,
  initialTetherTab,
  onTabChange,
  isScanning,
  appliedPresets,
  removedItems,
  onAppliedPresetsChange,
  onRemovedItemsSet,
  onResetRemovedItem,
  distractionMap,
  isDistractionScanning,
  onDistractionRerun,
  visibleSubjectIndices,
  modelSubjects,
  isModelDetecting,
  modelStatusMessage,
  modelSubjectFilter,
  onSuggestObject,
}: TetheredGridPanelProps) => {
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTetherTab ? "tethering" : "ai");

  const handleTabChange = (tab: PanelTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const tabClass = (tab: PanelTab) =>
    `flex items-center gap-1 pl-1 pr-1.5 py-2 -mb-px border-b transition-colors text-[13px] font-medium ${
      activeTab === tab
        ? "border-[#e2e2e2] text-[#e2e2e2]"
        : "border-transparent text-[#777] hover:text-[#ababab]"
    }`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-5 pt-3 shrink-0">
        {/* <button onClick={() => handleTabChange("ai")} className={tabClass("ai")}>
          AI
        </button> */}
        {/* <button onClick={() => handleTabChange("tethering")} className={tabClass("tethering")}>
          <CameraIcon size={16} />
        </button> */}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {activeTab === "ai" && activeTopTab === "EDIT" && <AIEditingGridPanel />}
        {activeTab === "ai" && activeTopTab !== "EDIT" && (
          <GridPanel
            isScanning={isScanning}
            appliedPresets={appliedPresets}
            removedItems={removedItems}
            onAppliedPresetsChange={onAppliedPresetsChange}
            onRemovedItemsSet={onRemovedItemsSet}
            onResetRemovedItem={onResetRemovedItem}
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
        {activeTab === "tethering" && (
          <TetheringTab
            currentImageSrc={currentImageSrc}
            isTethering={isTethering}
            isLoupeView={isLoupeView}
            onStartTethering={onStartTethering}
            onCapture={onCapture}
          />
        )}
      </div>
    </div>
  );
};

export default TetheredGridPanel;
