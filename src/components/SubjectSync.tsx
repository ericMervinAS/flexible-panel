import { useState, useEffect, useRef } from "react";
import { Plus, Check, X, MinusCircle, ArrowsClockwiseIcon, StarFourIcon } from "@phosphor-icons/react";
import PresetDropdown from "./PresetDropdown";
import Tooltip from "./Tooltip";
import { subjectPhotoCounts, subjectGender } from "@/data/subjectMapping";
import type { ModelSubject } from "@/hooks/useFaceDetection";

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

const SelectionThumbnail = ({
  children,
  retouched,
  onRemove,
  ariaLabel,
}: {
  children: React.ReactNode;
  retouched: boolean;
  onRemove: () => void;
  ariaLabel: string;
}) => (
  <div className="relative w-11 h-11 shrink-0 group/thumb rounded overflow-hidden">
    <div className="w-full h-full">{children}</div>
    {retouched && (
      <div className="absolute bottom-[2px] right-[2px] w-[14px] h-[14px] rounded-[2px] bg-[#16a34a] flex items-center justify-center pointer-events-none z-10">
        <Check className="w-[10px] h-[10px] text-white" weight="bold" />
      </div>
    )}
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onRemove}
      className="absolute inset-0 z-10 bg-black/75 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100"
    >
      <MinusCircle className="w-4 h-4 text-white" />
    </button>
  </div>
);

export interface SubjectSyncState {
  selectedSubjects: number[];
  selectedGroups: string[];
  presets: Record<string, string | null>;
  subjectCounts: number[];
  selectedModelSubjects: number[];
  modelPresets: Record<string, string | null>;
}

interface SubjectSyncProps {
  isScanning: boolean;
  disabled?: boolean;
  resetSignal?: number;
  appliedPresets?: Record<string, string>;
  visibleSubjectIndices?: Set<number> | null;
  onSelectionsChange?: (hasSelections: boolean) => void;
  onStateChange?: (state: SubjectSyncState) => void;
  onRescan?: () => void;
  modelSubjects?: ModelSubject[];
  isModelDetecting?: boolean;
  modelStatusMessage?: string;
  modelSubjectFilter?: number[];
}

