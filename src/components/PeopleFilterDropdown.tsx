import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";
import type { ModelSubject } from "@/hooks/useFaceDetection";

interface PeopleFilterDropdownProps {
  onFilterChange: (modelSubjectIds: number[]) => void;
  modelSubjects?: ModelSubject[];
  isModelDetecting?: boolean;
  detectionProgress?: number;
}

const PeopleFilterDropdown = ({
  onFilterChange,
  modelSubjects,
  isModelDetecting,
  detectionProgress,
}: PeopleFilterDropdownProps) => {
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

  const toggleSubject = (subjectId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(subjectId) ? next.delete(subjectId) : next.add(subjectId);
      onFilterChange(Array.from(next));
      return next;
    });
  };

  const isActive = selected.size > 0;
  const subjects = modelSubjects ?? [];

  if (isModelDetecting) {
    return (
      <div>
        <button
          ref={buttonRef}
          onClick={handleOpen}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] transition-colors ${
            open
              ? "text-white bg-white/10 border-[0.5px] border-[#5e5e5e]"
              : "text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5"
          }`}
        >
          <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#ababab] border-t-transparent animate-spin shrink-0" />
          <span>People{(detectionProgress ?? 0) > 0 ? ` ${detectionProgress}%` : ""}</span>
        </button>

        {open && createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-[#242424] border border-[#474747] rounded-xl px-5 py-4 flex flex-col gap-2"
            style={{ top: pos.top, left: pos.left, width: 340 }}
          >
            <span className="text-[15px] font-medium text-[#e2e2e2]">Finding faces across your album</span>
            <span className="text-[13px] text-[#777] leading-5">People filter will be available once this is done</span>
            <button
              onClick={() => setOpen(false)}
              className="text-[#ef4444] text-[13px] font-medium text-left mt-1 hover:text-[#dc2626] transition-colors"
            >
              Cancel
            </button>
          </div>,
          document.body
        )}
      </div>
    );
  }

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

      {open && subjects.length > 0 && createPortal(
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
              <span className="text-[#2563eb] text-[11px] font-medium">
                View all ({subjects.length})
              </span>
            </div>
          </div>

          <div className="max-h-[376px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="grid grid-cols-6 gap-2">
              {subjects.map((subject) => {
                const active = selected.has(subject.id);
                return (
                  <button
                    key={subject.id}
                    onClick={() => toggleSubject(subject.id)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className={`w-[72px] h-[72px] rounded-full overflow-hidden border-[2px] transition-colors ${
                      active ? "border-[#2563eb]" : "border-transparent"
                    }`}>
                      <img
                        src={subject.keyFaceDataUrl}
                        alt={`Person ${subject.id + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                      {subject.photoCount}
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
