import { useState, useEffect, useRef } from "react";
import { PlusCircle, Warning } from "@phosphor-icons/react";
import Accordion from "./Accordion";
import PresetDropdown from "./PresetDropdown";
import { getSubjectIndices, subjectGender } from "@/data/subjectMapping";
import { SECTIONS, findPreset, presetToSectionValues } from "@/data/presetMapping";

// ─── Data ──────────────────────────────────────────────────────────────────────

const chips = ["All Subjects", "Masculine", "Feminine", "Elderly", "Child", "Individual"];

const subjectModules = import.meta.glob(
  "../assets/subjects/*.png",
  { eager: true }
) as Record<string, { default: string }>;

const subjects = Object.entries(subjectModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, mod]) => ({ avatar: mod.default }));

// ─── Slider row ────────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

const SliderRow = ({ label, value, min = 0, max = 100, onChange }: SliderRowProps) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center">
      <span className="w-[106px] text-[12px] font-medium text-[#777] shrink-0 truncate">
        {label}
      </span>
      <div className="flex-1 relative h-3 flex items-center">
        <div className="w-full h-1 bg-[#474747] rounded-full relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#777]"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Thumb */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{ left: `calc(${pct}% - 4px)` }}
        >
          <div className="bg-[#1c1c1c] rounded-full p-[2px]">
            <div className="w-[2px] h-3 bg-[#474747] rounded-full" />
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="w-[44px] text-[12px] font-medium text-[#777] text-right shrink-0">
        {value}
      </span>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export interface LoupeRetouchState {
  sliderLayers: Record<string, (number | null)[][]>;
  localPresets: Record<string, string | null>;
  customized: Set<string>;
}

interface LoupeSubjectPanelProps {
  onScrollChange?: (atBottom: boolean) => void;
  currentImageIndex?: number;
  syncedPresets?: Record<string, string>;
  onStateChange?: (state: LoupeRetouchState) => void;
  pasteSignal?: { state: LoupeRetouchState; seq: number } | null;
  loupeResetSignal?: number;
}