const SubjectSync = ({ isScanning, disabled, resetSignal, appliedPresets, visibleSubjectIndices, onSelectionsChange, onStateChange, onRescan, modelSubjects, isModelDetecting, modelStatusMessage, modelSubjectFilter }: SubjectSyncProps) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());
  const [presets, setPresets] = useState<Record<string, string | null>>({});
  const [isRescanning, setIsRescanning] = useState(false);
  const [selectedModelSubjects, setSelectedModelSubjects] = useState<Set<number>>(new Set());
  const [modelPresets, setModelPresets] = useState<Record<string, string | null>>({});
  const [hoveredModelSubject, setHoveredModelSubject] = useState<number | null>(null);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const [dismissedSelections, setDismissedSelections] = useState<Set<string>>(new Set());
  const [starHovered, setStarHovered] = useState(false);

  useEffect(() => {
    if (!resetSignal) return;
    setSelectedGroups(new Set());
    setSelectedSubjects(new Set());
    setPresets({});
    setSelectedModelSubjects(new Set());
    setModelPresets({});
    setDismissedSelections(new Set());
    onSelectionsChange?.(false);
    onStateChange?.({ selectedSubjects: [], selectedGroups: [], presets: {}, subjectCounts: subjects.map((s) => s.count), selectedModelSubjects: [], modelPresets: {} });
  }, [resetSignal]);

  const handleRescan = () => {
    if (isScanning || isRescanning) return;
    setIsRescanning(true);
    onRescan?.();
    setTimeout(() => setIsRescanning(false), 3000);
  };

  // isModelDetecting piggybacks on the existing scanning indicator so no separate loader is shown
  const scanning = isScanning || isRescanning || !!isModelDetecting;

  const notify = (
    groups: Set<string>,
    subs: Set<number>,
    currentPresets: Record<string, string | null>,
    modelSubs: Set<number>,
    currentModelPresets: Record<string, string | null>,
  ) => {
    const isChanged = (key: string, val: string | null | undefined) =>
      !!val && val !== appliedPresets?.[key];
    const hasValidSelections =
      Object.entries(currentPresets).some(([k, v]) => isChanged(k, v)) ||
      Object.entries(currentModelPresets).some(([k, v]) => isChanged(k, v));
    onSelectionsChange?.(hasValidSelections);
    onStateChange?.({
      selectedSubjects: Array.from(subs),
      selectedGroups: Array.from(groups),
      presets: currentPresets,
      subjectCounts: subjects.map((s) => s.count),
      selectedModelSubjects: Array.from(modelSubs),
      modelPresets: currentModelPresets,
    });
  };

  const undismiss = (key: string) => {
    if (!dismissedSelections.has(key)) return;
    const next = new Set(dismissedSelections);
    next.delete(key);
    setDismissedSelections(next);
  };

  const dismissSelection = (key: string) => {
    const nextDismissed = new Set(dismissedSelections);
    nextDismissed.add(key);
    setDismissedSelections(nextDismissed);

    if (key.startsWith("model-")) {
      const id = parseInt(key.slice("model-".length), 10);
      const nextSubs = new Set(selectedModelSubjects);
      nextSubs.delete(id);
      const nextModelPresets = { ...modelPresets };
      delete nextModelPresets[key];
      setSelectedModelSubjects(nextSubs);
      setModelPresets(nextModelPresets);
      notify(selectedGroups, selectedSubjects, presets, nextSubs, nextModelPresets);
    } else if (key.startsWith("group-")) {
      const label = key.slice("group-".length);
      const nextGroups = new Set(selectedGroups);
      nextGroups.delete(label);
      const nextPresets = { ...presets };
      delete nextPresets[key];
      setSelectedGroups(nextGroups);
      setPresets(nextPresets);
      notify(nextGroups, selectedSubjects, nextPresets, selectedModelSubjects, modelPresets);
    } else if (key.startsWith("subject-")) {
      const i = parseInt(key.slice("subject-".length), 10);
      const nextSubs = new Set(selectedSubjects);
      nextSubs.delete(i);
      const nextPresets = { ...presets };
      delete nextPresets[key];
      setSelectedSubjects(nextSubs);
      setPresets(nextPresets);
      notify(selectedGroups, nextSubs, nextPresets, selectedModelSubjects, modelPresets);
    }
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

    if (isAdding) undismiss(`group-${label}`);
    setSelectedGroups(next);
    notify(next, selectedSubjects, currentPresets, selectedModelSubjects, modelPresets);
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

    if (isAdding) undismiss(`subject-${i}`);
    setSelectedSubjects(next);
    notify(selectedGroups, next, currentPresets, selectedModelSubjects, modelPresets);
  };

  const setPreset = (key: string, value: string) => {
    setPresets((prev) => {
      const next = { ...prev, [key]: value };
      notify(selectedGroups, selectedSubjects, next, selectedModelSubjects, modelPresets);
      return next;
    });
  };

  const toggleModelSubject = (id: number) => {
    const isAdding = !selectedModelSubjects.has(id);
    const next = new Set(selectedModelSubjects);
    if (isAdding) next.add(id); else next.delete(id);

    let currentModelPresets = modelPresets;
    if (isAdding && appliedPresets?.[`model-${id}`] && !modelPresets[`model-${id}`]) {
      currentModelPresets = { ...modelPresets, [`model-${id}`]: appliedPresets[`model-${id}`] };
      setModelPresets(currentModelPresets);
    }

    if (isAdding) undismiss(`model-${id}`);
    setSelectedModelSubjects(next);
    notify(selectedGroups, selectedSubjects, presets, next, currentModelPresets);
  };

  const setModelPreset = (key: string, value: string) => {
    setModelPresets((prev) => {
      const next = { ...prev, [key]: value };
      notify(selectedGroups, selectedSubjects, presets, selectedModelSubjects, next);
      return next;
    });
  };

  const visibleSelectedModelIds = (() => {
    const retouchedExtra = (modelSubjects ?? [])
      .filter((s) => appliedPresets?.[`model-${s.id}`] && !selectedModelSubjects.has(s.id))
      .map((s) => s.id);
    return [...[...Array.from(selectedModelSubjects)].reverse(), ...retouchedExtra]
      .filter((id) => !dismissedSelections.has(`model-${id}`));
  })();

  const visibleSelectedGroups = (() => {
    const retouchedExtra = groups.filter((l) => appliedPresets?.[`group-${l}`] && !selectedGroups.has(l));
    return [...[...Array.from(selectedGroups)].reverse(), ...retouchedExtra]
      .filter((l) => !dismissedSelections.has(`group-${l}`));
  })();

  const visibleSelectedSubjectIndices = (() => {
    const retouchedExtra = subjects
      .map((_, i) => i)
      .filter((i) => appliedPresets?.[`subject-${i}`] && !selectedSubjects.has(i));
    return [...[...Array.from(selectedSubjects)].reverse(), ...retouchedExtra]
      .filter((i) => !dismissedSelections.has(`subject-${i}`));
  })();

  const hasSelections =
    visibleSelectedModelIds.length > 0 ||
    visibleSelectedGroups.length > 0 ||
    visibleSelectedSubjectIndices.length > 0;

  // const [popoverOpen, setPopoverOpen] = useState(false);
  // const [hoveredSubject, setHoveredSubject] = useState<number | null>(null);
  // const popoverRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   const handleClickOutside = (e: MouseEvent) => {
  //     if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
  //       setPopoverOpen(false);
  //     }
  //   };
  //   if (popoverOpen) {
  //     document.addEventListener("mousedown", handleClickOutside);
  //     return () => document.removeEventListener("mousedown", handleClickOutside);
  //   }
  // }, [popoverOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelPopoverRef.current && !modelPopoverRef.current.contains(e.target as Node)) {
        setModelPopoverOpen(false);
      }
    };
    if (modelPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [modelPopoverOpen]);

  // Sort by count descending, then restrict to visible subjects when a filter is active
  // const sortedIndices = subjects
  //   .map((s, i) => ({ i, count: s.count, applied: !!appliedPresets?.[`subject-${i}`] }))
  //   .sort((a, b) => b.count - a.count)
  //   .map(({ i }) => i)
  //   .filter((i) => !visibleSubjectIndices || visibleSubjectIndices.has(i));

  // const TOP_N = 4;
  // const visibleIndices = sortedIndices.slice(0, TOP_N);
  // const hiddenCount = sortedIndices.length - TOP_N;

  const displayedModelSubjects = modelSubjectFilter && modelSubjectFilter.length > 0
    ? (modelSubjects ?? []).filter((s) => modelSubjectFilter.includes(s.id))
    : (modelSubjects ?? []);

  const MODEL_TOP_N = 4;
  const visibleModelSubjects = displayedModelSubjects.slice(0, MODEL_TOP_N);
  const modelHiddenCount = displayedModelSubjects.length - MODEL_TOP_N;

  return (
    <div className={`px-5 flex flex-col gap-3 transition-opacity ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-normal text-[#e2e2e2]">Subject Sync</h3>
            {/* <span className="px-1 py-0.5 text-[11px] font-medium leading-[12px] rounded backdrop-blur-[2px] bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.4)] text-[#e2e2e2]">
              New
            </span> */}
            <span
              className="relative inline-flex"
              onMouseEnter={() => setStarHovered(true)}
              onMouseLeave={() => setStarHovered(false)}
            >
              <Tooltip label="Just Launched" visible={starHovered} />
              <StarFourIcon className="w-4 h-4" weight="fill" color="#EAB308" />
            </span>
            {/* {scanning && (
              <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
            )} */}
          </div>
          {scanning && (
            <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
          )}
          {!scanning && (<button
            onClick={handleRescan}
            disabled={scanning}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${scanning ? "text-[#474747] cursor-not-allowed" : "text-[#777] hover:text-[#e2e2e2] hover:bg-white/5"
              }`}
          >
            <ArrowsClockwiseIcon className="w-4 h-4" />
          </button>
          )}
        </div>
        <p className="text-[12px] text-[#ababab] leading-4">
          Apply presets on subjects identified across the entire album
        </p>
      </div>

      {!isScanning && !isModelDetecting && <div className={`flex flex-col gap-4 transition-opacity ${isRescanning ? "opacity-40 pointer-events-none" : ""}`}>
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

        {/* Subject avatar grid — commented out for model comparison
        <div ref={popoverRef} className="relative">
          ...hardcoded grid...
        </div>
        */}

        {displayedModelSubjects.length > 0 && (
          <div className="flex flex-col gap-3">
            <div ref={modelPopoverRef} className="relative">
              <div className="grid grid-cols-5 gap-2">
                {visibleModelSubjects.map((subject) => {
                  const inList = visibleSelectedModelIds.includes(subject.id);
                  const active = selectedModelSubjects.has(subject.id) || inList;
                  const applied = !!appliedPresets?.[`model-${subject.id}`];
                  const presetLabel = appliedPresets?.[`model-${subject.id}`];
                  return (
                    <div
                      key={subject.id}
                      className="flex flex-col items-center gap-1 relative"
                      onMouseEnter={() => applied && setHoveredModelSubject(subject.id)}
                      onMouseLeave={() => setHoveredModelSubject(null)}
                    >
                      {presetLabel && (
                        <Tooltip label={presetLabel} prefix="Applied:" visible={hoveredModelSubject === subject.id} />
                      )}
                      <button
                        onClick={() => active ? dismissSelection(`model-${subject.id}`) : toggleModelSubject(subject.id)}
                        className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${active ? "border-[#2563eb]" : "border-transparent"}`}
                      >
                        <img
                          src={subject.keyFaceDataUrl}
                          alt={`Person ${subject.id + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {active && (
                        <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#2563eb] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )}
                      {/* {!active && applied && (
                        <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#16a34a] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                      )} */}
                      <span className={`text-[10px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                        {subject.photoCount}
                      </span>
                    </div>
                  );
                })}
                {/* View More — 5th cell when there are hidden model subjects */}
                {modelHiddenCount > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => setModelPopoverOpen((v) => !v)}
                      className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors ${modelPopoverOpen ? "bg-white/20 text-[#e2e2e2]" : "bg-white/10 text-[#777] hover:bg-white/20 hover:text-[#ababab]"}`}
                    >
                      <span className="text-[12px] font-medium leading-none">+{modelHiddenCount}</span>
                    </button>
                    <span className="text-[10px] font-medium text-[#777]"> </span>
                  </div>
                )}
              </div>

              {/* Model View More popover */}
              {modelPopoverOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 bg-[#242424] border border-[#474747] rounded-lg p-3 flex flex-col gap-3 max-h-[230px] overflow-y-auto" >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#777]">All Subjects</span>
                  <div className="grid grid-cols-5 gap-2">
                    {displayedModelSubjects.map((subject) => {
                      const inList = visibleSelectedModelIds.includes(subject.id);
                      const active = selectedModelSubjects.has(subject.id) || inList;
                      const applied = !!appliedPresets?.[`model-${subject.id}`];
                      const presetLabel = appliedPresets?.[`model-${subject.id}`];
                      return (
                        <div
                          key={subject.id}
                          className="flex flex-col items-center gap-1 relative"
                          onMouseEnter={() => applied && setHoveredModelSubject(subject.id)}
                          onMouseLeave={() => setHoveredModelSubject(null)}
                        >
                          {presetLabel && (
                            <div
                              className={`absolute bottom-[calc(100%-10px)] left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-150 ${hoveredModelSubject === subject.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}
                              style={hoveredModelSubject === subject.id ? { transitionDelay: "300ms" } : { transitionDelay: "0ms" }}
                            >
                              <span className="whitespace-nowrap px-[6px] py-[4px] text-[11px] font-medium text-[#474747] bg-[#f6f6f6] rounded-[4px]">
                                {presetLabel}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={() => active ? dismissSelection(`model-${subject.id}`) : toggleModelSubject(subject.id)}
                            className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${active ? "border-[#2563eb]" : "border-transparent hover:border-[#5e5e5e]"}`}
                          >
                            <img
                              src={subject.keyFaceDataUrl}
                              alt={`Person ${subject.id + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          {active && (
                            <div className="absolute bottom-[14px] right-0 w-4 h-4 rounded-full bg-[#2563eb] flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                            </div>
                          )}
                          <span className={`text-[10px] font-medium ${active ? "text-[#e2e2e2]" : "text-[#777]"}`}>
                            {subject.photoCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Subjects section — newest selection at top, scrollable after 5 */}
        {hasSelections && (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] text-[#ababab] leading-4">Selected Subjects</span>
            {/* Portal-rendered dropdown escapes overflow, so scrolling doesn't clip menus */}
            <div className="flex flex-col gap-2 max-h-[272px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {[
                ...visibleSelectedModelIds.map((id) => {
                  const subject = modelSubjects?.find((s) => s.id === id);
                  if (!subject) return null;
                  const key = `model-${id}`;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <SelectionThumbnail
                        retouched={!!appliedPresets?.[key]}
                        onRemove={() => dismissSelection(key)}
                        ariaLabel={`Remove Person ${id + 1}`}
                      >
                        <img src={subject.keyFaceDataUrl} alt={`Person ${id + 1}`} className="w-full h-full object-cover" />
                      </SelectionThumbnail>
                      <PresetDropdown
                        value={modelPresets[key] ?? appliedPresets?.[key] ?? null}
                        genderFilter={subject.category}
                        onChange={(v) => setModelPreset(key, v)}
                      />
                    </div>
                  );
                }),
                ...visibleSelectedGroups.map((label) => {
                  const key = `group-${label}`;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <SelectionThumbnail
                        retouched={!!appliedPresets?.[key]}
                        onRemove={() => dismissSelection(key)}
                        ariaLabel={`Remove ${label}`}
                      >
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                          <span className="text-white text-[20px] font-medium">{groupInitial[label]}</span>
                        </div>
                      </SelectionThumbnail>
                      <PresetDropdown
                        value={presets[key] ?? appliedPresets?.[key] ?? null}
                        genderFilter={label}
                        onChange={(v) => setPreset(key, v)}
                      />
                    </div>
                  );
                }),
                ...visibleSelectedSubjectIndices.map((i) => {
                  const key = `subject-${i}`;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <SelectionThumbnail
                        retouched={!!appliedPresets?.[key]}
                        onRemove={() => dismissSelection(key)}
                        ariaLabel={`Remove Subject ${i + 1}`}
                      >
                        <img src={subjects[i].avatar} alt={`Subject ${i + 1}`} className="w-full h-full object-cover" />
                      </SelectionThumbnail>
                      <PresetDropdown
                        value={presets[key] ?? appliedPresets?.[key] ?? null}
                        genderFilter={subjectGender[i]}
                        onChange={(v) => setPreset(key, v)}
                      />
                    </div>
                  );
                }),
              ].filter(Boolean)}
            </div>
          </div>
        )}
      </div>}
    </div>
  );
};

export default SubjectSync;
