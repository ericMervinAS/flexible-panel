import type { RefObject, MutableRefObject } from "react";
import RetouchIcon from "./icons/RetouchIcon";
import type { ImageData, ColorTag } from "./ImageGrid";

const pillBg: Record<ColorTag, string> = {
  green:  "#1f6a46",
  yellow: "#a16207",
  red:    "#ac3131",
  none:   "#303030",
};

interface FilmstripBarProps {
  stripImages: Array<ImageData & { originalIndex: number }>;
  currentIndex: number;
  selectedIndices: Set<number>;
  onSelectImage: (index: number, e: React.MouseEvent) => void;
  stripRef: RefObject<HTMLDivElement>;
  tileRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  /** Image indices with any retouch (AI slider/preset edits or distraction
   *  removal) — shows a small badge on the thumbnail's top-left corner. */
  retouchedIndices?: Set<number>;
}

const FilmstripBar = ({ stripImages, currentIndex, selectedIndices, onSelectImage, stripRef, tileRefs, retouchedIndices }: FilmstripBarProps) => {
  return (
    <div className="bg-[#1c1c1c] shrink-0">
      <div
        ref={stripRef}
        className="flex gap-1 h-[87px] items-center px-2 py-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {stripImages.map((img, displayPos) => {
          const isCurrent = img.originalIndex === currentIndex;
          const isSelected = selectedIndices.has(img.originalIndex);
          return (
            <div
              key={img.originalIndex}
              ref={(el) => { tileRefs.current[displayPos] = el; }}
              className="flex flex-col gap-1 items-center shrink-0 cursor-pointer select-none"
              onClick={(e) => onSelectImage(img.originalIndex, e)}
            >
              <div
                className={`rounded-md p-[3px] transition-colors ${
                  isCurrent
                    ? "border-2 border-white"
                    : isSelected
                    ? "border-2 border-[#a0a0a0]"
                    : "border border-[#303030] hover:border-[#5e5e5e]"
                }`}
              >
                <div className="relative w-[96px] h-[64px] overflow-hidden rounded-[2px]">
                  <img
                    src={img.src}
                    alt={img.filename}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                  {retouchedIndices?.has(img.originalIndex) && (
                    <div className="absolute top-1 left-1 flex items-center justify-center bg-[#16a34a] rounded-[2px] px-1 py-0.5">
                      <RetouchIcon size={13} className="text-white shrink-0" />
                    </div>
                  )}
                </div>
              </div>
              <div
                className="h-1 w-6 rounded-full shrink-0"
                style={{ backgroundColor: pillBg[img.colorTag] }}
              />
            </div>
          );
        })}
      </div>
      <div className="h-3 px-2 flex items-center">
        <div className="h-1 w-14 bg-[#777] rounded-full" />
      </div>
    </div>
  );
};

export default FilmstripBar;
