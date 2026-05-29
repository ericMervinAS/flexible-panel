import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";
import { InlineSelect } from "./InlineSelect";
import PresetDropdown from "@/components/PresetDropdown";
import { parseDualFormat, PROFILE_SECTIONS_DATA, type ProfileItem } from "./constants";

// ─── Combined AI Profiles + Presets dropdown ──────────────────────────────────

const EDIT_PRESET_SECTIONS = [
  {
    group: "Bright & Clean",
    presets: ["Airy Light", "Soft White", "Pure & Clean", "Morning Glow"],
  },
  {
    group: "Moody",
    presets: ["Dark & Dramatic", "Muted Shadows", "Cinematic Fade", "Deep Contrast"],
  },
  {
    group: "Film",
    presets: ["Kodak Porta 400", "Fuji 400H", "Ilford HP5", "Cinestill 800T"],
  },
  {
    group: "Natural",
    presets: ["Warm Skin", "True Color", "Golden Hour", "Soft Pastel"],
  },
  {
    group: "Black & White",
    presets: ["Classic B&W", "High Contrast BW", "Soft Matte BW", "Selenium Tone"],
  },
];

interface CombinedProfileDropdownProps {
  profileValue: string | null;
  onProfileChange: (v: string | null) => void;
  presetValue: string | null;
  onPresetChange: (v: string | null) => void;
}