const LoupeSubjectPanel = ({ onScrollChange, currentImageIndex = 0, syncedPresets = {}, onStateChange, pasteSignal, loupeResetSignal }: LoupeSubjectPanelProps) => {
  const [selectedChip, setSelectedChip] = useState<string | null>("All Subjects");
  const [selectedFaces, setSelectedFaces] = useState<Set<number>>(new Set());
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check if content fits without scrolling (or is scrolled to bottom)
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
    // Also observe the inner content for accordion open/close changes
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
  const visibleSubjects = rawIndices !== null
    ? rawIndices.filter((i) => i < subjects.length).map((i) => ({ ...subjects[i], subjectIndex: i }))
    : subjects.map((s, i) => ({ ...s, subjectIndex: i }));

  // Gender groups present among subjects in this image
  const activeGenders = new Set(
    (rawIndices ?? subjects.map((_, i) => i))
      .map((i) => subjectGender[i])
      .filter(Boolean)
  );

  const isChipEnabled = (chip: string) =>
    chip === "All Subjects" || chip === "Individual" || activeGenders.has(chip as any);

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
      return val === null ? undefined : val; // null = cascade bypass, fall through
    }
    return syncedPresets[key];
  };

  const resolvePreset = (chip: string, faceIndex?: number): string | null => {
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
        // Preset is compatible with All Subjects — apply at that level and cascade down
        const next: Record<string, string | null> = { "group-All Subjects": value };
        ["Masculine", "Feminine", "Elderly", "Child"].forEach((g) => { next[`group-${g}`] = null; });
        subjects.forEach((_, i) => { next[`subject-${i}`] = null; });
        setLocalPresets(next);
        setCustomized(new Set());
        setSliderLayers(() => {
          const layers: Record<string, (number | null)[][]> = { "group-All Subjects": presetSliders };
          ["Masculine", "Feminine", "Elderly", "Child"].forEach((g) => { layers[`group-${g}`] = nullLayer(); });
          subjects.forEach((_, i) => { layers[`subject-${i}`] = nullLayer(); });
          return layers;
        });
      } else {
        // Preset targets specific genders — route it down to only those gender groups
        const imageIndices = rawIndices ?? subjects.map((_, i) => i);
        const matchingGenders = (preset.tags as string[]).filter((g) =>
          imageIndices.some((i) => subjectGender[i] === g)
        );

        if (matchingGenders.length === 0) {
          setToast("Unable to apply preset — no matching subjects in this image");
          return;
        }

        // Apply to each matching gender group (same as if the user selected each group chip individually)
        setLocalPresets((prev) => {
          const next = { ...prev };
          matchingGenders.forEach((g) => {
            next[`group-${g}`] = value;
            subjects.forEach((_, i) => { if (subjectGender[i] === g) next[`subject-${i}`] = null; });
          });
          return next;
        });
        setCustomized((prev) => {
          const s = new Set(prev);
          matchingGenders.forEach((g) => {
            s.delete(`group-${g}`);
            subjects.forEach((_, i) => { if (subjectGender[i] === g) s.delete(`subject-${i}`); });
          });
          return s;
        });
        setSliderLayers((prev) => {
          const next = { ...prev };
          matchingGenders.forEach((g) => {
            next[`group-${g}`] = presetSliders;
            subjects.forEach((_, i) => { if (subjectGender[i] === g) next[`subject-${i}`] = nullLayer(); });
          });
          return next;
        });

        // Automatically switch to the first affected gender chip so the user
        // can immediately see what was applied
        const firstChip = chips.find((c) => matchingGenders.includes(c));
        if (firstChip) setSelectedChip(firstChip);
      }
    } else if (chip === "Individual" && faceIndex !== undefined) {
      setLocalPresets((prev) => ({ ...prev, [`subject-${faceIndex}`]: value }));
      setCustomized((prev) => { const s = new Set(prev); s.delete(`subject-${faceIndex}`); return s; });
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
        subjects.forEach((_, i) => { if (subjectGender[i] === chip) s.delete(`subject-${i}`); });
        return s;
      });
      // Load preset into this gender's layer; reset subject layers so they inherit
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
  const effectivePreset = selectedChip ? resolvePreset(selectedChip, singleFace) : null;

  // The context key for the currently active chip + face selection
  const currentContextKey =
    selectedChip === "Individual" && singleFace !== undefined
      ? `subject-${singleFace}`
      : `group-${selectedChip ?? "All Subjects"}`;

  // Walk up the hierarchy to resolve the effective slider value for the current context
  const resolveSliderValue = (sIdx: number, sliderIdx: number): number => {
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
    (SECTIONS[sIdx].sliders as readonly string[]).map((_, sliderIdx) =>
      resolveSliderValue(sIdx, sliderIdx)
    )
  );

  const setSlider = (sIdx: number, sliderIdx: number, v: number) => {
    setSliderLayers((prev) => {
      const layer = (prev[currentContextKey] ?? nullLayer()).map((row) => [...row]);
      layer[sIdx][sliderIdx] = v;
      return { ...prev, [currentContextKey]: layer };
    });
    // Mark this context as customized — breaks preset link, shows no preset
    setCustomized((prev) => new Set([...prev, currentContextKey]));
    setLocalPresets((prev) => { const next = { ...prev }; delete next[currentContextKey]; return next; });
  };

  const resetSection = (sIdx: number) => {
    setSliderLayers((prev) => {
      const layer = (prev[currentContextKey] ?? nullLayer()).map((row) => [...row]);
      layer[sIdx] = SECTIONS[sIdx].sliders.map(() => null); // null = inherit from parent
      return { ...prev, [currentContextKey]: layer };
    });
    // Resetting a section is a manual change — break the preset link the same way a slider move does
    setCustomized((prev) => new Set([...prev, currentContextKey]));
    setLocalPresets((prev) => { const next = { ...prev }; delete next[currentContextKey]; return next; });
  };

  useEffect(() => {
    setSelectedFaces(new Set());
    setSliderLayers({});
    setLocalPresets({});
    setCustomized(new Set());
  }, [currentImageIndex]);

  // Report state changes to parent
  useEffect(() => {
    onStateChange?.({ sliderLayers, localPresets, customized });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliderLayers, localPresets, customized]);

  // Apply paste signal
  useEffect(() => {
    if (!pasteSignal) return;
    setSliderLayers(pasteSignal.state.sliderLayers);
    setLocalPresets(pasteSignal.state.localPresets);
    setCustomized(new Set(pasteSignal.state.customized));
  }, [pasteSignal?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply reset signal
  useEffect(() => {
    if (!loupeResetSignal) return;
    setSliderLayers({});
    setLocalPresets({});
    setCustomized(new Set());
  }, [loupeResetSignal]);

  const toggleFace = (i: number) => {
    setSelectedFaces((prev) => {
      // Always keep at least one face selected — clicking the active face is a no-op
      if (prev.has(i) && prev.size === 1) return prev;
      return new Set([i]);
    });
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
                  if (label === "Individual" && visibleSubjects.length > 0) {
                    setSelectedFaces(new Set([visibleSubjects[0].subjectIndex]));
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

        {/* Face grid — only when Individual is selected */}
        {selectedChip === "Individual" && (
          <div className="grid grid-cols-5 gap-2">
            {visibleSubjects.map((s) => (
              <div key={s.subjectIndex} className="flex items-center justify-center">
                <button
                  onClick={() => toggleFace(s.subjectIndex)}
                  className={`w-14 h-14 rounded-full overflow-hidden border-[1.5px] transition-colors ${
                    selectedFaces.has(s.subjectIndex) ? "border-white" : "border-transparent hover:border-[#5e5e5e]"
                  }`}
                >
                  <img src={s.avatar} alt={`Subject ${s.subjectIndex + 1}`} className="w-full h-full object-cover" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Preset accordion */}
        <Accordion
          title="Preset"
          actions={
            <button className="flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors">
              <PlusCircle size={16} />
            </button>
          }
        >
          <PresetDropdown
            value={effectivePreset}
            genderFilter={
              !selectedChip
                ? undefined
                : selectedChip === "Individual"
                  ? (singleFace !== undefined ? subjectGender[singleFace] : undefined)
                  : selectedChip  // "All Subjects" passes through as-is
            }
            onChange={(v) => {
              if (!selectedChip) return;
              setPresetForChip(selectedChip, v, singleFace);
            }}
          />
        </Accordion>
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

      {/* ── Scrollable section: slider accordions ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 pb-2 flex flex-col gap-4"
        style={{ scrollbarWidth: "none" }}
        onScroll={checkBottom}
      >
        {SECTIONS.map((section, sIdx) => (
          <Accordion
            key={section.title}
            title={section.title}
            onEdit={() => {}}
            onReset={() => resetSection(sIdx)}
          >
            {section.sliders.map((label, sliderIdx) => (
              <SliderRow
                key={label}
                label={label}
                value={effectiveSectionValues[sIdx][sliderIdx]}
                onChange={(v) => setSlider(sIdx, sliderIdx, v)}
              />
            ))}
          </Accordion>
        ))}
      </div>
    </div>
  );
};

export default LoupeSubjectPanel;
