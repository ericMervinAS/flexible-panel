import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PaintBrush, Circle, ArrowCounterClockwiseIcon, Plus, Minus, ArrowsOutSimpleIcon } from "@phosphor-icons/react";

// ─── Brush slider ─────────────────────────────────────────────────────────────
interface BrushSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  showBrushCursor?: boolean;
}

const BrushSlider = ({ label, value, min, max, onChange, showBrushCursor }: BrushSliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;
  const [preview, setPreview] = useState<{ x: number; y: number; size: number } | null>(null);

  const valueFromX = (clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const clamped = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + clamped * (max - min));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const initial = valueFromX(e.clientX);
    onChange(initial);
    if (showBrushCursor) {
      document.body.style.cursor = "none";
      setPreview({ x: e.clientX, y: e.clientY, size: initial });
    }
    const onMove = (me: MouseEvent) => {
      const v = valueFromX(me.clientX);
      onChange(v);
      if (showBrushCursor) {
        setPreview({ x: me.clientX, y: me.clientY, size: v });
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (showBrushCursor) {
        document.body.style.cursor = "";
        setPreview(null);
      }
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
      {preview && createPortal(
        <div
          className="fixed pointer-events-none rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{
            left: preview.x - preview.size / 2,
            top: preview.y - preview.size / 2,
            width: preview.size,
            height: preview.size,
            zIndex: 9999,
          }}
        />,
        document.body,
      )}
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLButtonElement>(null);
  const [panelTop, setPanelTop] = useState(0);

  const handleBrushSizeChange = (v: number) => {
    setBrushSize(v);
    onBrushSizeChange?.(v);
  };

  useLayoutEffect(() => {
    if (!showSettings || !circleRef.current || !wrapperRef.current) return;
    const cr = circleRef.current.getBoundingClientRect();
    const wr = wrapperRef.current.getBoundingClientRect();
    setPanelTop(cr.top - wr.top);
  }, [showSettings]);

  useEffect(() => {
    if (!showSettings) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [showSettings]);

  return (
    <div
      ref={wrapperRef}
      className="absolute top-4 right-4 z-30 flex items-start gap-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Settings panel — aligned with the Circle (size) button */}
      {showSettings && (
        <div
          className="bg-[#1c1c1c]/95 border border-[#303030] rounded-[8px] p-4 flex flex-col gap-4 w-[220px] backdrop-blur-sm shadow-xl"
          style={{ marginTop: panelTop }}
        >
          <BrushSlider label="Brush Size" value={brushSize} min={1} max={200} onChange={handleBrushSizeChange} showBrushCursor />
          {/* <BrushSlider label="Softness" value={softness} min={0} max={100} onChange={setSoftness} />
          <BrushSlider label="Opacity" value={opacity} min={0} max={100} onChange={setOpacity} /> */}
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
        <button ref={circleRef} onClick={() => setShowSettings((v) => !v)} title="Brush size">
          <div
            className={`flex flex-col items-center gap-1 rounded-[6px] px-1.5 py-2 border transition-colors ${showSettings
              ? "bg-[rgba(226,226,226,0.10)] border-[#5e5e5e]"
              : "bg-[#27272a] border-transparent hover:bg-[rgba(226,226,226,0.05)]"
              }`}
          >
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
          <ArrowCounterClockwiseIcon className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="h-px bg-[#303030] mx-1" />

        {/* Settings toggle */}
        <button
          title="Brush settings"
          className="w-8 h-8 flex items-center justify-center rounded-[6px] border border-transparent bg-transparent hover:bg-[rgba(226,226,226,0.05)] transition-colors"
        >
          <ArrowsOutSimpleIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default BrushToolbar;
