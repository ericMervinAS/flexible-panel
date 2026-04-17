import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";
import { subjectPhotoCounts } from "@/data/subjectMapping";

const subjectModules = import.meta.glob(
  "../assets/subjects/*.png",
  { eager: true }
) as Record<string, { default: string }>;

// Preserve original subject index for mapping against getSubjectIndices
const subjects = Object.entries(subjectModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, mod], i) => ({ avatar: mod.default, count: subjectPhotoCounts[i] ?? 0, subjectIndex: i }))
  .sort((a, b) => b.count - a.count);

interface PeopleFilterDropdownProps {
  onFilterChange: (subjectIndices: number[]) => void;
}

const PeopleFilterDropdown = ({ onFilterChange }: PeopleFilterDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  };

  const toggleSubject = (subjectIndex: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(subjectIndex) ? next.delete(subjectIndex) : next.add(subjectIndex);
      onFilterChange(Array.from(next));
      return next;
    });
  };

  const isActive = selected.size > 0;

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 px-2 py-1.5 rounded text-[12px] transition-colors ${
          open || isActive
            ? "text-white bg-white/10 border-[0.5px] border-[#5e5e5e]"
            : "text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5"
        }`}
      >
        <span>People</span>
        {isActive && (
          <span className="flex items-center justify-center min-w-[12px] px-[2px] rounded-[16px] bg-white text-[#474747] text-[11px] font-semibold tracking-[0.5px] leading-[12px]">
            {selected.size}
          </span>
        )}
        <CaretDown className={`w-3 h-3 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] flex flex-col gap-4 bg-[#242424] border border-[#474747] rounded-lg px-5 py-4"
          style={{ top: pos.top, left: pos.left, width: 512 }}
        >
          <div className="flex items-center justify-between h-4">
            <span className="text-[#777] text-[12px] font-semibold uppercase tracking-[0.5px]">
              Filter by people
            </span>
            <div className="flex items-center gap-3">
              {isActive && (
                <button
                  onClick={() => { setSelected(new Set()); onFilterChange([]); }}
                  className="text-[#777] text-[11px] font-medium hover:text-[#ababab] transition-colors"
                >
                  Clear
                </button>
              )}
              <button className="text-[#2563eb] text-[11px] font-medium">
                View all ({subjects.length})
              </button>
            </div>
          </div>

          <div className="max-h-[376px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="grid grid-cols-6 gap-2">
              {subjects.map(({ avatar, count, subjectIndex }) => {
                const active = selected.has(subjectIndex);
                return (
                  <button
                    key={subjectIndex}
                    onClick={() => toggleSubject(subjectIndex)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className={`w-[72px] h-[72px] rounded-full overflow-hidden border-[2px] transition-colors ${
                      active ? "border-[#2563eb]" : "border-transparent"
                    }`}>
                      <img src={avatar} alt={`Person ${subjectIndex + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PeopleFilterDropdown;
