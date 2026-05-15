import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDownIcon } from "@phosphor-icons/react";
import { PRESETS } from "@/data/presetMapping";

interface PresetDropdownProps {
  value: string | null;
  onChange: (preset: string) => void;
  /**
   * When set, only presets tagged with "All Subjects" or this specific gender
   * are shown. Omit (or pass undefined) to show all presets.
   */
  genderFilter?: string;
}

const PresetDropdown = ({ value, onChange, genderFilter }: PresetDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
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
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
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
                <div className="px-2 py-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#777] leading-4">
                    {section.title}
                  </span>
                </div>
                {section.options.map((opt) => {
                  const applicable = isApplicable(opt.tags);
                  return (
                    <button
                      key={opt.name}
                      disabled={!applicable}
                      onClick={() => {
                        onChange(opt.name);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-2 py-3 rounded flex flex-col gap-1.5 transition-colors ${applicable ? "hover:bg-white/5 cursor-pointer" : "opacity-35 cursor-not-allowed"}`}
                    >
                      <span className="text-[14px] font-medium text-[#ababab] leading-5">
                        {opt.name}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {opt.tags.map((tag) => (
                          <span
                            key={tag}
                            className="h-5 px-1 py-1 rounded text-[11px] font-medium text-[#e2e2e2] leading-3 bg-[rgba(17,17,17,0.4)] backdrop-blur-[2px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
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
