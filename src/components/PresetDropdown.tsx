import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface PresetOption {
  name: string;
  tags: string[];
}

interface PresetSection {
  title: string;
  options: PresetOption[];
}

const presetSections: PresetSection[] = [
  {
    title: "Custom Presets",
    options: [
      { name: "Custom Preset 1", tags: ["Masculine", "Feminine", "Child"] },
    ],
  },
  {
    title: "Aftershoot Presets",
    options: [
      { name: "Newborn Shoots", tags: ["All Subjects"] },
      { name: "Student Portraits", tags: ["All Subjects"] },
      { name: "Face Pop", tags: ["All Subjects"] },
      { name: "Anti Aging", tags: ["All Subjects"] },
      { name: "Face Clean Up", tags: ["All Subjects"] },
    ],
  },
];

interface PresetDropdownProps {
  value: string | null;
  onChange: (preset: string) => void;
}

const PresetDropdown = ({ value, onChange }: PresetDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <ChevronDown className="w-4 h-4 shrink-0" />
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
                  className="w-full text-left px-2 py-3 rounded flex flex-col gap-1.5 hover:bg-white/5 transition-colors"
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
