import { useState, useEffect, useRef, useCallback } from "react";
import {
  SlidersHorizontalIcon,
  CropIcon,
  UserRectangleIcon,
  CameraIcon,
} from "@phosphor-icons/react";
import SlidersTab from "./SlidersTab";
import CropTab from "./CropTab";
import MaskTab from "./MaskTab";
import TetheringTab from "../RetouchingPanel/TetheringTab";

const EDITING_TABS = [
  { id: "sliders", Icon: SlidersHorizontalIcon, label: "Sliders" },
  { id: "crop", Icon: CropIcon, label: "Crop" },
  { id: "mask", Icon: UserRectangleIcon, label: "Mask" },
] as const;

type EditingTab = (typeof EDITING_TABS)[number]["id"] | "tethering";

interface EditingPanelProps {
  currentImageSrc?: string;
  isTethering?: boolean;
  onStartTethering?: () => void;
  onCapture?: (autoAdvance: boolean) => void;
  initialTab?: EditingTab;
  tetheringTabActive?: boolean;
  onTetheringTabActiveChange?: (active: boolean) => void;
  onCancelTethering?: () => void;
}

const EditingPanel = ({
  currentImageSrc,
  isTethering = false,
  onStartTethering,
  onCapture,
  initialTab,
  tetheringTabActive,
  onTetheringTabActiveChange,
  onCancelTethering,
}: EditingPanelProps) => {
  const [activeTab, setActiveTab] = useState<EditingTab>(initialTab ?? "sliders");
  const previousTabRef = useRef<EditingTab>("sliders");

  useEffect(() => {
    if (tetheringTabActive) setActiveTab("tethering");
  }, [tetheringTabActive]);

  const handleTabChange = (tab: EditingTab) => {
    if (tab === "tethering") previousTabRef.current = activeTab;
    setActiveTab(tab);
    onTetheringTabActiveChange?.(tab === "tethering");
  };

  const handleCancelSetup = useCallback(() => {
    const prev = previousTabRef.current;
    setActiveTab(prev);
    onTetheringTabActiveChange?.(false);
  }, [onTetheringTabActiveChange]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-5 pt-3 shrink-0">
        <div className="flex items-center gap-3">
          {EDITING_TABS.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-1 pl-1 pr-1.5 py-2 -mb-px border-b transition-colors ${
                activeTab === id
                  ? "border-[#e2e2e2] text-[#e2e2e2]"
                  : "border-transparent text-[#777] hover:text-[#ababab]"
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        <button
          onClick={() => handleTabChange("tethering")}
          className={`flex items-center gap-1 pl-1 pr-1.5 py-2 -mb-px border-b transition-colors ${
            activeTab === "tethering"
              ? "border-[#e2e2e2] text-[#e2e2e2]"
              : "border-transparent text-[#777] hover:text-[#ababab]"
          }`}
        >
          <CameraIcon size={16} />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {activeTab === "sliders" && <SlidersTab />}
        {activeTab === "crop" && <CropTab />}
        {activeTab === "mask" && <MaskTab />}
        {activeTab === "tethering" && (
          <TetheringTab
            currentImageSrc={currentImageSrc}
            isTethering={isTethering}
            isLoupeView={true}
            onStartTethering={onStartTethering ?? (() => {})}
            onCancelSetup={handleCancelSetup}
            onCancelTethering={onCancelTethering}
            onCapture={onCapture}
          />
        )}
      </div>
    </div>
  );
};

export default EditingPanel;
