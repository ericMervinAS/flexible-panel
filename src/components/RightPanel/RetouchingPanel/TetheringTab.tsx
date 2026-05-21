import { useState, useRef } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import PinnedSlidersCard from "../../PinnedSlidersCard";
import { BatteryHigh, GearIcon } from "@phosphor-icons/react";
import Accordion from "../../Accordion";
import PresetDropdown from "../../PresetDropdown";
import SliderRow from "../../SliderRow";
import Tooltip from "../../Tooltip";
import {
  APERTURE_STOPS,
  SHUTTER_STOPS,
  ISO_STOPS,
  WB_OPTIONS,
  ASPECT_OPTIONS,
  FOCUS_OPTIONS,
  SHOOT_OPTIONS,
  getCameraSpec,
  getFormatOptions,
} from "./tethering/constants";
import { Toggle } from "./tethering/Toggle";
import { InlineSelect } from "./tethering/InlineSelect";
import { CameraCard } from "./tethering/CameraCard";
import { ProfileSection } from "./tethering/ProfileSection";
import { TetherWelcomeModal } from "./tethering/modals/TetherWelcomeModal";
import { TetherCameraSelectModal } from "./tethering/modals/TetherCameraSelectModal";
import { TetherDetectModal } from "./tethering/modals/TetherDetectModal";
import { TetherSetupModal } from "./tethering/modals/TetherSetupModal";

interface TetheringTabProps {
  currentImageSrc?: string;
  isTethering: boolean;
  isLoupeView?: boolean;
  onStartTethering: () => void;
  onCancelSetup?: () => void;
  onCancelTethering?: () => void;
  onCapture?: (autoAdvance: boolean) => void;
}

