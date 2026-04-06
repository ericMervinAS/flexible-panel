import { useState } from "react";
import { Eye, Plus, Check, ChevronDown } from "lucide-react";
import subject1 from "@/assets/subject-1.png";
import subject2 from "@/assets/subject-2.png";
import subject3 from "@/assets/subject-3.png";
import subject4 from "@/assets/subject-4.png";

const groups = ["All Subjects", "Masculine", "Feminine", "Elderly", "Child"];

const subjects = [
  { avatar: subject1, count: 562 },
  { avatar: subject2, count: 560 },
  { avatar: subject3, count: 250 },
  { avatar: subject4, count: 200 },
];

const presetOptions = ["Anti Aging", "Face Glow Up", "Skin Retouch", "Eye Enhance", "Natural Look"];

// Group initial letter map
const groupInitial: Record<string, string> = {
  "All Subjects": "A", "Masculine": "M", "Feminine": "F", "Elderly": "E", "Child": "C",
};

interface SubjectSyncProps {
  isScanning: boolean;
  onSelectionsChange?: (hasSelections: boolean) => void;
}

const SubjectSync = ({ isScanning, onSelectionsChange }: SubjectSyncProps) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());
  const [presets, setPresets] = useState<Record<string, string>>({});

  const notify = (groups: Set<string>, subjects: Set<number>) => {
    onSelectionsChange?.(groups.size > 0 || subjects.size > 0);
  };

  const toggleGroup = (label: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      notify(next, selectedSubjects);
      return next;
    });
  };

  const toggleSubject = (i: number) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      notify(selectedGroups, next);
      return next;
    });
  };

  const cyclePreset = (key: string) => {
    setPresets((prev) => {
      const current = prev[key] || presetOptions[0];
      const idx = presetOptions.indexOf(current);
      return { ...prev, [key]: presetOptions[(idx + 1) % presetOptions.length] };
    });
  };

  const hasSelections = selectedSubjects.size > 0 || selectedGroups.size > 0;

  return (
    <div className="px-5 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-normal text-[#e2e2e2]">Subject Sync</h3>
          <span className="px-1 py-0.5 text-[11px] font-medium leading-[12px] rounded backdrop-blur-[2px] bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.4)] text-[#e2e2e2]">
            New
          </span>
          {isScanning && (
            <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
          )}
        </div>
        <p className="text-[12px] text-[#ababab] leading-4">
          Apply presets on subjects identified across the entire album
        </p>
      </div>

      {!isScanning && (
        <div className="flex flex-col gap-4">
          {/* Group chips */}
          <div className="flex flex-wrap gap-x-1.5 gap-y-2">
            {groups.map((label) => {
              const active = selectedGroups.has(label);
              return (
                <button
                  key={label}
                  onClick={() => toggleGroup(label)}
                  className={`flex items-center gap-1 h-6 px-2 text-[13px] leading-4 rounded bg-[#242424] transition-colors ${
                    active
                      ? "border border-[#777] text-[#e2e2e2]"
                      : "border border-transparent text-[#ababab] hover:text-[#e2e2e2]"
                  }`}
                >
                  {label}
                  {active ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                </button>
              );
            })}
          </div>

          {/* Subject avatar grid */}
          <div className="grid grid-cols-5 gap-2">
            {subjects.map((s, i) => {
              const active = selectedSubjects.has(i);
              return (
                <div key={i} className="flex flex-col items-center gap-1 relative">
                  <button
                    onClick={() => toggleSubject(i)}
                    className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${
                      active ? "border-[#2563eb]" : "border-transparent"
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
                  <span className={`text-[10px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                    {s.count}
                  </span>
                </div>
              );
            })}
            <div className="flex flex-col items-center gap-1">
              <button className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-[#777] hover:bg-white/20 transition-colors">
                <Eye className="w-5 h-5" />
              </button>
              <span className="text-[10px] font-medium text-[#777]">View More</span>
            </div>
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
                    <button
                      onClick={() => cyclePreset(`subject-${i}`)}
                      className="flex flex-1 items-center justify-between px-2.5 py-2 bg-[#242424] rounded text-[12px] text-[#ababab] hover:text-[#e2e2e2] transition-colors"
                    >
                      <span>{presets[`subject-${i}`] || presetOptions[0]}</span>
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                ))}
                {Array.from(selectedGroups).map((label) => (
                  <div key={`group-${label}`} className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded shrink-0 bg-white/5 flex items-center justify-center">
                      <span className="text-white text-[20px] font-medium">{groupInitial[label]}</span>
                    </div>
                    <button
                      onClick={() => cyclePreset(`group-${label}`)}
                      className="flex flex-1 items-center justify-between px-2.5 py-2 bg-[#242424] rounded text-[12px] text-[#ababab] hover:text-[#e2e2e2] transition-colors"
                    >
                      <span>{presets[`group-${label}`] || presetOptions[1]}</span>
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubjectSync;
