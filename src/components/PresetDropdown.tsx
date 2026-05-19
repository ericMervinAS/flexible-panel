import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDownIcon, TrashIcon } from "@phosphor-icons/react";
import { PRESETS } from "@/data/presetMapping";

interface PresetDropdownProps {
  value: string | null;
  onChange: (preset: string) => void;
  onNewPreset?: () => void;
  onDeletePreset?: (name: string) => void;
  /**
   * When set, only presets tagged with "All Subjects" or this specific gender
   * are shown. Omit (or pass undefined) to show all presets.
   */
  genderFilter?: string;
  /** Renders as a transparent inline text+caret button (no background) */
  compact?: boolean;
  /** When compact, use this ref as the menu anchor for width/position (e.g. the full preset row) */
  anchorRef?: React.RefObject<HTMLElement>;
  /** Override the dropdown menu width in px */
  menuWidth?: number;
  /** Override the compact trigger font size (default "12px") */
  triggerTextSize?: string;
}

const PresetDropdown = ({
  value,
  onChange,
  onNewPreset,
  onDeletePreset,
  genderFilter,
  compact,
  anchorRef,
  menuWidth,
  triggerTextSize = "12px",
}: PresetDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAllSubjectsCtx = genderFilter === "All Subjects";
  const isApplicable = (tags: string[]) =>
    isAllSubjectsCtx ||
    !genderFilter ||
    tags.includes("All Subjects") ||
    tags.includes(genderFilter);

  const presetSections = [
    { title: "Custom Presets", options: PRESETS.filter((p) => p.custom) },
    { title: "Aftershoot Presets", options: PRESETS.filter((p) => !p.custom) },
  ].filter((s) => s.options.length > 0);

  const updatePosition = () => {
    const anchor = compact ? (anchorRef?.current ?? containerRef.current) : triggerRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: menuWidth ?? rect.width,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    // Reposition on scroll so the menu follows its trigger
    const handleScroll = () => updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  if (compact) {
    return (
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-1 font-medium text-[#ababab] hover:text-[#e2e2e2] transition-colors"
          style={{ fontSize: triggerTextSize }}
        >
          <span>{value || "Select Preset"}</span>
          <CaretDownIcon className="w-4 h-4 shrink-0" />
        </button>

        {open &&
          createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="bg-[#242424] border border-[#474747] rounded-lg p-1 flex flex-col gap-0.5 max-h-96 overflow-y-auto"
            >
              {presetSections.map((section, si) => (
                <div key={section.title}>
                  {si > 0 && <div className="h-px bg-[#474747] mx-1 my-0.5" />}
                  <div className="px-2 py-2 flex items-center justify-between">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#777] leading-4">
                      {section.title}
                    </span>
                    {section.title === "Custom Presets" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewPreset?.();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#333] hover:bg-[#3d3d3d] text-[#e2e2e2] text-[12px] font-medium transition-colors"
                      >
                        + New
                      </button>
                    )}
                  </div>
                  {section.options.map((opt) => {
                    const applicable = isApplicable(opt.tags);
                    const isCustom = opt.custom;
                    return (
                      <div
                        key={opt.name}
                        className={`group relative flex items-center rounded transition-colors ${applicable ? "hover:bg-white/5" : "opacity-35"}`}
                      >
                        <button
                          disabled={!applicable}
                          onClick={() => {
                            onChange(opt.name);
                            setOpen(false);
                          }}
                          className={`flex-1 text-left px-2 py-2.5 flex flex-col gap-0.5 ${applicable ? "cursor-pointer" : "cursor-not-allowed"}`}
                        >
                          <span className="text-[14px] font-medium text-[#e2e2e2] leading-5">
                            {opt.name}
                          </span>
                          <span className="text-[12px] text-[#777] leading-4">
                            {opt.tags.join(" · ")}
                          </span>
                        </button>
                        {isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePreset?.(opt.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 shrink-0 mr-2 p-1 rounded text-[#555] hover:text-[#e2e2e2] transition-all"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>,
            document.body
          )}
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <button
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between px-2.5 py-2 bg-[#242424] rounded text-[12px] transition-colors ${value ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"}`}
      >
        <span>{value || "Select Preset"}</span>
        <CaretDownIcon className="w-4 h-4 shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="bg-[#242424] border border-[#474747] rounded-lg p-1 flex flex-col gap-0.5 max-h-96 overflow-y-auto"
          >
            {presetSections.map((section, si) => (
              <div key={section.title}>
                {si > 0 && <div className="h-px bg-[#474747] mx-1 my-0.5" />}
                <div className="px-2 py-2 flex items-center justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#777] leading-4">
                    {section.title}
                  </span>
                  {section.title === "Custom Presets" && onNewPreset && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewPreset();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#333] hover:bg-[#3d3d3d] text-[#e2e2e2] text-[12px] font-medium transition-colors"
                    >
                      + New
                    </button>
                  )}
                </div>
                {section.options.map((opt) => {
                  const applicable = isApplicable(opt.tags);
                  const isCustom = opt.custom;
                  return (
                    <div
                      key={opt.name}
                      className={`group relative flex items-center rounded transition-colors ${applicable ? "hover:bg-white/5" : "opacity-35"}`}
                    >
                      <button
                        disabled={!applicable}
                        onClick={() => {
                          onChange(opt.name);
                          setOpen(false);
                        }}
                        className={`flex-1 text-left px-2 py-2.5 flex flex-col gap-0.5 ${applicable ? "cursor-pointer" : "cursor-not-allowed"}`}
                      >
                        <span className="text-[14px] font-medium text-[#e2e2e2] leading-5">
                          {opt.name}
                        </span>
                        <span className="text-[12px] text-[#777] leading-4">
                          {opt.tags.join(" · ")}
                        </span>
                      </button>
                      {isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePreset?.(opt.name);
                          }}
                          className="opacity-0 group-hover:opacity-100 shrink-0 mr-2 p-1 rounded text-[#555] hover:text-[#e2e2e2] transition-all"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default PresetDropdown;