const TetheringTab = ({
  currentImageSrc,
  isTethering,
  isLoupeView = false,
  onStartTethering,
  onCancelSetup,
  onCancelTethering,
  onCapture,
}: TetheringTabProps) => {
  const [pinnedSliders, setPinnedSliders] = useSessionState<Set<string>>(
    "subjectTab:pinnedSliders",
    new Set(),
    { serialize: (s) => [...s], deserialize: (a) => new Set(a as string[]) }
  );
  const [favValues, setFavValues] = useSessionState<Record<string, number>>("favorites:values", {});

  const togglePin = (sIdx: number, sliderIdx: number) => {
    const key = `${sIdx}:${sliderIdx}`;
    setPinnedSliders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [apertureIdx, setApertureIdx] = useState(5);
  const [shutterIdx, setShutterIdx] = useState(4);
  const [isoIdx, setIsoIdx] = useState(1);
  const [wbIdx, setWbIdx] = useState(0);
  const [destination, setDestination] = useState("/Users/photographer/Desktop/Shoot");
  const [cameraName, setCameraName] = useState("Nikon Z6 III");
  const cameraSpec = getCameraSpec(cameraName);
  const formatOptions = getFormatOptions(cameraSpec);
  const [fileFormat, setFileFormat] = useState(() => {
    const spec = getCameraSpec("Nikon Z6 III");
    return `${spec.raw} + JPEG ${spec.jpegQualities[0]}`;
  });

  const [rawProfile, setRawProfile] = useState<string | null>(null);
  const [jpegProfile, setJpegProfile] = useState<string | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<"raw" | "jpeg">("raw");

  const [aiCropping, setAiCropping] = useState(true);
  const [cropStyle, setCropStyle] = useState("Loose");
  const [cropOrientation, setCropOrientation] = useState("Default");
  const [aiStraightening, setAiStraightening] = useState(true);
  const [aiMasking, setAiMasking] = useState(true);
  const [maskMode, setMaskMode] = useState("Subject Mask with Edits");

  const [retouchPreset, setRetouchPreset] = useState<string | null>(null);
  const [retouchPresetStrength, setRetouchPresetStrength] = useState(100);
  const retouchPresetRowRef = useRef<HTMLDivElement>(null);
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_OPTIONS[0]);
  const [focusMode, setFocusMode] = useState<string>(FOCUS_OPTIONS[0]);
  const [shootMode, setShootMode] = useState<string>(SHOOT_OPTIONS[0]);
  const [namingTemplate, setNamingTemplate] = useState("{Date}_{Counter:0001}");
  const [importRaw, setImportRaw] = useState(true);
  const [importJpeg, setImportJpeg] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [editEffectsMode, setEditEffectsMode] = useState<"Custom" | "Sync with Previous">("Custom");
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [autoAdvanceHovered, setAutoAdvanceHovered] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDetect, setShowDetect] = useState(!isTethering);
  const [showCameraSelect, setShowCameraSelect] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const sharedProfileProps = {
    fileFormat,
    rawProfile,
    onRawProfileChange: setRawProfile,
    jpegProfile,
    onJpegProfileChange: setJpegProfile,
    activeProfileTab,
    onActiveProfileTabChange: setActiveProfileTab,
    aiCropping,
    onAiCroppingChange: setAiCropping,
    cropStyle,
    onCropStyleChange: setCropStyle,
    cropOrientation,
    onCropOrientationChange: setCropOrientation,
    aiStraightening,
    onAiStraighteningChange: setAiStraightening,
    aiMasking,
    onAiMaskingChange: setAiMasking,
    maskMode,
    onMaskModeChange: setMaskMode,
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}
    >
      {isTethering && (
        <>
          <div className="flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#e2e2e2]">Camera Info</span>
              <div className="flex items-center">
                <div className="flex items-center gap-1 px-1.5 py-1 rounded border border-[rgba(21,128,61,0.4)] bg-[rgba(21,128,61,0.12)] backdrop-blur-[2px]">
                  <div className="w-3 h-3 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                  </div>
                  <span className="text-[11px] font-medium text-[#e2e2e2]">Connected</span>
                </div>
                <button
                  onClick={() => setShowSetup(true)}
                  className="text-[#666] hover:text-[#ababab] transition-colors pl-2 py-2"
                >
                  <GearIcon size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#ababab]">{cameraName}</span>
              <div className="flex items-center gap-1.5 text-[#ababab]">
                <BatteryHigh size={16} />
                <span className="text-[14px] font-medium">78%</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {/* Value cards */}
              <div className="flex gap-2">
                <CameraCard
                  label="APERTURE"
                  stops={APERTURE_STOPS}
                  index={apertureIdx}
                  onPrev={() => setApertureIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setApertureIdx((i) => Math.min(APERTURE_STOPS.length - 1, i + 1))}
                  onDragStart={() => setDraggingCard("APERTURE")}
                  onDragEnd={() => setDraggingCard(null)}
                  suppressHover={draggingCard !== null && draggingCard !== "APERTURE"}
                  renderValue={(v) => (
                    <span className="leading-none text-[#e2e2e2] font-medium">
                      <span className="text-[12px] pr-1">f</span>
                      <span className="text-[20px]">{v}</span>
                    </span>
                  )}
                />
                <CameraCard
                  label="SHUTTER"
                  stops={SHUTTER_STOPS}
                  index={shutterIdx}
                  onPrev={() => setShutterIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setShutterIdx((i) => Math.min(SHUTTER_STOPS.length - 1, i + 1))}
                  onDragStart={() => setDraggingCard("SHUTTER")}
                  onDragEnd={() => setDraggingCard(null)}
                  suppressHover={draggingCard !== null && draggingCard !== "SHUTTER"}
                  renderValue={(v) => (
                    <span className="leading-none text-[#e2e2e2] font-medium">
                      <span className="text-[14px] pr-1">1/</span>
                      <span className="text-[20px]">{v}</span>
                    </span>
                  )}
                />
                <CameraCard
                  label="ISO"
                  stops={ISO_STOPS}
                  index={isoIdx}
                  onPrev={() => setIsoIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setIsoIdx((i) => Math.min(ISO_STOPS.length - 1, i + 1))}
                  onDragStart={() => setDraggingCard("ISO")}
                  onDragEnd={() => setDraggingCard(null)}
                  suppressHover={draggingCard !== null && draggingCard !== "ISO"}
                  renderValue={(v) => (
                    <span className="leading-none text-[#e2e2e2] font-medium">
                      <span className="text-[20px]">{v}</span>
                    </span>
                  )}
                />
              </div>

              {/* Capture button */}
              <div className="flex justify-center gap-2 py-1">
                <CameraCard
                  label="WB"
                  stops={[...WB_OPTIONS]}
                  index={wbIdx}
                  onPrev={() => setWbIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setWbIdx((i) => Math.min(WB_OPTIONS.length - 1, i + 1))}
                  onDragStart={() => setDraggingCard("WB")}
                  onDragEnd={() => setDraggingCard(null)}
                  suppressHover={draggingCard !== null && draggingCard !== "WB"}
                  renderValue={(v) => (
                    <span className="text-[18px] font-medium text-[#e2e2e2] leading-none text-center">
                      {v}
                    </span>
                  )}
                />

                <div className="px-4">
                  <button
                    data-coachmark="capture-btn"
                    onClick={() => onCapture?.(autoAdvance)}
                    className="w-16 h-16 rounded-full border-[3px] border-white/30 flex items-center justify-center transition-all active:scale-95 group"
                  >
                    <div className="w-[52px] h-[52px] rounded-full bg-white group-hover:bg-white/90 group-active:bg-white/75 transition-colors" />
                  </button>
                </div>
              </div>
            </div>

            {/* Settings rows */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Format
                </span>
                <InlineSelect value={fileFormat} options={formatOptions} onChange={setFileFormat} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Aspect Ratio
                </span>
                <InlineSelect
                  value={aspectRatio}
                  options={ASPECT_OPTIONS}
                  onChange={setAspectRatio}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Shoot Mode
                </span>
                <InlineSelect value={shootMode} options={SHOOT_OPTIONS} onChange={setShootMode} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Focus Mode
                </span>
                <InlineSelect value={focusMode} options={FOCUS_OPTIONS} onChange={setFocusMode} />
              </div>

              {isLoupeView && (
                <button
                  onClick={() => setAutoAdvance((p) => !p)}
                  className="flex items-center justify-between w-full"
                >
                  <span
                    onMouseEnter={() => setAutoAdvanceHovered(true)}
                    onMouseLeave={() => setAutoAdvanceHovered(false)}
                    className="relative inline-flex text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]"
                  >
                    <Tooltip
                      label="Automatically move to the next image after each capture"
                      visible={autoAdvanceHovered}
                      position="top"
                    />
                    Auto Advance
                  </span>
                  <Toggle value={autoAdvance} onChange={setAutoAdvance} />
                </button>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]">
                  Edit Effects
                </span>
                <InlineSelect
                  value={editEffectsMode}
                  options={["Custom", "Sync with Previous"] as const}
                  onChange={setEditEffectsMode}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[#e2e2e20d]" />

          {editEffectsMode === "Custom" && (
            <>
              <div className="h-px bg-[#e2e2e20d]" />

              {/* Edit Profile */}
              <div data-coachmark="edit-profile">
                <Accordion
                  title="Edit Profile"
                  actions={
                    <span className="text-[11px] font-medium text-[#777]">
                      Auto Applied on next
                    </span>
                  }
                >
                  <ProfileSection {...sharedProfileProps} alwaysShowTabs />
                </Accordion>
              </div>

              <div className="h-px bg-[#e2e2e20d]" />

              {/* Retouching Preset */}
              <div data-coachmark="retouch-preset">
                <div className="flex flex-col gap-4">
                  <div ref={retouchPresetRowRef} className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab] leading-3">
                      Retouch Preset
                    </span>
                    <PresetDropdown
                      compact
                      anchorRef={retouchPresetRowRef}
                      value={retouchPreset}
                      onChange={setRetouchPreset}
                    />
                  </div>
                  {retouchPreset && (
                    <SliderRow
                      label="Strength"
                      value={retouchPresetStrength}
                      onChange={setRetouchPresetStrength}
                      noPinArea
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Pinned sliders */}
          {pinnedSliders.size > 0 && (
            <>
              <div className="h-px bg-[#e2e2e20d]" />
              <Accordion title="Favorite Sliders">
                <PinnedSlidersCard
                  pinnedSliders={pinnedSliders}
                  onTogglePin={togglePin}
                  getValue={(sIdx, sliderIdx) => favValues[`${sIdx}:${sliderIdx}`] ?? 0}
                  onChange={(sIdx, sliderIdx, v) =>
                    setFavValues((prev) => ({ ...prev, [`${sIdx}:${sliderIdx}`]: v }))
                  }
                />
              </Accordion>
            </>
          )}
        </>
      )}

      {showWelcome && <TetherWelcomeModal onClose={() => setShowWelcome(false)} />}
      {showDetect && (
        <TetherDetectModal
          onCancel={() => {
            setShowDetect(false);
            if (onCancelTethering) onCancelTethering();
            else onCancelSetup?.();
          }}
          onDetected={(cameras) => {
            setShowDetect(false);
            if (cameras.length >= 2) {
              setShowCameraSelect(true);
            } else {
              if (cameras[0]) setCameraName(cameras[0]);
              setShowSetup(true);
            }
          }}
        />
      )}
      {showCameraSelect && (
        <TetherCameraSelectModal
          onCancel={() => {
            setShowCameraSelect(false);
            if (onCancelTethering) onCancelTethering();
            else onCancelSetup?.();
          }}
          onSelect={(cam) => {
            setCameraName(cam);
            setShowCameraSelect(false);
            setShowSetup(true);
          }}
        />
      )}
      {showSetup && (
        <TetherSetupModal
          onCancel={() => {
            setShowSetup(false);
            if (!isTethering) {
              if (onCancelTethering) onCancelTethering();
              else onCancelSetup?.();
            }
          }}
          onStart={() => {
            setShowSetup(false);
            if (!isTethering) onStartTethering();
          }}
          currentImageSrc={currentImageSrc}
          mode={isTethering ? "preferences" : "setup"}
          cameraName={cameraName}
          {...sharedProfileProps}
          onFileFormatChange={setFileFormat}
          retouchPreset={retouchPreset}
          onRetouchPresetChange={setRetouchPreset}
          retouchPresetStrength={retouchPresetStrength}
          onRetouchPresetStrengthChange={setRetouchPresetStrength}
          namingTemplate={namingTemplate}
          onNamingTemplateChange={setNamingTemplate}
          destination={destination}
          onDestinationChange={setDestination}
          importRaw={importRaw}
          onImportRawChange={setImportRaw}
          importJpeg={importJpeg}
          onImportJpegChange={setImportJpeg}
        />
      )}
    </div>
  );
};

export default TetheringTab;
