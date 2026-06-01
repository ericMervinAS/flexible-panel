import { type RefObject, useRef, useState, useCallback } from "react";
import {
  Eye, Keyboard, Star, Flag, Info,
  ArrowCounterClockwise, Columns, CaretDown, ArrowSquareOut,
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

  const pct = ((max - value) / (max - min)) * 100;

  const valueFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const raw = 1 - (clientX - rect.left) / rect.width;
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
          className={`rounded-[8px] transition-all ${grabbed ? "bg-[#ababab] w-[4px] h-[14px]" : "bg-[#474747] w-[2px] h-[12px]"
            }`}
        />
      </div>
    </div>
  );
};

// ─── Constants ───────────────────────────────────────────────────────────────

const colorTagBg: Record<ColorTag, string> = {
  none: "#5e5e5e",
  green: "#15803d",
  blue: "#007bd5",
  purple: "#8b5cf6",
  yellow: "#ca8a04",
  red: "#ef4444",
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
  albumName?: string;
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
  onRatingChange?: (rating: number) => void;
};

type BottomBarProps = GridProps | LoupeProps;

// ─── InfoPopover ─────────────────────────────────────────────────────────────

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
};

interface InfoPopoverProps {
  image: ImageData;
  albumName?: string;
}

const InfoPopover = ({ image, albumName }: InfoPopoverProps) => {
  const hasCamera = image.camera || image.lens;
  const hasShooting = image.shutterSpeed || image.aperture || image.iso || image.focalLength;
  const hasExif = hasCamera || hasShooting;
  const hasTimestamp = image.captureTime || image.captureDate;
  const hasMeta = image.width || image.height || image.fileSize;

  return (
    <div className="absolute bottom-[calc(100%+8px)] left-0 bg-[#1c1c1c] border border-[#303030] rounded-[12px] p-4 z-50 w-[280px] shadow-xl flex flex-col gap-4 pointer-events-auto">
      {/* Filename + view in folder */}
      <div className="flex flex-col gap-1">
        {albumName && (
          <span className="text-[11px] font-medium text-[#777] leading-[12px]">{albumName}</span>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#e2e2e2] font-normal truncate leading-[16px]">
            {image.filename}
          </span>
          <button className="flex items-center gap-1 text-[12px] font-medium text-[#ababab] hover:text-[#e2e2e2] transition-colors shrink-0">
            View in Folder
            <ArrowSquareOut size={16} />
          </button>
        </div>
      </div>

      {/* EXIF card */}
      {hasExif && (
        <div className="bg-white/5 rounded-[6px] p-3 flex flex-col gap-3">
          {hasCamera && (
            <div className="flex flex-col gap-1 text-[13px] text-[#e2e2e2] leading-[16px]">
              {image.camera && <span>{image.camera}</span>}
              {image.lens && <span>{image.lens}</span>}
            </div>
          )}
          {hasCamera && hasShooting && (
            <div className="h-px bg-[#e2e2e2]/10" />
          )}
          {hasShooting && (
            <div className="flex items-center justify-between text-[13px] text-[#e2e2e2] leading-[16px]">
              {image.shutterSpeed && <span>{image.shutterSpeed}</span>}
              {image.aperture && <span>{image.aperture}</span>}
              {image.iso != null && <span>ISO {image.iso}</span>}
              {image.focalLength && <span>{image.focalLength}</span>}
            </div>
          )}
        </div>
      )}

      {/* Timestamp + dimensions */}
      {(hasTimestamp || hasMeta) && (
        <div className="flex items-center justify-between text-[11px] font-medium text-[#ababab] leading-[12px]">
          {hasTimestamp && (
            <div className="flex items-center gap-1">
              {image.captureTime && <span>{image.captureTime}</span>}
              {image.captureTime && image.captureDate && <span>•</span>}
              {image.captureDate && <span>{image.captureDate}</span>}
            </div>
          )}
          {hasMeta && (
            <div className="flex items-center gap-1 ml-auto">
              {image.width && image.height && <span>{image.width} x {image.height}</span>}
              {image.width && image.height && image.fileSize && <span>•</span>}
              {image.fileSize != null && <span>{formatFileSize(image.fileSize)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const BottomBar = (props: BottomBarProps) => {
  const isLoupe = props.mode === "loupe";
  const [showInfoPopover, setShowInfoPopover] = useState(false);

  return (
    <footer className="flex items-center justify-between h-10 px-3 bg-[#1c1c1c] shrink-0">

      {/* Left ─ album info (grid) / filename (loupe) */}
      <div className="flex items-center gap-3 text-[12px] w-[220px] transition-all duration-200">
        {isLoupe ? (
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[13px] text-[#e2e2e2] font-normal truncate">
              {props.image.filename}
            </span>
            <div className="relative shrink-0">
              <button
                className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors"
                onMouseEnter={() => setShowInfoPopover(true)}
                onMouseLeave={() => setShowInfoPopover(false)}
              >
                <Info size={16} />
              </button>
              {showInfoPopover && (
                <InfoPopover
                  image={props.image}
                  albumName={props.albumName}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[#e2e2e2] font-medium truncate" title={props.albumName}>{props.albumName}</span>
            <span className="text-[#ababab] shrink-0">({props.totalPhotos})</span>
          </div>
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
        className={`flex items-center gap-1 transition-all duration-200 ${isLoupe ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
      >
        {isLoupe && (
          <>
            <div
              className="flex items-center gap-[2px] px-1.5 py-[3px] rounded-[4px] shrink-0"
              style={{ backgroundColor: colorTagBg[props.image.colorTag] }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  className="shrink-0"
                  onClick={() => props.onRatingChange?.(i + 1 === props.image.stars ? 0 : i + 1)}
                >
                  <Star
                    size={12}
                    weight="fill"
                    className={i < props.image.stars ? "text-white" : "text-white/30"}
                  />
                </button>
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
              className={`text-[12px] font-medium transition-colors ${props.isFit ? "text-[#e2e2e2]" : "text-[#555] hover:text-[#ababab]"
                }`}
            >
              Fit
            </button>

            <div className="relative flex items-center gap-0.5" ref={props.zoomDropdownRef}>
              <button
                onClick={props.goToTrueHundred}
                title="Jump to 100%"
                className={`text-[12px] font-medium transition-colors ${!props.isFit ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"
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
                    className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${props.isFit ? "text-[#e2e2e2]" : "text-[#ababab] hover:text-[#e2e2e2]"
                      }`}
                  >
                    Fit
                  </button>
                  {ZOOM_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => { props.handleZoomPreset(pct); props.setShowZoomDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${!props.isFit && props.displayPct() === pct
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
