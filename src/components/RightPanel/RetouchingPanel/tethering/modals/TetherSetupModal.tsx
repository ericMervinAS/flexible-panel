import { useState } from "react";
import { createPortal } from "react-dom";
import { FolderSimpleIcon, CaretDown, X } from "@phosphor-icons/react";
import PresetDropdown from "@/components/PresetDropdown";
import SliderRow from "@/components/SliderRow";
import { getCameraSpec, getFormatOptions, parseDualFormat } from "../constants";
import { InlineSelect } from "../InlineSelect";
import { ProfileSection, type ProfileSectionProps } from "../ProfileSection";

interface TetherSetupModalProps extends Omit<ProfileSectionProps, "alwaysShowTabs"> {
  onCancel: () => void;
  onStart: () => void;
  currentImageSrc?: string;
  mode?: "setup" | "preferences";
  cameraName: string;
  retouchPreset: string | null;
  onRetouchPresetChange: (v: string | null) => void;
  retouchPresetStrength: number;
  onRetouchPresetStrengthChange: (v: number) => void;
  onFileFormatChange: (v: string) => void;
  importRaw: boolean;
  onImportRawChange: (v: boolean) => void;
  importJpeg: boolean;
  onImportJpegChange: (v: boolean) => void;
  namingTemplate: string;
  onNamingTemplateChange: (v: string) => void;
  destination: string;
  onDestinationChange: (v: string) => void;
}

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

