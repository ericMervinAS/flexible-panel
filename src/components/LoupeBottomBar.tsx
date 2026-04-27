import type { RefObject } from "react";
import { Star, Flag, Info, Eye, ArrowCounterClockwise, Columns, Keyboard, CaretDown } from "@phosphor-icons/react";
import type { ImageData, ColorTag } from "./ImageGrid";

const colorTagBg: Record<ColorTag, string> = {
  green:  "#15803d",
  yellow: "#a16207",
  red:    "#b91c1c",
  none:   "transparent",
};

const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 400];

interface LoupeBottomBarProps {
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
}

const LoupeBottomBar = ({
  image,
  currentIndex,
  totalImages,
  isFit,
  displayPct,
  goToFit,
  goToTrueHundred,
  handleZoomPreset,
  showZoomDropdown,
  setShowZoomDropdown,
  zoomDropdownRef,
}: LoupeBottomBarProps) => {
  return (
    <footer className="flex items-center justify-between h-10 pl-2 pr-4 bg-[#1c1c1c] border-t border-background shrink-0">
      <div className="flex items-center gap-3 w-[220px]">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[13px] text-[#e2e2e2] font-normal truncate">{image.filename}</span>
          <Info className="w-4 h-4 text-[#777] shrink-0" />
        </div>
        <div className="w-px h-4 bg-[#303030] shrink-0" />
        <div className="flex items-center gap-1 text-[#ababab] shrink-0">
          <Eye className="w-4 h-4" />
          <span className="text-[12px] font-medium whitespace-nowrap">
            {currentIndex + 1} / {totalImages}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div
          className="flex items-center gap-[2px] px-2 py-1 rounded-md shrink-0"
          style={{ backgroundColor: image.colorTag !== "none" ? colorTagBg[image.colorTag] : "#303030" }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} fill={i < image.stars ? "white" : "rgba(255,255,255,0.3)"} strokeWidth={0} />
          ))}
        </div>
        <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
          <Flag size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3 w-[220px] justify-end">
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
            <ArrowCounterClockwise size={16} />
          </button>
          <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
            <Columns size={16} />
          </button>
        </div>
        <div className="w-px h-4 bg-[#303030]" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={goToFit}
            className={`text-[12px] font-medium transition-colors ${
              isFit ? "text-[#e2e2e2]" : "text-[#555] hover:text-[#ababab]"
            }`}
          >
            Fit
          </button>

          <div className="relative flex items-center gap-0.5" ref={zoomDropdownRef}>
            <button
              onClick={goToTrueHundred}
              title="Jump to 100% (actual pixels)"
              className={`text-[12px] font-medium transition-colors ${
                !isFit ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"
              }`}
            >
              {displayPct()}%
            </button>
            <button
              onClick={() => setShowZoomDropdown((v) => !v)}
              className="text-[#555] hover:text-[#ababab] transition-colors flex items-center"
            >
              <CaretDown size={12} />
            </button>

            {showZoomDropdown && (
              <div className="absolute bottom-full right-0 mb-2 bg-[#242424] border border-[#303030] rounded-[6px] py-1 z-50 min-w-[100px] shadow-lg">
                <button
                  onClick={() => { handleZoomPreset("fit"); setShowZoomDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${
                    isFit ? "text-[#e2e2e2]" : "text-[#ababab] hover:text-[#e2e2e2]"
                  }`}
                >
                  Fit
                </button>
                {ZOOM_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => { handleZoomPreset(pct); setShowZoomDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${
                      !isFit && displayPct() === pct ? "text-[#e2e2e2]" : "text-[#ababab] hover:text-[#e2e2e2]"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-px h-4 bg-[#303030]" />
        <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
          <Keyboard size={16} />
        </button>
      </div>
    </footer>
  );
};

export default LoupeBottomBar;
