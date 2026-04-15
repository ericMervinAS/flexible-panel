import { useState, useEffect, useRef } from "react";
import { Plus, Check, X, MagnifyingGlass } from "@phosphor-icons/react";
import PresetDropdown from "./PresetDropdown";
import Tooltip from "./Tooltip";
import { subjectPhotoCounts, subjectGender } from "@/data/subjectMapping";

const groups = ["All Subjects", "Masculine", "Feminine", "Elderly", "Child"];

const subjectModules = import.meta.glob(
  "../assets/subjects/*.png",
  { eager: true }
) as Record<string, { default: string }>;

const subjects = Object.entries(subjectModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, mod], i) => ({ avatar: mod.default, count: subjectPhotoCounts[i] ?? 0 }));

const groupInitial: Record<string, string> = {
  "All Subjects": "A", "Masculine": "M", "Feminine": "F", "Elderly": "E", "Child": "C",
};

export interface SubjectSyncState {
  selectedSubjects: number[];
  selectedGroups: string[];
  presets: Record<string, string | null>;
  subjectCounts: number[];
}

interface SubjectSyncProps {
  isScanning: boolean;
  disabled?: boolean;
  resetSignal?: number;
  appliedPresets?: Record<string, string>;
  onSelectionsChange?: (hasSelections: boolean) => void;
  onStateChange?: (state: SubjectSyncState) => void;
  onRescan?: () => void;
}

