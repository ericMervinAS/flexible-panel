import { useState, useEffect, useRef } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import { Warning } from "@phosphor-icons/react";
import PinnedSlidersCard from "../../PinnedSlidersCard";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import PresetDropdown from "../../PresetDropdown";
import SliderRow from "../../SliderRow";
import SliderSection from "../../SliderSection";
import { getSubjectIndices, subjectGender } from "@/data/subjectMapping";
import { SECTIONS, findPreset, presetToSectionValues } from "@/data/presetMapping";
import type { ModelSubject } from "@/hooks/useFaceDetection";
import type { SubjectCategory } from "@/lib/faceDetection";

// ─── Data ──────────────────────────────────────────────────────────────────────

const chips = ["All Subjects", "Masculine", "Feminine", "Elderly", "Child", "Individual"];

const subjectModules = import.meta.glob("../../../assets/subjects/*.png", {
  eager: true,
}) as Record<string, { default: string }>;

const subjects = Object.entries(subjectModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, mod]) => ({ avatar: mod.default }));

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LoupeRetouchState {
  sliderLayers: Record<string, (number | null)[][]>;
  localPresets: Record<string, string | null>;
  customized: Set<string>;
}

interface SubjectTabProps {
  onScrollChange?: (atBottom: boolean) => void;
  currentImageIndex?: number;
  syncedPresets?: Record<string, string>;
  onStateChange?: (state: LoupeRetouchState) => void;
  pasteSignal?: { state: LoupeRetouchState; seq: number } | null;
  loupeResetSignal?: number;
  modelSubjects?: ModelSubject[];
  /** Maps imageIndex → array of cluster ids that appear in that image */
  modelImageMap?: Map<number, number[]>;
  isModelDetecting?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const SubjectTab = ({
  onScrollChange,
  currentImageIndex = 0,
  syncedPresets = {},
  onStateChange,
  pasteSignal,
  loupeResetSignal,
  modelSubjects,
  modelImageMap,
  isModelDetecting,
}: SubjectTabProps) => {
  const [selectedChip, setSelectedChip] = useState<string | null>("All Subjects");
  const [selectedFaces, setSelectedFaces] = useState<Set<number>>(new Set());
  const [selectedModelFace, setSelectedModelFace] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Overrides set directly in Loupe.
  // string  = preset explicitly applied at this level
  // null    = bypassed by cascade — skip this level, fall through to next
  // missing = not touched in loupe, check syncedPresets then fall through
  const [localPresets, setLocalPresets] = useState<Record<string, string | null>>({});

  // Tracks contexts where a slider was manually moved. These stop inheritance
  // entirely and show no preset — separate from the cascade bypass above.
  const [customized, setCustomized] = useState<Set<string>>(new Set());
  const [presetStrength, setPresetStrength] = useState(100);
  const [pinnedSliders, setPinnedSliders] = useSessionState<Set<string>>(
    "subjectTab:pinnedSliders",
    new Set(),
    {
      serialize: (s) => [...s],
      deserialize: (a) => new Set(a as string[]),
    }
  );
  const [sectionOrder, setSectionOrder] = useState<number[]>(() => SECTIONS.map((_, i) => i));
  const scrollRef = useRef<HTMLDivElement>(null);
  const presetRowRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const togglePin = (sIdx: number, sliderIdx: number) => {
    const key = `${sIdx}:${sliderIdx}`;
    setPinnedSliders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionOrder((prev) => {
      const oldIdx = prev.indexOf(Number(active.id));
      const newIdx = prev.indexOf(Number(over.id));
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const checkBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 2;
    onScrollChange?.(atBottom);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(checkBottom);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    checkBottom();
    return () => observer.disconnect();
  }, [onScrollChange]);

  // ── Slider layers ─────────────────────────────────────────────────────────────
  // One layer per context key. null cell = inherit from parent. missing key = all inherit.
  // Hierarchy mirrors presets: subject-N > group-{gender} > group-All Subjects
  const [sliderLayers, setSliderLayers] = useState<Record<string, (number | null)[][]>>({});

  // Blank layer (all nulls) — used to reset a context to full inheritance
  const nullLayer = () => SECTIONS.map((s) => s.sliders.map(() => null as number | null));

  const rawIndices = getSubjectIndices(currentImageIndex);
  const visibleSubjects =
    rawIndices !== null
      ? rawIndices
          .filter((i) => i < subjects.length)
          .map((i) => ({ ...subjects[i], subjectIndex: i }))
      : subjects.map((s, i) => ({ ...s, subjectIndex: i }));

  const modelClusterIds = modelImageMap?.get(currentImageIndex) ?? [];

  // Gender groups present — prefer model-detected categories over hardcoded mapping
  const activeGenders: Set<string> =
    modelSubjects?.length && modelImageMap
      ? new Set(
          modelClusterIds
            .map((cid) => modelSubjects.find((s) => s.id === cid)?.category)
            .filter((c): c is SubjectCategory => !!c)
        )
      : new Set(
          (rawIndices ?? subjects.map((_, i) => i)).map((i) => subjectGender[i]).filter(Boolean)
        );

  const isChipEnabled = (chip: string) => {
    if (chip === "All Subjects") return true;
    if (chip === "Individual")
      return modelSubjects?.length && modelImageMap ? modelClusterIds.length > 0 : true;
    return activeGenders.has(chip as any);
  };

  // ── Preset hierarchy helpers ──────────────────────────────────────────────────
  // Hierarchy: subject-N > group-{gender} > group-All Subjects
  //
  // pick() return values:
  //   "__stop__" → slider was moved here — stop inheritance, show no preset
  //   string     → preset explicitly set at this level
  //   undefined  → localPresets[key] is null (cascade bypass) OR key not set — fall through
  const STOP = "__stop__";

  const pick = (key: string): string | undefined => {
    if (customized.has(key)) return STOP;
    if (key in localPresets) {
      const val = localPresets[key];
      return val === null ? undefined : val;
    }
    return syncedPresets[key];
  };

  const resolvePreset = (chip: string, faceIndex?: number): string | null => {
    // Model face: model-specific → category group (Feminine/Masculine/etc.) → All Subjects
    if (selectedModelFace !== null) {
      const v = pick(`model-${selectedModelFace}`);
      if (v === STOP) return null;
      if (v !== undefined) return v;
      const category = modelSubjects?.find((s) => s.id === selectedModelFace)?.category;
      if (category) {
        const v2 = pick(`group-${category}`);
        if (v2 === STOP) return null;
        if (v2 !== undefined) return v2;
      }
      const v3 = pick("group-All Subjects");
      if (v3 === STOP) return null;
      return v3 ?? null;
    }
    if (chip === "Individual" && faceIndex !== undefined) {
      const v1 = pick(`subject-${faceIndex}`);
      if (v1 === STOP) return null;
      if (v1 !== undefined) return v1;
      const v2 = pick(`group-${subjectGender[faceIndex]}`);
      if (v2 === STOP) return null;
      if (v2 !== undefined) return v2;
      const v3 = pick("group-All Subjects");
      if (v3 === STOP) return null;
      return v3 ?? null;
    }
    if (chip === "All Subjects") {
      const v = pick("group-All Subjects");
      if (v === STOP) return null;
      return v ?? null;
    }
    // Gender chip
    const v1 = pick(`group-${chip}`);
    if (v1 === STOP) return null;
    if (v1 !== undefined) return v1;
    const v2 = pick("group-All Subjects");
    if (v2 === STOP) return null;
    return v2 ?? null;
  };

  const setPresetForChip = (chip: string, value: string, faceIndex?: number) => {
    const preset = findPreset(value);
    const presetSliders = preset ? presetToSectionValues(preset) : nullLayer();

    if (chip === "All Subjects") {
      if (!preset || preset.tags.includes("All Subjects")) {
        const next: Record<string, string | null> = { "group-All Subjects": value };
        ["Masculine", "Feminine", "Elderly", "Child"].forEach((g) => {
          next[`group-${g}`] = null;
        });
        subjects.forEach((_, i) => {
          next[`subject-${i}`] = null;
        });
        setLocalPresets(next);
        setCustomized(new Set());
        setSliderLayers(() => {
          const layers: Record<string, (number | null)[][]> = {
            "group-All Subjects": presetSliders,
          };
          ["Masculine", "Feminine", "Elderly", "Child"].forEach((g) => {
            layers[`group-${g}`] = nullLayer();
          });
          subjects.forEach((_, i) => {
            layers[`subject-${i}`] = nullLayer();
          });
          return layers;
        });
      } else {
        const imageIndices = rawIndices ?? subjects.map((_, i) => i);
        const matchingGenders = (preset.tags as string[]).filter((g) =>
          imageIndices.some((i) => subjectGender[i] === g)
        );

        if (matchingGenders.length === 0) {
          setToast("Unable to apply preset — no matching subjects in this image");
          return;
        }

        setLocalPresets((prev) => {
          const next = { ...prev };
          matchingGenders.forEach((g) => {
            next[`group-${g}`] = value;
            subjects.forEach((_, i) => {
              if (subjectGender[i] === g) next[`subject-${i}`] = null;
            });
          });
          return next;
        });
        setCustomized((prev) => {
          const s = new Set(prev);
          matchingGenders.forEach((g) => {
            s.delete(`group-${g}`);
            subjects.forEach((_, i) => {
              if (subjectGender[i] === g) s.delete(`subject-${i}`);
            });
          });
          return s;
        });
        setSliderLayers((prev) => {
          const next = { ...prev };
          matchingGenders.forEach((g) => {
            next[`group-${g}`] = presetSliders;
            subjects.forEach((_, i) => {
              if (subjectGender[i] === g) next[`subject-${i}`] = nullLayer();
            });
          });
          return next;
        });

        const firstChip = chips.find((c) => matchingGenders.includes(c));
        if (firstChip) setSelectedChip(firstChip);
      }
    } else if (chip === "Individual" && faceIndex !== undefined) {
      setLocalPresets((prev) => ({ ...prev, [`subject-${faceIndex}`]: value }));
      setCustomized((prev) => {
        const s = new Set(prev);
        s.delete(`subject-${faceIndex}`);
        return s;
      });
      setSliderLayers((prev) => ({ ...prev, [`subject-${faceIndex}`]: presetSliders }));
    } else {
      setLocalPresets((prev) => {
        const next: Record<string, string | null> = { ...prev, [`group-${chip}`]: value };
        subjects.forEach((_, i) => {
          if (subjectGender[i] === chip) next[`subject-${i}`] = null;
        });
        return next;
      });
      setCustomized((prev) => {
        const s = new Set(prev);
        s.delete(`group-${chip}`);
        subjects.forEach((_, i) => {
          if (subjectGender[i] === chip) s.delete(`subject-${i}`);
        });
        return s;
      });
      setSliderLayers((prev) => {
        const next = { ...prev, [`group-${chip}`]: presetSliders };
        subjects.forEach((_, i) => {
          if (subjectGender[i] === chip) next[`subject-${i}`] = nullLayer();
        });
        return next;
      });
    }
  };

  const singleFace = selectedFaces.size === 1 ? Array.from(selectedFaces)[0] : undefined;
  const effectivePreset =
    selectedModelFace !== null
      ? resolvePreset("Individual", undefined)
      : selectedChip
        ? resolvePreset(selectedChip, singleFace)
        : null;

  const currentContextKey =
    selectedModelFace !== null
      ? `model-${selectedModelFace}`
      : selectedChip === "Individual" && singleFace !== undefined
        ? `subject-${singleFace}`
        : `group-${selectedChip ?? "All Subjects"}`;

  const resolveSliderValue = (sIdx: number, sliderIdx: number): number => {
    if (selectedModelFace !== null) {
      const val = sliderLayers[`model-${selectedModelFace}`]?.[sIdx]?.[sliderIdx];
      if (val !== null && val !== undefined) return val;
      const category = modelSubjects?.find((s) => s.id === selectedModelFace)?.category;
      if (category) {
        const v2 = sliderLayers[`group-${category}`]?.[sIdx]?.[sliderIdx];
        if (v2 !== null && v2 !== undefined) return v2;
      }
      const v3 = sliderLayers["group-All Subjects"]?.[sIdx]?.[sliderIdx];
      return v3 !== null && v3 !== undefined ? v3 : 0;
    }
    const keys: string[] = [];
    if (selectedChip === "Individual" && singleFace !== undefined) {
      keys.push(`subject-${singleFace}`);
      keys.push(`group-${subjectGender[singleFace]}`);
    } else if (selectedChip) {
      keys.push(`group-${selectedChip}`);
    }
    keys.push("group-All Subjects");

    for (const key of keys) {
      const val = sliderLayers[key]?.[sIdx]?.[sliderIdx];
      if (val !== null && val !== undefined) return val;
    }
    return 0;
  };

  const effectiveSectionValues = SECTIONS.map((_, sIdx) =>
    SECTIONS[sIdx].sliders.map((_, sliderIdx) => resolveSliderValue(sIdx, sliderIdx))
  );

  const setSlider = (sIdx: number, sliderIdx: number, v: number) => {
    setSliderLayers((prev) => {
      const layer = (prev[currentContextKey] ?? nullLayer()).map((row) => [...row]);
      layer[sIdx][sliderIdx] = v;
      return { ...prev, [currentContextKey]: layer };
    });
    setCustomized((prev) => new Set([...prev, currentContextKey]));
    setLocalPresets((prev) => {
      const next = { ...prev };
      delete next[currentContextKey];
      return next;
    });
  };

  const resetSection = (sIdx: number) => {
    setSliderLayers((prev) => {
      const layer = (prev[currentContextKey] ?? nullLayer()).map((row) => [...row]);
      layer[sIdx] = SECTIONS[sIdx].sliders.map(() => null);
      return { ...prev, [currentContextKey]: layer };
    });
    setCustomized((prev) => new Set([...prev, currentContextKey]));
    setLocalPresets((prev) => {
      const next = { ...prev };
      delete next[currentContextKey];
      return next;
    });
  };

  useEffect(() => {
    setSelectedFaces(new Set());
    setSelectedModelFace(null);
    setSliderLayers({});
    setLocalPresets({});
    setCustomized(new Set());
  }, [currentImageIndex]);

  useEffect(() => {
    onStateChange?.({ sliderLayers, localPresets, customized });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderLayers, localPresets, customized]);

  useEffect(() => {
    if (!pasteSignal) return;
    setSliderLayers(pasteSignal.state.sliderLayers);
    setLocalPresets(pasteSignal.state.localPresets);
    setCustomized(new Set(pasteSignal.state.customized));
  }, [pasteSignal?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loupeResetSignal) return;
    setSliderLayers({});
    setLocalPresets({});
    setCustomized(new Set());
    setSelectedModelFace(null);
  }, [loupeResetSignal]);

  const toggleFace = (i: number) => {
    setSelectedModelFace(null);
    setSelectedFaces((prev) => {
      if (prev.has(i) && prev.size === 1) return prev;
      return new Set([i]);
    });
  };

  const toggleModelFace = (clusterId: number) => {
    setSelectedFaces(new Set());
    setSelectedModelFace((prev) => (prev === clusterId ? null : clusterId));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* ── Fixed section: chips + face grid + Preset accordion ── */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4 shrink-0">
        {/* Chips */}
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">
          {chips.map((label) => {
            const enabled = isChipEnabled(label);
            const selected = selectedChip === label;
            return (
              <button
                key={label}
                disabled={!enabled}
                onClick={() => {
                  if (!enabled || selected) return;
                  setSelectedChip(label);
                  if (label === "Individual") {
                    if (modelClusterIds.length > 0) {
                      setSelectedModelFace(modelClusterIds[0]);
                      setSelectedFaces(new Set());
                    } else if (visibleSubjects.length > 0) {
                      setSelectedFaces(new Set([visibleSubjects[0].subjectIndex]));
                    }
                  }
                }}
                className={`h-6 px-2 text-[13px] leading-4 rounded border transition-colors ${
                  !enabled
                    ? "border-transparent bg-[#242424] text-[#474747] cursor-not-allowed"
                    : selected
                      ? "border-[#777] bg-[#242424] text-[#e2e2e2]"
                      : "border-transparent bg-[#242424] text-[#ababab] hover:text-[#e2e2e2]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/*
        {selectedChip === "Individual" && (
          <div className="grid grid-cols-5 gap-2">
            ...hardcoded grid...
          </div>
        )}
        */}

        {selectedChip === "Individual" && isModelDetecting && (
          <div className="flex items-center justify-center py-4">
            <div className="w-4 h-4 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
          </div>
        )}

        {selectedChip === "Individual" &&
          !isModelDetecting &&
          (() => {
            if (!modelClusterIds.length || !modelSubjects?.length) return null;
            return (
              <div className="grid grid-cols-5 gap-2">
                {modelClusterIds.map((cid) => {
                  const subject = modelSubjects.find((s) => s.id === cid);
                  if (!subject) return null;
                  const isSelected = selectedModelFace === cid;
                  return (
                    <div key={cid} className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => toggleModelFace(cid)}
                        className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${isSelected ? "border-white" : "border-[#47474700] hover:border-[#5e5e5e]"}`}
                      >
                        <img
                          src={subject.keyFaceDataUrl}
                          alt={`Person ${cid + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        {/* Preset section */}
        <div className="flex flex-col gap-3 my-2">
          <div ref={presetRowRef} className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#ababab] leading-3">
              Preset
            </span>
            <PresetDropdown
              compact
              anchorRef={presetRowRef}
              value={effectivePreset}
              genderFilter={
                selectedModelFace !== null
                  ? modelSubjects?.find((s) => s.id === selectedModelFace)?.category
                  : !selectedChip
                    ? undefined
                    : selectedChip === "Individual"
                      ? singleFace !== undefined
                        ? subjectGender[singleFace]
                        : undefined
                      : selectedChip
              }
              onChange={(v) => {
                if (selectedModelFace !== null) {
                  const preset = findPreset(v);
                  const presetSliders = preset ? presetToSectionValues(preset) : nullLayer();
                  setLocalPresets((prev) => ({ ...prev, [`model-${selectedModelFace}`]: v }));
                  setCustomized((prev) => {
                    const s = new Set(prev);
                    s.delete(`model-${selectedModelFace}`);
                    return s;
                  });
                  setSliderLayers((prev) => ({
                    ...prev,
                    [`model-${selectedModelFace}`]: presetSliders,
                  }));
                } else {
                  if (!selectedChip) return;
                  setPresetForChip(selectedChip, v, singleFace);
                }
              }}
            />
          </div>
          {effectivePreset && (
            <SliderRow
              label="Strength"
              value={presetStrength}
              onChange={setPresetStrength}
              noPinArea
            />
          )}
        </div>

        <div className="h-[1px] mt-[-8px] w-full bg-[#e2e2e20d]" />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 pl-2 pr-2.5 py-2.5 bg-[#fafafa] rounded shadow-lg whitespace-nowrap">
          <Warning className="w-5 h-5 shrink-0 text-[#dc2626]" />
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-medium text-[#474747] leading-4">{toast}</span>
          </div>
        </div>
      )}

      {/* ── Scrollable section: section cards + pinned card ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 pb-2 flex flex-col gap-4"
        style={{ scrollbarWidth: "none" }}
        onScroll={checkBottom}
      >
        {/* Sortable section groups */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={sectionOrder.map(String)} strategy={verticalListSortingStrategy}>
            {sectionOrder.map((sIdx) => {
              const section = SECTIONS[sIdx];
              return (
                <SliderSection
                  key={sIdx}
                  id={String(sIdx)}
                  sectionIdx={sIdx}
                  title={section.title}
                  sliders={section.sliders}
                  values={effectiveSectionValues[sIdx]}
                  onSliderChange={(sliderIdx, v) => setSlider(sIdx, sliderIdx, v)}
                  onReset={() => resetSection(sIdx)}
                  pinnedSliders={pinnedSliders}
                  onTogglePin={(sliderIdx) => togglePin(sIdx, sliderIdx)}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* Pinned card — at bottom */}
        <PinnedSlidersCard
          pinnedSliders={pinnedSliders}
          onTogglePin={togglePin}
          getValue={(sIdx, sliderIdx) => effectiveSectionValues[sIdx][sliderIdx]}
          onChange={(sIdx, sliderIdx, v) => setSlider(sIdx, sliderIdx, v)}
        />
      </div>
    </div>
  );
};

export default SubjectTab;
