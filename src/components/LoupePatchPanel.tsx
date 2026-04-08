import { useRef, useState } from "react";
import Accordion from "./Accordion";

// ─── Shared slider row (mirrors LoupeSubjectPanel) ────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

const TOOL_MODES = [
  { id: "heal",  label: "Heal" },
  { id: "clone", label: "Clone" },
  { id: "patch", label: "Patch" },
] as const;

type ToolMode = typeof TOOL_MODES[number]["id"];

const TOOL_DESCRIPTIONS: Record<ToolMode, string> = {
  heal:  "Blends the sampled area with the surrounding texture, colour and luminance.",
  clone: "Stamps an exact copy of the sampled area onto the target region.",
  patch: "Replaces the selected area with pixels sourced from another part of the image.",
};

// ─── Main component ───────────────────────────────────────────────────────────

interface LoupePatchPanelProps {
  onScrollChange?: (atBottom: boolean) => void;
}

const LoupePatchPanel = ({ onScrollChange }: LoupePatchPanelProps) => {
  const [toolMode, setToolMode] = useState<ToolMode>("heal");
  const [brushSize, setBrushSize]   = useState(40);
  const [feather, setFeather]       = useState(15);
  const [opacity, setOpacity]       = useState(100);
  const [strength, setStrength]     = useState(75);

  const scrollRef = useRef<HTMLDivElement>(null);

  const checkBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    onScrollChange?.(el.scrollHeight - el.scrollTop <= el.clientHeight + 2);
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}
      onScroll={checkBottom}
    >
      {/* Tool mode chips */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {TOOL_MODES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setToolMode(id)}
              className={`h-6 px-2 text-[13px] leading-4 rounded border transition-colors ${
                toolMode === id
                  ? "border-[#777] bg-[#242424] text-[#e2e2e2]"
                  : "border-transparent bg-[#242424] text-[#ababab] hover:text-[#e2e2e2]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-[#777] leading-[18px]">
          {TOOL_DESCRIPTIONS[toolMode]}
        </p>
      </div>

      {/* Brush settings */}
      <Accordion title="Brush">
        <SliderRow label="Size"     value={brushSize} min={1}   max={500} onChange={setBrushSize} />
        <SliderRow label="Feather"  value={feather}   min={0}   max={100} onChange={setFeather}   />
        <SliderRow label="Opacity"  value={opacity}   min={0}   max={100} onChange={setOpacity}   />
        <SliderRow label="Strength" value={strength}  min={0}   max={100} onChange={setStrength}  />
      </Accordion>
    </div>
  );
};

export default LoupePatchPanel;
