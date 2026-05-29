import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useSessionState } from "@/hooks/useSessionState";
import PinnedSlidersCard from "../../PinnedSlidersCard";
import {
  BatteryHigh,
  GearIcon,
  LinkBreakIcon,
  FolderSimpleIcon,
  Moon,
  ArrowsClockwise,
  AppWindow,
  EjectSimpleIcon,
  CaretRight,
} from "@phosphor-icons/react";
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
  parseDualFormat,
} from "./tethering/constants";
import { Toggle } from "./tethering/Toggle";
import { InlineSelect } from "./tethering/InlineSelect";
import { CameraCard } from "./tethering/CameraCard";
import { ProfileSection } from "./tethering/ProfileSection";
import { TetherWelcomeModal } from "./tethering/modals/TetherWelcomeModal";
import { TetherCameraSelectModal } from "./tethering/modals/TetherCameraSelectModal";
import { TetherDetectModal } from "./tethering/modals/TetherDetectModal";
import { TetherSetupModal } from "./tethering/modals/TetherSetupModal";
import { TetherEndConfirmModal } from "./tethering/modals/TetherEndConfirmModal";

const NAMING_PATTERNS: Array<{
  id: string;
  label: string;
  template: string;
  needsPrefix?: boolean;
}> = [
  { id: "date-seq", label: "Date + Sequence", template: "{Date}_{Counter:0001}" },
  {
    id: "prefix-seq",
    label: "Prefix + Sequence",
    template: "{Prefix:Smith}_{Counter:0001}",
    needsPrefix: true,
  },
  {
    id: "date-prefix-seq",
    label: "Date + Prefix + Sequence",
    template: "{Date}_{Prefix:Smith}_{Counter:0001}",
    needsPrefix: true,
  },
  { id: "camera-seq", label: "Camera + Sequence", template: "{CameraModel}_{Counter:0001}" },
  { id: "seq-only", label: "Sequence only", template: "IMG_{Counter:0001}" },
];

interface TetheringTabProps {
  currentImageSrc?: string;
  isTethering: boolean;
  isLoupeView?: boolean;
  onStartTethering: () => void;
  onCancelSetup?: () => void;
  onCancelTethering?: () => void;
  onCapture?: (
    autoAdvance: boolean,
    captureInfo: { addRaw: boolean; addJpeg: boolean; rawExt: string }
  ) => void;
  skipDetect?: boolean;
  directPanel?: boolean;
}

type CameraStatus = "connected" | "asleep" | "disconnected" | "reconnecting" | "stolen";

const STATUS_DOT: Record<CameraStatus, string> = {
  connected: "bg-[#4ade80]",
  asleep: "bg-[#fbbf24]",
  disconnected: "bg-[#ef4444]",
  reconnecting: "bg-[#3b82f6] animate-pulse",
  stolen: "bg-[#f97316]",
};

const STATUS_LABEL: Record<Exclude<CameraStatus, "connected">, string> = {
  asleep: "Asleep",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting",
  stolen: "Camera Busy",
};

const STATUS_LABEL_COLOR: Record<Exclude<CameraStatus, "connected">, string> = {
  asleep: "text-[#fbbf24]",
  disconnected: "text-[#ef4444]",
  reconnecting: "text-[#3b82f6]",
  stolen: "text-[#f97316]",
};

// Cycle order for the status dot click (simulation only)
const STATUS_CYCLE: CameraStatus[] = [
  "connected",
  "asleep",
  "disconnected",
  "stolen",
  "reconnecting",
];

