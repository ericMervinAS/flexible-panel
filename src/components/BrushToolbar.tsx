import { useRef, useState } from "react";
import { PaintBrush, Circle, Eraser, SlidersHorizontal, Plus, Minus } from "@phosphor-icons/react";

// ─── Brush slider ─────────────────────────────────────────────────────────────
interface BrushSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

const BrushSlider = ({ label, value, min, max, onChange }: BrushSliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const valueFromX = (clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const clamped = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + clamped * (max - min));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(valueFromX(e.clientX));
    const onMove = (me: MouseEvent) => onChange(valueFromX(me.clientX));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#ababab] leading-3">{label}</span>
        <span className="text-[11px] font-medium text-[#e2e2e2] leading-3">{value}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-4 flex items-center cursor-pointer select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-x-0 h-[3px] bg-[#303030] rounded-full">
          <div
            className="absolute left-0 top-0 h-full bg-[#e2e2e2]/30 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-[#e2e2e2] -translate-x-1/2 shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ─── Brush toolbar ────────────────────────────────────────────────────────────
interface BrushToolbarProps {
  onBrushSizeChange?: (size: number) => void;
}

const BrushToolbar = ({ onBrushSizeChange }: BrushToolbarProps) => {
  const [brushMode, setBrushMode] = useState<"add" | "subtract">("add");
  const [brushSize, setBrushSize] = useState(50);
  const [softness, setSoftness] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const [showSettings, setShowSettings] = useState(false);

  const handleBrushSizeChange = (v: number) => {
    setBrushSize(v);
    onBrushSizeChange?.(v);
  };

  return (
    <div
      className="absolute top-4 right-4 z-20 flex items-start gap-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Settings panel — shown to the left of the toolbar */}
      {showSettings && (
        <div className="bg-[#1c1c1c]/95 border border-[#303030] rounded-[8px] p-4 flex flex-col gap-4 w-[188px] backdrop-blur-sm shadow-xl">
          <BrushSlider label="Brush Size" value={brushSize} min={1} max={200} onChange={handleBrushSizeChange} />
          <BrushSlider label="Softness" value={softness} min={0} max={100} onChange={setSoftness} />
          <BrushSlider label="Opacity" value={opacity} min={0} max={100} onChange={setOpacity} />
        </div>
      )}

      {/* Main toolbar pill */}
      <div className="bg-[#1c1c1c] border border-[#303030] rounded-[8px] p-[6px] flex flex-col gap-2 shadow-xl">

        {/* Brush mode buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => setBrushMode("add")}
            title="Brush Add"
            className={`w-8 h-8 flex items-center justify-center rounded-[6px] border transition-colors ${brushMode === "add"
                ? "bg-[rgba(226,226,226,0.10)] border-[#5e5e5e]"
                : "bg-transparent border-transparent hover:bg-[rgba(226,226,226,0.05)]"
              }`}
          >
            <div className="relative">
              <PaintBrush className="w-4 h-4" />
              <Plus className="absolute -bottom-1 -right-1 w-2.5 h-2.5" weight="bold" />
            </div>
          </button>
          <button
            onClick={() => setBrushMode("subtract")}
            title="Brush Subtract"
            className={`w-8 h-8 flex items-center justify-center rounded-[6px] border transition-colors ${brushMode === "subtract"
                ? "bg-[rgba(226,226,226,0.10)] border-[#5e5e5e]"
                : "bg-transparent border-transparent hover:bg-[rgba(226,226,226,0.05)]"
              }`}
          >
            <div className="relative">
              <PaintBrush className="w-4 h-4" />
              <Minus className="absolute -bottom-1 -right-1 w-2.5 h-2.5" weight="bold" />
            </div>
          </button>
        </div>

        {/* Size preview */}
        <button onClick={() => setShowSettings((v) => !v)}>
          <div className="flex flex-col items-center gap-1 bg-[#27272a] rounded-[6px] px-1.5 py-2">
            <Circle className="w-4 h-4 text-[#ababab]" />
            <span className="text-[10px] font-medium text-[#ababab] leading-none tabular-nums">
              {brushSize}
            </span>
          </div>
        </button>

        {/* Eraser */}
        <button
          title="Eraser"
          className="w-8 h-8 flex items-center justify-center rounded-[6px] border border-transparent hover:bg-[rgba(226,226,226,0.05)] transition-colors"
        >
          <Eraser className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="h-px bg-[#303030] mx-1" />

        {/* Settings toggle */}
        <button
          title="Brush settings"
          className={`w-8 h-8 flex items-center justify-center rounded-[6px] border transition-colors ${showSettings
              ? "bg-[rgba(226,226,226,0.10)] border-[#5e5e5e]"
              : "bg-transparent border-transparent hover:bg-[rgba(226,226,226,0.05)]"
            }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default BrushToolbar;
