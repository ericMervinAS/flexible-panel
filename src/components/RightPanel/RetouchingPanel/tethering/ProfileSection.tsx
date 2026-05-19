import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown, CropIcon } from "@phosphor-icons/react";
import { Toggle } from "./Toggle";
import { InlineSelect } from "./InlineSelect";
import {
  parseDualFormat,
  PROFILE_SECTIONS_DATA,
  ALL_PROFILES_FLAT,
  type ProfileItem,
} from "./constants";

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

// ─── ProfileDropdown ──────────────────────────────────────────────────────────

interface ProfileDropdownProps {
  value: string | null;
  onChange: (v: string | null) => void;
}

const ProfileDropdown = ({ value, onChange }: ProfileDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedProfile = ALL_PROFILES_FLAT.find((p) => p.name === value) ?? null;

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 300),
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onClickOutside = (e: MouseEvent) => {
      if (
        !containerRef.current?.contains(e.target as Node) &&
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

  const isCropOnly = value === "Crop & Straighten only";

  return (
    <div ref={containerRef} className="w-full">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-3 py-2 bg-[#242424] rounded-[8px] hover:bg-[#2c2c2c] transition-colors"
      >
        {isCropOnly ? (
          <div className="w-[56px] h-[38px] rounded-[4px] bg-[#2a2a2a] flex items-center justify-center shrink-0">
            <CropIcon size={18} className="text-[#777]" />
          </div>
        ) : selectedProfile ? (
          <ProfileThumb img={selectedProfile.img} size="sm" />
        ) : null}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {(isCropOnly || selectedProfile) && !isCropOnly && <LrcBadge />}
          <span className="text-[14px] font-medium text-[#e2e2e2] flex-1 truncate text-left">
            {isCropOnly ? "Crop & Straighten only" : (selectedProfile?.name ?? "Select a profile")}
          </span>
          {selectedProfile && !isCropOnly && <FormatBadge format={selectedProfile.format} />}
        </div>
        <CaretDown
          className={`w-4 h-4 shrink-0 text-[#777] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ ...menuStyle, scrollbarWidth: "none" } as React.CSSProperties}
            className="bg-[#1e1e1e] border border-[#303030] rounded-[10px] p-1 flex flex-col max-h-[420px] overflow-y-auto shadow-xl"
          >
            <button
              onClick={() => {
                onChange("Crop & Straighten only");
                setOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[6px] transition-colors ${isCropOnly ? "bg-white/5" : "hover:bg-white/5"}`}
            >
              <CropIcon size={16} className="text-[#777] shrink-0" />
              <span className="text-[14px] text-[#ababab]">Crop &amp; Straighten only</span>
            </button>

            {PROFILE_SECTIONS_DATA.map((section, si) => (
              <div key={section.group}>
                <div className={`h-px bg-[#2a2a2a] mx-2 ${si === 0 ? "my-1" : "mt-1 mb-0"}`} />
                <div className="px-3 pt-2.5 pb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#555]">
                    {section.group}
                  </span>
                </div>
                {section.profiles.map((profile: ProfileItem) => (
                  <button
                    key={profile.name}
                    onClick={() => {
                      onChange(profile.name);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-[6px] transition-colors ${
                      value === profile.name ? "bg-white/5" : "hover:bg-white/5"
                    }`}
                  >
                    <ProfileThumb img={profile.img} size="md" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <LrcBadge />
                      <span className="text-[14px] font-medium text-[#e2e2e2] flex-1 truncate text-left">
                        {profile.name}
                      </span>
                      <FormatBadge format={profile.format} />
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body
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
    <div className="flex flex-col gap-0.5 mt-1">
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[12px] text-[#777] w-[110px] shrink-0">AI Cropping</span>
        <div className="flex items-center gap-2 flex-1 justify-end">
          {aiCropping && (
            <>
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
            </>
          )}
          <Toggle value={aiCropping} onChange={onAiCroppingChange} />
        </div>
      </div>

      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[12px] text-[#777] w-[110px] shrink-0">AI Straightening</span>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <Toggle value={aiStraightening} onChange={onAiStraighteningChange} />
        </div>
      </div>

      {!isCropOnly && (
        <div className="flex items-center gap-2 py-1.5">
          <span className="text-[12px] text-[#777] w-[110px] shrink-0">AI Masking</span>
          <div className="flex items-center gap-2 flex-1 justify-end">
            {aiMasking && (
              <InlineSelect
                value={maskMode}
                options={["Subject Mask with Edits", "Subject Mask", "Background Mask"] as const}
                onChange={onMaskModeChange}
              />
            )}
            <Toggle value={aiMasking} onChange={onAiMaskingChange} />
          </div>
        </div>
      )}
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
  rawFormatLabel?: string;
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
  rawFormatLabel,
}: ProfileSectionProps) => {
  const { isDual, rawLabel, jpegLabel } = parseDualFormat(fileFormat);
  const showTabs = alwaysShowTabs || isDual;
  const tabRawLabel = isDual ? rawLabel : (rawFormatLabel || "RAW");
  const tabJpegLabel = isDual ? jpegLabel : "JPEG";

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
  const showAiToggles = activeProfile !== null;

  return (
    <div className="flex flex-col gap-2">
      {showTabs && (
        <div className="flex p-0.5 bg-[#161616] rounded-[8px]">
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

      <ProfileDropdown value={activeProfile} onChange={onActiveProfileChange} />

      {showAiToggles && (
        <AiTogglesCard
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
    </div>
  );
};