const TetheringTab = ({
  currentImageSrc,
  isTethering,
  isLoupeView = false,
  onStartTethering,
  onCancelSetup,
  onCancelTethering,
  onCapture,
  skipDetect = false,
  directPanel = false,
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
  const { isDual, rawLabel: _rawLabel, jpegLabel: _jpegLabel } = parseDualFormat(fileFormat);
  const isJpegOnly = !isDual && fileFormat.toLowerCase().startsWith("jpeg");
  const isRawOnly = !isDual && !isJpegOnly;

  const [rawProfile, setRawProfile] = useState<string | null>(null);
  const [jpegProfile, setJpegProfile] = useState<string | null>(null);
  const [editPreset, setEditPreset] = useState<string | null>(null);
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

  const namingPrefixMatch = namingTemplate.match(/\{Prefix:([^}]*)\}/);
  const namingUserPrefix = namingPrefixMatch?.[1] ?? "";
  const activeNamingPatternId = (() => {
    const stripped = namingTemplate.replace(/\{Prefix:[^}]*\}/g, "{Prefix}");
    for (const p of NAMING_PATTERNS) {
      const pStripped = p.template.replace(/\{Prefix:[^}]*\}/g, "{Prefix}");
      if (pStripped === stripped) return p.id;
    }
    return null;
  })();
  const activeNamingPattern = NAMING_PATTERNS.find((p) => p.id === activeNamingPatternId);
  const showNamingPrefixInput = !!activeNamingPattern?.needsPrefix;

  const applyNamingPattern = (p: (typeof NAMING_PATTERNS)[number]) => {
    if (p.needsPrefix && namingUserPrefix) {
      setNamingTemplate(p.template.replace(/\{Prefix:[^}]*\}/, `{Prefix:${namingUserPrefix}}`));
    } else {
      setNamingTemplate(p.template);
    }
  };

  const updateNamingPrefix = (next: string) => {
    const sanitized = next.replace(/[/\\:*?"<>|{}]/g, "");
    if (namingTemplate.includes("{Prefix:")) {
      setNamingTemplate(
        namingTemplate.replace(/\{Prefix:[^}]*\}/, `{Prefix:${sanitized || "Smith"}}`)
      );
    }
  };

  const namingPreview = (tpl: string) =>
    tpl
      .replace("{Date}", "2026-05-15")
      .replace(/\{Prefix:([^}]*)\}/, (_m, p) => namingUserPrefix || p)
      .replace(/\{Counter(?::[^}]*)?\}/, "0001")
      .replace("{CameraModel}", cameraName.replace(/\s+/g, ""))
      .concat(`.${getCameraSpec(cameraName).raw}`);

  const pickFolder = async () => {
    const w = window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> };
    if (w.showDirectoryPicker) {
      try {
        const handle = await w.showDirectoryPicker();
        setDestination(`~/Pictures/${handle.name}`);
      } catch {
        /* user cancelled */
      }
    } else {
      const next = window.prompt("Destination folder path", destination);
      if (next) setDestination(next);
    }
  };

  const [importRaw, setImportRaw] = useState(true);
  const [importJpeg, setImportJpeg] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [editEffectsMode, setEditEffectsMode] = useSessionState<"Presets" | "Sync with Prev">(
    "tethering:editEffectsMode",
    "Presets"
  );
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [autoAdvanceHovered, setAutoAdvanceHovered] = useState(false);
  const [timerCount, setTimerCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  type EditSnapshot = {
    rawProfile: string | null;
    jpegProfile: string | null;
    editPreset: string | null;
    aiCropping: boolean;
    cropStyle: string;
    cropOrientation: string;
    aiStraightening: boolean;
    aiMasking: boolean;
    maskMode: string;
    retouchPreset: string | null;
    retouchPresetStrength: number;
  };

  const lastCaptureSnapshotRef = useRef<EditSnapshot | null>(null);

  const takeSnapshot = (): EditSnapshot => ({
    rawProfile,
    jpegProfile,
    editPreset,
    aiCropping,
    cropStyle,
    cropOrientation,
    aiStraightening,
    aiMasking,
    maskMode,
    retouchPreset,
    retouchPresetStrength,
  });

  const applySnapshot = (snap: EditSnapshot) => {
    setRawProfile(snap.rawProfile);
    setJpegProfile(snap.jpegProfile);
    setEditPreset(snap.editPreset);
    setAiCropping(snap.aiCropping);
    setCropStyle(snap.cropStyle);
    setCropOrientation(snap.cropOrientation);
    setAiStraightening(snap.aiStraightening);
    setAiMasking(snap.aiMasking);
    setMaskMode(snap.maskMode);
    setRetouchPreset(snap.retouchPreset);
    setRetouchPresetStrength(snap.retouchPresetStrength);
  };

  const getTimerSeconds = () => {
    if (shootMode === "Timer 10 sec") return 10;
    if (shootMode === "Timer 2 sec") return 2;
    return null;
  };

  const handleCapture = () => {
    if (editEffectsMode === "Sync with Prev" && lastCaptureSnapshotRef.current !== null) {
      applySnapshot(lastCaptureSnapshotRef.current);
    } else {
      lastCaptureSnapshotRef.current = takeSnapshot();
    }

    const seconds = getTimerSeconds();
    if (seconds !== null && timerCount === null) {
      setTimerCount(seconds);
      timerRef.current = setInterval(() => {
        setTimerCount((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            onCapture?.(autoAdvance, {
              addRaw: isDual ? importRaw : isRawOnly,
              addJpeg: isDual ? importJpeg : isJpegOnly,
              rawExt: cameraSpec.raw,
            });
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (seconds === null) {
      onCapture?.(autoAdvance, {
        addRaw: isDual ? importRaw : isRawOnly,
        addJpeg: isDual ? importJpeg : isJpegOnly,
        rawExt: cameraSpec.raw,
      });
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const [cameraOpen, setCameraOpen] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("connected");

  const cycleStatus = () =>
    setCameraStatus((cur) => STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]);

  // Simulation: reconnecting auto-resolves after 3 s
  useEffect(() => {
    if (cameraStatus !== "reconnecting") return;
    const t = setTimeout(() => setCameraStatus("connected"), 3000);
    return () => clearTimeout(t);
  }, [cameraStatus]);

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ejectMode, setEjectMode] = useState<"end" | "eject-end" | null>(null);
  const [sessionEndedMode, setSessionEndedMode] = useState<"end" | "eject-end" | null>(null);
  const [showEjectDropdown, setShowEjectDropdown] = useState(false);
  const ejectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEjectDropdown) return;
    const handler = (e: MouseEvent) => {
      if (ejectDropdownRef.current && !ejectDropdownRef.current.contains(e.target as Node)) {
        setShowEjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEjectDropdown]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showDetect, setShowDetect] = useState(!isTethering && !skipDetect);
  const [showCameraSelect, setShowCameraSelect] = useState(false);
  const [showSetup, setShowSetup] = useState(!isTethering && skipDetect);

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
    editPreset,
    onEditPresetChange: setEditPreset,
    retouchPreset,
    onRetouchPresetChange: setRetouchPreset,
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}
    >
      {isTethering && (
        <>
          <div className="flex flex-col gap-3">
            {sessionEndedMode ? (
              /* ── Session-ended header ── */
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-[#e2e2e2]">
                  {sessionEndedMode === "end" ? cameraName : "Camera"}
                </span>
                <button
                  onClick={() => {
                    setSessionEndedMode(null);
                    setCameraStatus("reconnecting");
                  }}
                  className="px-2 py-1.5 rounded-[4px] bg-[#303030] hover:bg-[#474747] active:bg-[#171717] text-[11px] font-medium text-white transition-colors"
                >
                  Reconnect
                </button>
              </div>
            ) : (
              /* ── Active tethering header ── */
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCameraOpen((v) => !v)}
                      className="w-3 h-3 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
                    >
                      <CaretRight
                        size={12}
                        className={`transition-transform duration-150 ${cameraOpen ? "rotate-90" : ""}`}
                      />
                    </button>
                    <span className="text-[14px] font-medium text-[#e2e2e2]">Camera</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Eject dropdown */}
                    <div ref={ejectDropdownRef} className="relative">
                      <button
                        onClick={() => setShowEjectDropdown((v) => !v)}
                        className="text-[#555] hover:text-[#ababab] transition-colors px-1 py-2"
                        title="Disconnect options"
                      >
                        <EjectSimpleIcon weight="fill" size={16} />
                      </button>
                      {showEjectDropdown && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-[#1e1e1e] border border-[#303030] rounded-[8px] py-1 min-w-[180px] shadow-lg">
                          <button
                            onClick={() => {
                              setShowEjectDropdown(false);
                              setEjectMode("end");
                              setShowEndConfirm(true);
                            }}
                            className="w-full text-left px-3 py-2 text-[13px] text-[#e2e2e2] hover:bg-white/5 transition-colors"
                          >
                            End Tethering
                          </button>
                          <button
                            onClick={() => {
                              setShowEjectDropdown(false);
                              setEjectMode("eject-end");
                              setShowEndConfirm(true);
                            }}
                            className="w-full text-left px-3 py-2 text-[13px] text-[#e2e2e2] hover:bg-white/5 transition-colors"
                          >
                            Eject and End Tethering
                          </button>
                        </div>
                      )}
                    </div>

                    {!directPanel && (
                      <button
                        onClick={() => setShowSetup(true)}
                        className="text-[#666] hover:text-[#ababab] transition-colors px-1 py-2"
                      >
                        <GearIcon size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {cameraOpen && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[#ababab]">{cameraName}</span>
                      <button
                        onClick={cycleStatus}
                        title="Click to cycle status (simulation)"
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[cameraStatus]} cursor-pointer`}
                      />
                    </div>
                    {cameraStatus === "connected" ? (
                      <div className="flex items-center gap-1.5 text-[#ababab]">
                        <BatteryHigh size={16} />
                        <span className="text-[14px] font-medium">78%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {cameraStatus === "reconnecting" && (
                          <ArrowsClockwise size={13} className="text-[#3b82f6] animate-spin" />
                        )}
                        <span
                          className={`text-[13px] font-medium ${STATUS_LABEL_COLOR[cameraStatus]}`}
                        >
                          {STATUS_LABEL[cameraStatus]}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!sessionEndedMode && cameraOpen && (
              <>
                {cameraStatus === "asleep" && (
                  <div className="flex flex-col gap-1.5 px-3 py-3 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a]">
                    <span className="text-[12px] font-medium text-[#e2e2e2]">Wake the camera</span>
                    <span className="text-[12px] text-[#555] leading-[1.5]">
                      Half-press the shutter button on the camera to wake it up.
                    </span>
                  </div>
                )}

                {cameraStatus === "disconnected" && (
                  <div className="flex flex-col gap-3 px-3 py-3 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] font-medium text-[#e2e2e2]">
                        Connection lost
                      </span>
                      <span className="text-[12px] text-[#555] leading-[1.5]">
                        Check the USB cable and make sure the camera is on.
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCameraStatus("reconnecting")}
                        className="flex-1 py-1.5 text-[12px] font-medium text-[#e2e2e2] bg-[#2a2a2a] hover:bg-[#333] rounded border border-[#3a3a3a] transition-colors"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => {
                          if (onCancelTethering) onCancelTethering();
                          else onCancelSetup?.();
                        }}
                        className="flex-1 py-1.5 text-[12px] font-medium text-[#666] hover:text-[#ababab] bg-transparent rounded border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
                      >
                        End Session
                      </button>
                    </div>
                  </div>
                )}

                {cameraStatus === "stolen" && (
                  <div className="flex flex-col gap-3 px-3 py-3 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a]">
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] font-medium text-[#e2e2e2]">
                        Camera is in use
                      </span>
                      <span className="text-[12px] text-[#555] leading-[1.5]">
                        Another app is controlling the camera. Close it and bring the camera back.
                      </span>
                    </div>
                    <button
                      onClick={() => setCameraStatus("reconnecting")}
                      className="py-1.5 text-[12px] font-medium text-[#e2e2e2] bg-[#2a2a2a] hover:bg-[#333] rounded border border-[#3a3a3a] transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                <div
                  className={`flex flex-col gap-1.5 transition-opacity duration-300 ${cameraStatus !== "connected" ? "opacity-25 pointer-events-none select-none" : ""}`}
                >
                  <>
                    {/* Value cards */}
                    <div className="flex gap-2">
                      <CameraCard
                        label="APERTURE"
                        stops={APERTURE_STOPS}
                        index={apertureIdx}
                        onPrev={() => setApertureIdx((i) => Math.max(0, i - 1))}
                        onNext={() =>
                          setApertureIdx((i) => Math.min(APERTURE_STOPS.length - 1, i + 1))
                        }
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
                        onNext={() =>
                          setShutterIdx((i) => Math.min(SHUTTER_STOPS.length - 1, i + 1))
                        }
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

                    {/* WB + Capture button */}
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
                          onClick={handleCapture}
                          className="w-16 h-16 rounded-full border-[3px] border-white/30 flex items-center justify-center transition-all active:scale-95 group relative"
                        >
                          <div
                            className={`w-[52px] h-[52px] rounded-full transition-colors ${timerCount !== null ? "bg-white/30" : "bg-white group-hover:bg-white/90 group-active:bg-white/75"}`}
                          />
                          {timerCount !== null && (
                            <span className="absolute inset-0 flex items-center justify-center text-[22px] font-bold text-white tabular-nums leading-none">
                              {timerCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                </div>

                {/* Settings rows */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#ababab]">Format</span>
                    <InlineSelect
                      value={fileFormat}
                      options={formatOptions}
                      onChange={setFileFormat}
                    />
                  </div>

                  {isDual && (
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#ababab]">Import</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            isDual && (importJpeg || !importRaw) && setImportRaw(!importRaw)
                          }
                          disabled={!isDual}
                          className={`flex items-center gap-1.5 ${!isDual && isJpegOnly ? "opacity-30 cursor-not-allowed" : isDual ? "cursor-pointer" : "cursor-default"}`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${
                              isRawOnly || (isDual && importRaw)
                                ? "bg-[#2563eb] border-[#2563eb]"
                                : "border-[#444] bg-transparent"
                            }`}
                          >
                            {(isRawOnly || (isDual && importRaw)) && (
                              <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                                <path
                                  d="M1 4L3.5 6.5L9 1"
                                  stroke="white"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-[13px] font-medium ${!isDual && isJpegOnly ? "text-[#555]" : "text-[#e2e2e2]"}`}
                          >
                            RAW
                          </span>
                        </button>

                        <button
                          onClick={() =>
                            isDual && (importRaw || !importJpeg) && setImportJpeg(!importJpeg)
                          }
                          disabled={!isDual}
                          className={`flex items-center gap-1.5 ${!isDual && isRawOnly ? "opacity-30 cursor-not-allowed" : isDual ? "cursor-pointer" : "cursor-default"}`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${
                              isJpegOnly || (isDual && importJpeg)
                                ? "bg-[#2563eb] border-[#2563eb]"
                                : "border-[#444] bg-transparent"
                            }`}
                          >
                            {(isJpegOnly || (isDual && importJpeg)) && (
                              <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                                <path
                                  d="M1 4L3.5 6.5L9 1"
                                  stroke="white"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-[13px] font-medium ${!isDual && isRawOnly ? "text-[#555]" : "text-[#e2e2e2]"}`}
                          >
                            JPEG
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#ababab]">Aspect Ratio</span>
                    <InlineSelect
                      value={aspectRatio}
                      options={ASPECT_OPTIONS}
                      onChange={setAspectRatio}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#ababab]">Shoot Mode</span>
                    <InlineSelect
                      value={shootMode}
                      options={SHOOT_OPTIONS}
                      onChange={setShootMode}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#ababab]">Focus Mode</span>
                    <InlineSelect
                      value={focusMode}
                      options={FOCUS_OPTIONS}
                      onChange={setFocusMode}
                    />
                  </div>

                  {isLoupeView && (
                    <div
                      onClick={() => setAutoAdvance((p) => !p)}
                      className="flex items-center justify-between w-full cursor-pointer"
                    >
                      <span
                        onMouseEnter={() => setAutoAdvanceHovered(true)}
                        onMouseLeave={() => setAutoAdvanceHovered(false)}
                        // className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab]"
                        className="relative inline-flex  text-[13px] text-[#ababab]"
                      >
                        <Tooltip
                          label="Automatically move to the next image after each capture"
                          visible={autoAdvanceHovered}
                          position="top"
                        />
                        Auto Advance
                      </span>
                      <Toggle value={autoAdvance} onChange={setAutoAdvance} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {directPanel && <div className="h-px bg-[#e2e2e20d]" />}

          {directPanel && (
            <Accordion title="File Options" titleClassName="text-[14px] font-medium text-[#e2e2e2]">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-[#ababab]">Destination</span>
                  <button
                    onClick={pickFolder}
                    className="group flex w-full text-left gap-2 items-center justify-between px-2.5 py-2 bg-[#242424] rounded hover:bg-[#2a2a2a] transition-colors"
                  >
                    <span className="text-[13px] text-[#e2e2e2] truncate flex-1">
                      {destination}
                    </span>
                    <FolderSimpleIcon size={16} className="text-[#777] shrink-0" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#ababab]">File Naming</span>
                    <InlineSelect
                      value={activeNamingPattern?.label ?? NAMING_PATTERNS[0].label}
                      options={NAMING_PATTERNS.map((p) => p.label)}
                      onChange={(label) => {
                        const p = NAMING_PATTERNS.find((p) => p.label === label);
                        if (p) applyNamingPattern(p);
                      }}
                    />
                  </div>
                  {showNamingPrefixInput && (
                    <div className="flex items-center justify-between px-2.5 py-2 bg-[#242424] rounded">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab] shrink-0">
                        Prefix
                      </span>
                      <input
                        type="text"
                        value={namingUserPrefix}
                        placeholder="Smith"
                        onChange={(e) => updateNamingPrefix(e.target.value)}
                        className="bg-transparent outline-none text-[13px] text-[#e2e2e2] placeholder:text-[#3a3a3a] text-right"
                      />
                    </div>
                  )}
                  <span className="text-[12px] text-[#555] truncate">
                    e.g.{" "}
                    {namingPreview(activeNamingPattern?.template ?? NAMING_PATTERNS[0].template)}
                  </span>
                </div>
              </div>
            </Accordion>
          )}

          <div className="h-px bg-[#e2e2e20d]" />

          <div data-coachmark="edit-profile">
            <Accordion
              title="Edit Effects"
              titleClassName="text-[14px] font-medium text-[#e2e2e2]"
              actions={
                <div className="flex gap-3">
                  {(["Presets", "Sync with Prev"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setEditEffectsMode(option)}
                      className="flex items-center gap-[4px] group"
                    >
                      <div
                        className={`w-3 h-3 rounded-full border bg-[#303030] flex items-center justify-center shrink-0 transition-colors overflow-hidden ${editEffectsMode === option ? "border-[#474747] p-[2px]" : "border-[#474747] group-hover:border-[#777] p-0"}`}
                      >
                        <div
                          className={`w-[6px] h-[6px] rounded-full shrink-0 transition-colors ${editEffectsMode === option ? "bg-[#3b82f6]" : "bg-transparent"}`}
                        />
                      </div>
                      <span className="text-[12px] font-normal text-[#ababab] leading-4 whitespace-nowrap">
                        {option}
                      </span>
                    </button>
                  ))}
                </div>
              }
            >
              {editEffectsMode === "Presets" && <ProfileSection {...sharedProfileProps} />}
            </Accordion>
          </div>

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

      {showEndConfirm && (
        <TetherEndConfirmModal
          ejectMode={ejectMode}
          onCancel={() => {
            setShowEndConfirm(false);
            setEjectMode(null);
          }}
          onConfirm={() => {
            const mode = ejectMode ?? "end";
            setShowEndConfirm(false);
            setEjectMode(null);
            setSessionEndedMode(mode);
          }}
        />
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
