import { Eye, Keyboard } from "lucide-react";
import { useRef, useState, useCallback } from "react";

interface GridSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}

const GridSlider = ({ value, min, max, step, onChange }: GridSliderProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [grabbed, setGrabbed] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const valueFromEvent = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, raw));
    const stepped = Math.round((min + clamped * (max - min)) / step) * step;
    return Math.max(min, Math.min(max, stepped));
  }, [min, max, step, value]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setGrabbed(true);
    onChange(valueFromEvent(e.clientX));

    const onMove = (me: MouseEvent) => onChange(valueFromEvent(me.clientX));
    const onUp = () => {
      setGrabbed(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={trackRef}
      className="relative flex items-center w-[88px] h-4 cursor-pointer select-none"
      onMouseDown={handleMouseDown}
    >
      {/* Track */}
      <div className="absolute inset-x-0 h-[4px] bg-[#474747] rounded-full">
        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-full bg-[#777] rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Handle */}
      <div
        className="absolute -translate-x-1/2 bg-[#1c1c1c] p-[2px] rounded-full flex items-center justify-center z-10"
        style={{ left: `${pct}%` }}
      >
        <div
          className={`rounded-[8px] transition-all ${
            grabbed
              ? "bg-[#ababab] w-[4px] h-[14px]"
              : "bg-[#474747] w-[2px] h-[12px]"
          }`}
        />
      </div>
    </div>
  );
};

interface BottomBarProps {
  columns: number;
  onColumnsChange: (cols: number) => void;
  totalPhotos: number;
  visiblePhotos: number;
  albumName: string;
}

const BottomBar = ({ columns, onColumnsChange, totalPhotos, visiblePhotos, albumName }: BottomBarProps) => {
  return (
    <footer className="flex items-center justify-between h-10 px-3 bg-[#1c1c1c] shrink-0">
      {/* Left: album name + counts */}
      <div className="flex items-center gap-3 text-[12px]">
        <span className="text-[#e2e2e2] font-medium">{albumName}</span>
        <span className="text-[#ababab]">({totalPhotos})</span>
        <div className="w-px h-4 bg-[#303030]" />
        <div className="flex items-center gap-1 text-[#ababab] font-medium">
          <Eye className="w-4 h-4" />
          <span>1 / {visiblePhotos}</span>
        </div>
      </div>

      {/* Right: slider + keyboard icon */}
      <div className="flex items-center gap-3">
        <GridSlider
          value={columns}
          min={2}
          max={6}
          step={1}
          onChange={onColumnsChange}
        />
        <div className="w-px h-4 bg-[#303030]" />
        <button className="text-[#777] hover:text-[#ababab] transition-colors">
          <Keyboard className="w-5 h-5" />
        </button>
      </div>
    </footer>
  );
};

export default BottomBar;
