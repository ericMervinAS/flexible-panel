import { useState, useRef, useEffect } from "react";
import { CaretDown } from "@phosphor-icons/react";
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
  const ref = useRef<HTMLDivElement>(null);

  // "All Subjects" context: show all presets (gender-specific ones route via setPresetForChip).
  // Specific gender context: hide presets that don't match.
  // No filter (undefined): show everything.
  const isAllSubjectsCtx = genderFilter === "All Subjects";

  const isVisible = (tags: string[]) =>
    isAllSubjectsCtx || !genderFilter || tags.includes("All Subjects") || tags.includes(genderFilter);

  const presetSections = [
    { title: "Custom Presets",     options: PRESETS.filter((p) =>  p.custom && isVisible(p.tags)) },
    { title: "Aftershoot Presets", options: PRESETS.filter((p) => !p.custom && isVisible(p.tags)) },
  ].filter((s) => s.options.length > 0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative flex-1">
      {/* Trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between px-2.5 py-2 bg-[#242424] rounded text-[12px] transition-colors ${value ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"}`}
      >
        <span>{value || "Select Preset"}</span>
        <CaretDown className="w-4 h-4 shrink-0" />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-[#242424] border border-[#474747] rounded-lg p-1 flex flex-col gap-0.5 max-h-96 overflow-y-auto">
          {presetSections.map((section, si) => (
            <div key={section.title}>
              {si > 0 && <div className="h-px bg-[#474747] mx-1 my-0.5" />}
              {/* Section title */}
              <div className="px-2 py-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#777] leading-4">
                  {section.title}
                </span>
              </div>
              {/* Options */}
              {section.options.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => {
                    onChange(opt.name);
                    setOpen(false);
                  }}
                  className="w-full text-left px-2 py-3 rounded flex flex-col gap-1.5 transition-colors hover:bg-white/5"
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
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PresetDropdown;