export const TetherSetupModal = ({
  onCancel,
  onStart,
  mode = "setup",
  cameraName,
  retouchPreset,
  onRetouchPresetChange,
  retouchPresetStrength,
  onRetouchPresetStrengthChange,
  fileFormat,
  onFileFormatChange,
  importRaw,
  onImportRawChange,
  importJpeg,
  onImportJpegChange,
  namingTemplate,
  onNamingTemplateChange,
  destination,
  onDestinationChange,
  ...profileProps
}: TetherSetupModalProps) => {
  const isPreferences = mode === "preferences";
  const cameraSpec = getCameraSpec(cameraName);
  const formatOptions = getFormatOptions(cameraSpec);
  const { isDual, rawLabel, jpegLabel } = parseDualFormat(fileFormat);
  const isJpegOnly = !isDual && fileFormat.toLowerCase().startsWith("jpeg");
  const isRawOnly = !isDual && !isJpegOnly;
  const effectiveFileFormat = (() => {
    if (!isDual) return fileFormat;
    if (importRaw && importJpeg) return fileFormat;
    if (importRaw) return rawLabel;
    if (importJpeg) return jpegLabel;
    return fileFormat;
  })();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const prefixMatch = namingTemplate.match(/\{Prefix:([^}]*)\}/);
  const userPrefix = prefixMatch?.[1] ?? "";

  const activePatternId = (() => {
    const stripped = namingTemplate.replace(/\{Prefix:[^}]*\}/g, "{Prefix}");
    for (const p of NAMING_PATTERNS) {
      const pStripped = p.template.replace(/\{Prefix:[^}]*\}/g, "{Prefix}");
      if (pStripped === stripped) return p.id;
    }
    return null;
  })();

  const applyPattern = (p: (typeof NAMING_PATTERNS)[number]) => {
    if (p.needsPrefix && userPrefix) {
      onNamingTemplateChange(p.template.replace(/\{Prefix:[^}]*\}/, `{Prefix:${userPrefix}}`));
    } else {
      onNamingTemplateChange(p.template);
    }
  };

  const updatePrefix = (next: string) => {
    const sanitized = next.replace(/[/\\:*?"<>|{}]/g, "");
    if (namingTemplate.includes("{Prefix:")) {
      onNamingTemplateChange(
        namingTemplate.replace(/\{Prefix:[^}]*\}/, `{Prefix:${sanitized || "Smith"}}`)
      );
    }
  };

  const previewFor = (tpl: string) =>
    tpl
      .replace("{Date}", "2026-05-15")
      .replace(/\{Prefix:([^}]*)\}/, (_m, p) => userPrefix || p)
      .replace(/\{Counter(?::[^}]*)?\}/, "0001")
      .replace("{CameraModel}", cameraName.replace(/\s+/g, ""))
      .concat(`.${cameraSpec.raw}`);

  const activePattern = NAMING_PATTERNS.find((p) => p.id === activePatternId);
  const showPrefixInput = !!activePattern?.needsPrefix;

  const pickFolder = async () => {
    const w = window as unknown as {
      showDirectoryPicker?: () => Promise<{ name: string }>;
    };
    if (w.showDirectoryPicker) {
      try {
        const handle = await w.showDirectoryPicker();
        onDestinationChange(`~/Pictures/${handle.name}`);
      } catch {
        /* user cancelled */
      }
    } else {
      const next = window.prompt("Destination folder path", destination);
      if (next) onDestinationChange(next);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-[#1c1c1c] border border-[#303030] rounded-[16px] p-6 flex flex-col gap-6 w-[480px] max-h-[90vh] overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-[20px] font-semibold text-[#e2e2e2] leading-6">
              {isPreferences ? "Tethering Preferences" : "Start Tethered Shoot"}
            </h3>
            <p className="text-[14px] text-[#777] leading-5">
              {isPreferences
                ? "Adjust settings for your current tethered session."
                : "Connect your camera and set up auto-processing."}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        {/* Camera */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ABABAB]">
            Camera
          </span>
          <div className="flex items-center justify-between px-3 py-3 bg-[#242424] rounded-[8px]">
            <span className="text-[14px] font-medium text-[#e2e2e2]">{cameraName}</span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#e2e2e2]">Connected</span>
              <div className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
            </div>
          </div>
        </div>

        {/* File Format */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ABABAB]">
            File Format
          </span>
          <InlineSelect value={fileFormat} options={formatOptions} onChange={onFileFormatChange} />
        </div>

        {/* Import */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ABABAB]">
            Import
          </span>
          <div className="flex items-center gap-3">
            {/* RAW checkbox */}
            <button
              onClick={() => isDual && onImportRawChange(!importRaw)}
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
                {/* {rawLabel || cameraSpec.raw} */}
                RAW
              </span>
            </button>

            {/* JPEG checkbox */}
            <button
              onClick={() => isDual && onImportJpegChange(!importJpeg)}
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

        <div className="h-px w-full bg-[#333]" />

        {/* Editing Profile */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ABABAB]">
            Editing Profile
          </span>
          <ProfileSection
            fileFormat={effectiveFileFormat}
            {...profileProps}
          />
        </div>

        {/* Retouching Preset */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ABABAB]">
              Retouching Preset
            </span>
            <PresetDropdown
              compact
              menuWidth={300}
              triggerTextSize="13px"
              value={retouchPreset}
              onChange={(v) => onRetouchPresetChange(v)}
            />
          </div>
          {/* {retouchPreset && (
            <SliderRow
              label="Strength"
              value={retouchPresetStrength}
              onChange={onRetouchPresetStrengthChange}
              noPinArea
            />
          )} */}
        </div>

        {/* Advanced toggle */}
        <div className="flex flex-col gap-6">
          <button
            onClick={() => setShowAdvanced((p) => !p)}
            className="flex items-center gap-1.5 self-start text-[12px] font-medium text-[#ababab] hover:text-[#fff] transition-colors"
          >
            <CaretDown
              size={12}
              weight="bold"
              className={`transition-transform ${showAdvanced ? "rotate-0" : "-rotate-90"}`}
            />
            Advanced
          </button>

          {showAdvanced && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
                  Destination Folder
                </span>
                <button
                  onClick={pickFolder}
                  className="group flex w-full text-left gap-2 items-center justify-between px-2.5 py-2 bg-[#242424] rounded hover:bg-[#2a2a2a] transition-colors"
                >
                  <span className="text-[13px] text-[#e2e2e2] truncate flex-1">{destination}</span>
                  <FolderSimpleIcon size={16} className="text-[#777] shrink-0" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">
                  File Naming
                </span>

                <div className="flex flex-col gap-1 rounded-[8px] bg-[#161616] border border-[#2a2a2a] p-1">
                  {NAMING_PATTERNS.map((p) => {
                    const active = p.id === activePatternId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyPattern(p)}
                        className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-[6px] text-left transition-colors ${
                          active ? "bg-[#1e3a5f]/40" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                              active ? "border-[#60a5fa] bg-[#60a5fa]" : "border-[#444]"
                            }`}
                          />
                          <span
                            className={`text-[12px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#ababab]"}`}
                          >
                            {p.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#777] truncate">
                          {previewFor(p.template)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showPrefixInput && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#161616] border border-[#2a2a2a] rounded-[8px]">
                    <span className="text-[11px] uppercase tracking-[0.5px] text-[#777] shrink-0">
                      Prefix
                    </span>
                    <input
                      type="text"
                      value={userPrefix}
                      placeholder="Smith"
                      onChange={(e) => updatePrefix(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-[13px] text-[#e2e2e2] placeholder:text-[#3a3a3a] font-mono"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[8px] bg-[#2a2a2a] text-[14px] font-medium text-[#e2e2e2] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#3b7af5] active:bg-[#1d4ed8] rounded-[8px] text-[14px] font-medium text-white transition-colors"
          >
            {isPreferences ? "Save Preferences" : "Start Shooting"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