const CombinedProfileDropdown = ({
  profileValue,
  onProfileChange,
  presetValue,
  onPresetChange,
}: CombinedProfileDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profiles" | "presets">("profiles");
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: 280,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onClickOutside = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const triggerLabel = profileValue ?? presetValue ?? "None";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-[#ababab] hover:text-[#e2e2e2] transition-colors"
      >
        <span className="text-[13px]">{triggerLabel}</span>
        <CaretDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ ...menuStyle } as React.CSSProperties}
            className="bg-[#1e1e1e] border border-[#303030] rounded-[10px] shadow-xl flex flex-col overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex p-1 gap-0.5 m-2 rounded-[8px] bg-[#161616] border-[#2a2a2a]">
              {(["profiles", "presets"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[12px] font-medium py-1.5 px-3 rounded-[6px] transition-colors ${
                    activeTab === tab
                      ? "bg-[#2a2a2a] text-[#e2e2e2]"
                      : "text-[#555] hover:text-[#ababab]"
                  }`}
                >
                  {tab === "profiles" ? "AI Profiles" : "Presets"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div
              className="p-1 flex flex-col max-h-[360px] overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {activeTab === "profiles" ? (
                <>
                  <button
                    onClick={() => {
                      onProfileChange(null);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-[6px] text-left transition-colors ${profileValue === null ? "bg-white/5" : "hover:bg-white/5"}`}
                  >
                    <span className="text-[13px] text-[#777]">None</span>
                  </button>
                  {PROFILE_SECTIONS_DATA.map((section, si) => (
                    <div key={section.group}>
                      <div
                        className={`h-px bg-[#2a2a2a] mx-2 ${si === 0 ? "my-1" : "mt-1 mb-0"}`}
                      />
                      <div className="px-3 pt-2.5 pb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#555]">
                          {section.group}
                        </span>
                      </div>
                      {section.profiles.map((profile: ProfileItem) => (
                        <button
                          key={profile.name}
                          onClick={() => {
                            onProfileChange(profile.name);
                            setOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-2 py-2 rounded-[6px] transition-colors ${
                            profileValue === profile.name ? "bg-white/5" : "hover:bg-white/5"
                          }`}
                        >
                          <ProfileThumb img={profile.img} size="md" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <LrcBadge />
                            <span className="text-[13px] font-medium text-[#e2e2e2] flex-1 truncate text-left">
                              {profile.name}
                            </span>
                            <FormatBadge format={profile.format} />
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onPresetChange(null);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-[6px] text-left transition-colors ${presetValue === null ? "bg-white/5" : "hover:bg-white/5"}`}
                  >
                    <span className="text-[13px] text-[#777]">None</span>
                  </button>
                  {EDIT_PRESET_SECTIONS.map((section, si) => (
                    <div key={section.group}>
                      <div
                        className={`h-px bg-[#2a2a2a] mx-2 ${si === 0 ? "my-1" : "mt-1 mb-0"}`}
                      />
                      <div className="px-3 pt-2.5 pb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#555]">
                          {section.group}
                        </span>
                      </div>
                      {section.presets.map((name) => (
                        <button
                          key={name}
                          onClick={() => {
                            onPresetChange(name);
                            setOpen(false);
                          }}
                          className={`w-full flex items-center px-3 py-2 rounded-[6px] transition-colors text-left ${
                            presetValue === name ? "bg-white/5" : "hover:bg-white/5"
                          }`}
                        >
                          <span className="text-[13px] font-medium text-[#e2e2e2]">{name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// ─── Small profile UI atoms ───────────────────────────────────────────────────

export const LrcBadge = () => (
  <span className="text-[12px] font-semibold text-[#74b9d4] leading-none shrink-0">LrC</span>
);

const FormatBadge = ({ format }: { format: "JPEG" | "RAW" }) => (
  <span
    className={`text-[11px] font-semibold px-2 py-[3px] rounded leading-none shrink-0 ${
      format === "JPEG" ? "bg-[#2563eb] text-white" : "bg-[#166534]/60 text-[#4ade80]"
    }`}
  >
    {format}
  </span>
);

const ProfileThumb = ({ img, size = "md" }: { img: string | null; size?: "sm" | "md" }) => {
  const cls = size === "sm" ? "w-[56px] h-[38px]" : "w-[66px] h-[44px]";
  return (
    <div className={`${cls} rounded-[4px] overflow-hidden shrink-0 bg-[#2a2a2a]`}>
      {img ? (
        <img src={img} className="w-full h-full object-cover" alt="" />
      ) : (
        <div className="w-full h-full bg-[#7c3f58] flex items-center justify-center">
          <span className="text-[#e8a0bf] text-[18px] font-bold leading-none">ā</span>
        </div>
      )}
    </div>
  );
};

// ─── AiTogglesCard ────────────────────────────────────────────────────────────

interface AiTogglesCardProps {
  activeProfile: string | null;
  aiCropping: boolean;
  onAiCroppingChange: (v: boolean) => void;
  cropStyle: string;
  onCropStyleChange: (v: string) => void;
  cropOrientation: string;
  onCropOrientationChange: (v: string) => void;
  aiStraightening: boolean;
  onAiStraighteningChange: (v: boolean) => void;
  aiMasking: boolean;
  onAiMaskingChange: (v: boolean) => void;
  maskMode: string;
  onMaskModeChange: (v: string) => void;
}

const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className="w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors"
    style={{
      background: checked ? "#2563eb" : "transparent",
      borderColor: checked ? "#2563eb" : "#444",
    }}
  >
    {checked && (
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
  </button>
);

const AiTogglesCard = ({
  activeProfile,
  aiCropping,
  onAiCroppingChange,
  cropStyle,
  onCropStyleChange,
  cropOrientation,
  onCropOrientationChange,
  aiStraightening,
  onAiStraighteningChange,
  aiMasking,
  onAiMaskingChange,
  maskMode,
  onMaskModeChange,
}: AiTogglesCardProps) => {
  const isCropOnly = activeProfile === "Crop & Straighten only";

  return (
    <div className="flex flex-col gap-0.5 mt-[-8px] mb-1 pl-4">
      <div className="flex items-center gap-2 py-1.5">
        <Checkbox checked={aiCropping} onChange={onAiCroppingChange} />
        <span className="text-[13px] text-[#ababab] flex-1">AI Cropping</span>
        <div
          className={`flex items-center gap-2 transition-opacity ${aiCropping ? "opacity-100" : "opacity-30 pointer-events-none"}`}
        >
          <InlineSelect
            value={cropStyle}
            options={["Loose", "Balanced", "Tight"] as const}
            onChange={onCropStyleChange}
          />
          <InlineSelect
            value={cropOrientation}
            options={["Default", "Portrait", "Landscape"] as const}
            onChange={onCropOrientationChange}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 py-1.5">
        <Checkbox checked={aiStraightening} onChange={onAiStraighteningChange} />
        <span className="text-[13px] text-[#ababab] flex-1">AI Straightening</span>
      </div>

      <div className="flex items-center gap-2 py-1.5">
        <Checkbox checked={aiMasking} onChange={onAiMaskingChange} />
        <span className="text-[13px] text-[#ababab] flex-1">AI Masking</span>
        <div
          className={`transition-opacity ${aiMasking ? "opacity-100" : "opacity-30 pointer-events-none"}`}
        >
          <InlineSelect
            value={maskMode}
            options={["Subject Mask with Edits", "Subject Mask", "Background Mask"] as const}
            onChange={onMaskModeChange}
          />
        </div>
      </div>
    </div>
  );
};

// ─── ProfileSection ───────────────────────────────────────────────────────────

export interface ProfileSectionProps {
  fileFormat: string;
  rawProfile: string | null;
  onRawProfileChange: (v: string | null) => void;
  jpegProfile: string | null;
  onJpegProfileChange: (v: string | null) => void;
  activeProfileTab: "raw" | "jpeg";
  onActiveProfileTabChange: (v: "raw" | "jpeg") => void;
  aiCropping: boolean;
  onAiCroppingChange: (v: boolean) => void;
  cropStyle: string;
  onCropStyleChange: (v: string) => void;
  cropOrientation: string;
  onCropOrientationChange: (v: string) => void;
  aiStraightening: boolean;
  onAiStraighteningChange: (v: boolean) => void;
  aiMasking: boolean;
  onAiMaskingChange: (v: boolean) => void;
  maskMode: string;
  onMaskModeChange: (v: string) => void;
  alwaysShowTabs?: boolean;
  showAiToggles?: boolean;
  rawFormatLabel?: string;
  editPreset?: string | null;
  onEditPresetChange?: (v: string | null) => void;
  retouchPreset?: string | null;
  onRetouchPresetChange?: (v: string | null) => void;
}

export const ProfileSection = ({
  fileFormat,
  rawProfile,
  onRawProfileChange,
  jpegProfile,
  onJpegProfileChange,
  activeProfileTab,
  onActiveProfileTabChange,
  aiCropping,
  onAiCroppingChange,
  cropStyle,
  onCropStyleChange,
  cropOrientation,
  onCropOrientationChange,
  aiStraightening,
  onAiStraighteningChange,
  aiMasking,
  onAiMaskingChange,
  maskMode,
  onMaskModeChange,
  alwaysShowTabs = false,
  showAiToggles = true,
  rawFormatLabel,
  editPreset = null,
  onEditPresetChange,
  retouchPreset,
  onRetouchPresetChange,
}: ProfileSectionProps) => {
  const { isDual } = parseDualFormat(fileFormat);
  const showTabs = alwaysShowTabs || isDual;
  const isJpegContext = showTabs
    ? activeProfileTab === "jpeg"
    : fileFormat.toLowerCase().startsWith("jpeg");
  const tabRawLabel = isDual ? "RAW" : rawFormatLabel || "RAW";
  const tabJpegLabel = "JPEG";

  useEffect(() => {
    if (!isDual && alwaysShowTabs) {
      const isJpegOnly = fileFormat.toLowerCase().startsWith("jpeg");
      onActiveProfileTabChange(isJpegOnly ? "jpeg" : "raw");
    }
  }, [fileFormat]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeProfile = showTabs
    ? activeProfileTab === "raw"
      ? rawProfile
      : jpegProfile
    : rawProfile;
  const onActiveProfileChange = showTabs
    ? activeProfileTab === "raw"
      ? onRawProfileChange
      : onJpegProfileChange
    : onRawProfileChange;
  return (
    <div className="flex flex-col gap-4">
      {showTabs && (
        <div className="flex p-0.5 mt-1 bg-[#161616] mb-[-4px] rounded-[8px]">
          <button
            onClick={() => onActiveProfileTabChange("raw")}
            className={`flex-1 text-[12px] font-medium py-1.5 rounded-[6px] transition-colors ${
              activeProfileTab === "raw"
                ? "bg-[#242424] text-[#e2e2e2] shadow-sm"
                : "text-[#555] hover:text-[#ababab]"
            }`}
          >
            {tabRawLabel}
          </button>
          <button
            onClick={() => onActiveProfileTabChange("jpeg")}
            className={`flex-1 text-[12px] font-medium py-1.5 rounded-[6px] transition-colors ${
              activeProfileTab === "jpeg"
                ? "bg-[#242424] text-[#e2e2e2] shadow-sm"
                : "text-[#555] hover:text-[#ababab]"
            }`}
          >
            {tabJpegLabel}
          </button>
        </div>
      )}

      {/* Combined AI Profile + Preset row — label TBD, currently "Edit Profile" */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-[13px] text-[#ababab] shrink-0">Edit Profile</span>
        <CombinedProfileDropdown
          profileValue={activeProfile}
          onProfileChange={onActiveProfileChange}
          presetValue={editPreset ?? null}
          onPresetChange={onEditPresetChange ?? (() => {})}
        />
      </div>

      {showAiToggles && (
        <AiTogglesCard
          data-coachmark="retouch-preset"
          activeProfile={activeProfile}
          aiCropping={aiCropping}
          onAiCroppingChange={onAiCroppingChange}
          cropStyle={cropStyle}
          onCropStyleChange={onCropStyleChange}
          cropOrientation={cropOrientation}
          onCropOrientationChange={onCropOrientationChange}
          aiStraightening={aiStraightening}
          onAiStraighteningChange={onAiStraighteningChange}
          aiMasking={aiMasking}
          onAiMaskingChange={onAiMaskingChange}
          maskMode={maskMode}
          onMaskModeChange={onMaskModeChange}
        />
      )}

      {onRetouchPresetChange !== undefined && (
        <div
          // data-coachmark="retouch-preset"
          className="flex items-center justify-between pb-1.5 mt-[-4px]"
        >
          <span className="text-[13px] text-[#ababab]">Retouching Preset</span>
          <PresetDropdown
            compact
            menuWidth={300}
            triggerTextSize="13px"
            value={retouchPreset ?? null}
            onChange={onRetouchPresetChange}
          />
        </div>
      )}

      {/* {showAiToggles && onRetouchPresetChange !== upndefined && (
        <div className="w-full h-px bg-[#333] my-[-4px]" />
      )} */}
    </div>
  );
};
