import { type RefObject, useRef, useState, useCallback } from "react";
import {
  Eye, Keyboard, Star, Flag, Info,
  ArrowCounterClockwise, Columns, CaretDown,
} from "@phosphor-icons/react";
import type { ImageData, ColorTag } from "./ImageGrid";

// ─── GridSlider ──────────────────────────────────────────────────────────────

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

  const valueFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const raw = (clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(1, raw));
      const stepped = Math.round((min + clamped * (max - min)) / step) * step;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step, value],
  );

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
      <div className="absolute inset-x-0 h-[4px] bg-[#474747] rounded-full">
        <div
          className="absolute left-0 top-0 h-full bg-[#777] rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="absolute -translate-x-1/2 bg-[#1c1c1c] p-[2px] rounded-full flex items-center justify-center z-10"
        style={{ left: `${pct}%` }}
      >
        <div
          className={`rounded-[8px] transition-all ${
            grabbed ? "bg-[#ababab] w-[4px] h-[14px]" : "bg-[#474747] w-[2px] h-[12px]"
          }`}
        />
      </div>
    </div>
  );
};

// ─── Constants ───────────────────────────────────────────────────────────────

const colorTagBg: Record<ColorTag, string> = {
  green:  "#15803d",
  yellow: "#a16207",
  red:    "#b91c1c",
  none:   "transparent",
};

const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 400];

// ─── Props ───────────────────────────────────────────────────────────────────

type GridProps = {
  mode: "grid";
  albumName: string;
  totalPhotos: number;
  visiblePhotos: number;
  columns: number;
  onColumnsChange: (cols: number) => void;
};

type LoupeProps = {
  mode: "loupe";
  image: ImageData;
  currentIndex: number;
  totalImages: number;
  isFit: boolean;
  displayPct: () => number;
  goToFit: () => void;
  goToTrueHundred: () => void;
  handleZoomPreset: (pct: number | "fit") => void;
  showZoomDropdown: boolean;
  setShowZoomDropdown: (v: boolean | ((prev: boolean) => boolean)) => void;
  zoomDropdownRef: RefObject<HTMLDivElement>;
};

type BottomBarProps = GridProps | LoupeProps;

// ─── Component ───────────────────────────────────────────────────────────────

const BottomBar = (props: BottomBarProps) => {
  const isLoupe = props.mode === "loupe";

  return (
    <footer className="flex items-center justify-between h-10 px-3 bg-[#1c1c1c] shrink-0">

      {/* Left ─ album info (grid) / filename (loupe) */}
      <div className="flex items-center gap-3 text-[12px] w-[220px] transition-all duration-200">
        {isLoupe ? (
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[13px] text-[#e2e2e2] font-normal truncate">
              {props.image.filename}
            </span>
            <Info className="w-4 h-4 text-[#777] shrink-0" />
          </div>
        ) : (
          <>
            <span className="text-[#e2e2e2] font-medium">{props.albumName}</span>
            <span className="text-[#ababab]">({props.totalPhotos})</span>
          </>
        )}

        <div className="w-px h-4 bg-[#303030] shrink-0" />

        <div className="flex items-center gap-1 text-[#ababab] shrink-0">
          <Eye className="w-4 h-4" />
          <span className="font-medium whitespace-nowrap">
            {isLoupe
              ? `${props.currentIndex + 1} / ${props.totalImages}`
              : `1 / ${props.visiblePhotos}`}
          </span>
        </div>
      </div>

      {/* Center ─ stars + flag (loupe only) */}
      <div
        className={`flex items-center gap-1 transition-all duration-200 ${
          isLoupe ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {isLoupe && (
          <>
            <div
              className="flex items-center gap-[2px] px-2 py-1 rounded-md shrink-0"
              style={{
                backgroundColor:
                  props.image.colorTag !== "none"
                    ? colorTagBg[props.image.colorTag]
                    : "#303030",
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  fill={i < props.image.stars ? "white" : "rgba(255,255,255,0.3)"}
                  strokeWidth={0}
                />
              ))}
            </div>
            <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
              <Flag size={16} />
            </button>
          </>
        )}
      </div>

      {/* Right ─ grid slider / loupe zoom controls + shared keyboard */}
      <div className="flex items-center gap-3 w-[220px] justify-end transition-all duration-200">
        {isLoupe ? (
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
              <ArrowCounterClockwise size={16} />
            </button>
            <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
              <Columns size={16} />
            </button>
          </div>
        ) : (
          <GridSlider
            value={props.columns}
            min={2}
            max={6}
            step={1}
            onChange={props.onColumnsChange}
          />
        )}

        <div className="w-px h-4 bg-[#303030]" />

        {isLoupe ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={props.goToFit}
              className={`text-[12px] font-medium transition-colors ${
                props.isFit ? "text-[#e2e2e2]" : "text-[#555] hover:text-[#ababab]"
              }`}
            >
              Fit
            </button>

            <div className="relative flex items-center gap-0.5" ref={props.zoomDropdownRef}>
              <button
                onClick={props.goToTrueHundred}
                title="Jump to 100%"
                className={`text-[12px] font-medium transition-colors ${
                  !props.isFit ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"
                }`}
              >
                {props.displayPct()}%
              </button>
              <button
                onClick={() => props.setShowZoomDropdown((v) => !v)}
                className="text-[#555] hover:text-[#ababab] transition-colors flex items-center"
              >
                <CaretDown size={12} />
              </button>

              {props.showZoomDropdown && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#242424] border border-[#303030] rounded-[6px] py-1 z-50 min-w-[100px] shadow-lg">
                  <button
                    onClick={() => { props.handleZoomPreset("fit"); props.setShowZoomDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${
                      props.isFit ? "text-[#e2e2e2]" : "text-[#ababab] hover:text-[#e2e2e2]"
                    }`}
                  >
                    Fit
                  </button>
                  {ZOOM_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => { props.handleZoomPreset(pct); props.setShowZoomDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${
                        !props.isFit && props.displayPct() === pct
                          ? "text-[#e2e2e2]"
                          : "text-[#ababab] hover:text-[#e2e2e2]"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-[#303030]" />
          </div>
        ) : null}

        <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
          <Keyboard size={isLoupe ? 16 : 20} />
        </button>
      </div>
    </footer>
  );
};

export default BottomBar;