const SubjectSync = ({ isScanning, disabled, resetSignal, appliedPresets, onSelectionsChange, onStateChange, onRescan }: SubjectSyncProps) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());
  const [presets, setPresets] = useState<Record<string, string | null>>({});
  const [isRescanning, setIsRescanning] = useState(false);

  useEffect(() => {
    if (!resetSignal) return;
    setSelectedGroups(new Set());
    setSelectedSubjects(new Set());
    setPresets({});
    onSelectionsChange?.(false);
    onStateChange?.({ selectedSubjects: [], selectedGroups: [], presets: {}, subjectCounts: subjects.map((s) => s.count) });
  }, [resetSignal]);

  const handleRescan = () => {
    if (isScanning || isRescanning) return;
    setIsRescanning(true);
    onRescan?.();
    setTimeout(() => setIsRescanning(false), 3000);
  };

  const scanning = isScanning || isRescanning;

  const notify = (groups: Set<string>, subs: Set<number>, currentPresets: Record<string, string | null>) => {
    const hasValidSelections =
      Array.from(subs).some((i) => !!currentPresets[`subject-${i}`]) ||
      Array.from(groups).some((label) => !!currentPresets[`group-${label}`]);
    onSelectionsChange?.(hasValidSelections);
    onStateChange?.({
      selectedSubjects: Array.from(subs),
      selectedGroups: Array.from(groups),
      presets: currentPresets,
      subjectCounts: subjects.map((s) => s.count),
    });
  };

  const toggleGroup = (label: string) => {
    const isAdding = !selectedGroups.has(label);
    const next = new Set(selectedGroups);
    if (isAdding) next.add(label); else next.delete(label);

    let currentPresets = presets;
    if (isAdding && appliedPresets?.[`group-${label}`] && !presets[`group-${label}`]) {
      currentPresets = { ...presets, [`group-${label}`]: appliedPresets[`group-${label}`] };
      setPresets(currentPresets);
    }

    setSelectedGroups(next);
    notify(next, selectedSubjects, currentPresets);
  };

  const toggleSubject = (i: number) => {
    const isAdding = !selectedSubjects.has(i);
    const next = new Set(selectedSubjects);
    if (isAdding) next.add(i); else next.delete(i);

    let currentPresets = presets;
    if (isAdding && appliedPresets?.[`subject-${i}`] && !presets[`subject-${i}`]) {
      currentPresets = { ...presets, [`subject-${i}`]: appliedPresets[`subject-${i}`] };
      setPresets(currentPresets);
    }

    setSelectedSubjects(next);
    notify(selectedGroups, next, currentPresets);
  };

  const setPreset = (key: string, value: string) => {
    setPresets((prev) => {
      const next = { ...prev, [key]: value };
      notify(selectedGroups, selectedSubjects, next);
      return next;
    });
  };

  const hasSelections = selectedSubjects.size > 0 || selectedGroups.size > 0;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [hoveredSubject, setHoveredSubject] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    if (popoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [popoverOpen]);

  // Sort by count descending
  const sortedIndices = subjects
    .map((s, i) => ({ i, count: s.count, applied: !!appliedPresets?.[`subject-${i}`] }))
    .sort((a, b) => b.count - a.count)
    .map(({ i }) => i);

  const TOP_N = 4;
  const visibleIndices = sortedIndices.slice(0, TOP_N);
  const hiddenCount = sortedIndices.length - TOP_N;

  return (
    <div className={`px-5 flex flex-col gap-3 transition-opacity ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-normal text-[#e2e2e2]">Subject Sync</h3>
            <span className="px-1 py-0.5 text-[11px] font-medium leading-[12px] rounded backdrop-blur-[2px] bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.4)] text-[#e2e2e2]">
              New
            </span>
            {scanning && (
              <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
            )}
          </div>
          <button
            onClick={handleRescan}
            disabled={scanning}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${scanning ? "text-[#474747] cursor-not-allowed" : "text-[#777] hover:text-[#e2e2e2] hover:bg-white/5"
              }`}
          >
            <MagnifyingGlass className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[12px] text-[#ababab] leading-4">
          Apply presets on subjects identified across the entire album
        </p>
      </div>

      {!isScanning && <div className={`flex flex-col gap-4 transition-opacity ${isRescanning ? "opacity-40 pointer-events-none" : ""}`}>
        {/* Group chips */}
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">
          {groups.map((label) => {
            const active = selectedGroups.has(label);
            const applied = !!appliedPresets?.[`group-${label}`];
            return (
              <button
                key={label}
                onClick={() => toggleGroup(label)}
                className={`flex items-center gap-1 h-6 px-2 text-[13px] leading-4 rounded border transition-colors ${active
                    ? "border-[#777] bg-[#242424] text-[#e2e2e2]"
                    : applied
                      ? "border-[rgba(21,128,61,0.4)] bg-[rgba(21,128,61,0.12)] text-[#e2e2e2] backdrop-blur-[2px] hover:bg-[rgba(21,128,61,0.18)]"
                      : "border-transparent bg-[#242424] text-[#ababab] hover:text-[#e2e2e2]"
                  }`}
              >
                {label}
                {active ? (
                  <X className="w-3 h-3" />
                ) : applied ? (
                  <Check className="w-3 h-3 text-[#16a34a]" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
              </button>
            );
          })}
        </div>

        {/* Subject avatar grid */}
        <div ref={popoverRef} className="relative">
          <div className="grid grid-cols-5 gap-2">
            {visibleIndices.map((i) => {
              const s = subjects[i];
              const active = selectedSubjects.has(i);
              const applied = !!appliedPresets?.[`subject-${i}`];
              const presetLabel = appliedPresets?.[`subject-${i}`];
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 relative"
                  onMouseEnter={() => applied && setHoveredSubject(i)}
                  onMouseLeave={() => setHoveredSubject(null)}
                >
                  {presetLabel && (
                    <Tooltip label={presetLabel} prefix="Applied:" visible={hoveredSubject === i} />
                  )}
                  <button
                    onClick={() => toggleSubject(i)}
                    className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${active ? "border-[#2563eb]" : "border-transparent"
                      }`}
                  >
                    <img
                      src={s.avatar}
                      alt={`Subject ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                  {active && (
                    <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#2563eb] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </div>
                  )}
                  {!active && applied && (
                    <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#16a34a] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </div>
                  )}
                  <span className={`text-[10px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                    {s.count}
                  </span>
                </div>
              );
            })}
            {/* View More is always the 5th cell when there are hidden subjects */}
            {hiddenCount > 0 && (
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setPopoverOpen((v) => !v)}
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors ${popoverOpen ? "bg-white/20 text-[#e2e2e2]" : "bg-white/10 text-[#777] hover:bg-white/20 hover:text-[#ababab]"
                    }`}
                >
                  <span className="text-[12px] font-medium leading-none">+{hiddenCount}</span>
                </button>
                <span className="text-[10px] font-medium text-[#777]">View More</span>
              </div>
            )}
          </div>

          {/* View More popover */}
          {popoverOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 bg-[#242424] border border-[#474747] rounded-lg p-3 flex flex-col gap-3 max-h-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">All Subjects</span>
              <div className="grid grid-cols-5 gap-2">
                {sortedIndices.map((i) => {
                  const s = subjects[i];
                  const active = selectedSubjects.has(i);
                  const applied = !!appliedPresets?.[`subject-${i}`];
                  const presetLabel = appliedPresets?.[`subject-${i}`];
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1 relative"
                      onMouseEnter={() => applied && setHoveredSubject(i)}
                      onMouseLeave={() => setHoveredSubject(null)}
                    >
                      {presetLabel && (
                        <div
                          className={`absolute bottom-[calc(100%-10px)] left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-150 ${hoveredSubject === i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
                          style={hoveredSubject === i ? { transitionDelay: "300ms" } : { transitionDelay: "0ms" }}
                        >
                          <span className="whitespace-nowrap px-[6px] py-[4px] text-[11px] font-medium text-[#474747] bg-[#f6f6f6] rounded-[4px]">
                            {presetLabel}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => toggleSubject(i)}
                        className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${active ? "border-[#2563eb]" : "border-transparent hover:border-[#5e5e5e]"
                          }`}
                      >
                        <img
                          src={s.avatar}
                          alt={`Subject ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {active && (
                        <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#2563eb] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                      {!active && applied && (
                        <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#16a34a] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                      <span className={`text-[10px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                        {s.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Subjects section */}
        {hasSelections && (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] text-[#ababab] leading-4">Selected Subjects</span>
            <div className="flex flex-col gap-2">
              {Array.from(selectedSubjects).map((i) => (
                <div key={`subject-${i}`} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded shrink-0 overflow-hidden">
                    <img src={subjects[i].avatar} alt={`Subject ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <PresetDropdown
                    value={presets[`subject-${i}`] ?? null}
                    genderFilter={subjectGender[i]}
                    onChange={(v) => setPreset(`subject-${i}`, v)}
                  />
                </div>
              ))}
              {Array.from(selectedGroups).map((label) => (
                <div key={`group-${label}`} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded shrink-0 bg-white/5 flex items-center justify-center">
                    <span className="text-white text-[20px] font-medium">{groupInitial[label]}</span>
                  </div>
                  <PresetDropdown
                    value={presets[`group-${label}`] ?? null}
                    genderFilter={label}
                    onChange={(v) => setPreset(`group-${label}`, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>}
    </div>
  );
};

export default SubjectSync;
