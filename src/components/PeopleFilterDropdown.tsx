import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";
import { subjectPhotoCounts } from "@/data/subjectMapping";

const subjectModules = import.meta.glob(
  "../assets/subjects/*.png",
  { eager: true }
) as Record<string, { default: string }>;

const subjects = Object.entries(subjectModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, mod], i) => ({ avatar: mod.default, count: subjectPhotoCounts[i] ?? 0 }))
  .sort((a, b) => b.count - a.count);

const PeopleFilterDropdown = () => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
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

  const handleClick = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  };

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`flex items-center gap-1 px-2 py-1.5 rounded text-[12px] transition-colors ${
          open
            ? "text-[#e2e2e2] bg-white/10"
            : "text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5"
        }`}
      >
        <span>People</span>
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
            <button className="text-[#2563eb] text-[11px] font-medium">
              View all ({subjects.length})
            </button>
          </div>

          <div className="max-h-[376px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="grid grid-cols-6 gap-2">
              {subjects.map(({ avatar, count }, i) => (
                <button key={i} className="flex flex-col items-center gap-1">
                  <div className="w-[72px] h-[72px] rounded-full overflow-hidden">
                    <img src={avatar} alt={`Person ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[#777] text-[11px] font-medium">{count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PeopleFilterDropdown;
