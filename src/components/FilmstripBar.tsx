import type { RefObject, MutableRefObject } from "react";
import type { ImageData, ColorTag } from "./ImageGrid";

const pillBg: Record<ColorTag, string> = {
  // green: "#1f6a46",
  // yellow: "#a16207",
  // red: "#ac3131",
  // blue: "#fff",
  // purple: "$121453",
  // none: "#303030",
  none: "#5e5e5e",
  green: "#15803d",
  blue: "#007bd5",
  purple: "#8b5cf6",
  yellow: "#ca8a04",
  red: "#ef4444",
};

interface FilmstripBarProps {
  stripImages: Array<ImageData & { originalIndex: number }>;
  currentIndex: number;
  onSelectImage: (index: number) => void;
  stripRef: RefObject<HTMLDivElement>;
  tileRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  selectedIndices?: Set<number>;
  onTileClick?: (originalIndex: number, modifiers: { cmd: boolean; shift: boolean }) => void;
}

const FilmstripBar = ({
  stripImages,
  currentIndex,
  onSelectImage,
  stripRef,
  tileRefs,
  selectedIndices,
  onTileClick,
}: FilmstripBarProps) => {
  const hasMultiSelect = selectedIndices !== undefined && onTileClick !== undefined;

  return (
    <div className="bg-[#1c1c1c] shrink-0">
      <div
        ref={stripRef}
        className="flex gap-1 h-[87px] items-center px-2 py-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {stripImages.map((img, displayPos) => {
          const isActive = img.originalIndex === currentIndex;
          const isSelected = hasMultiSelect && selectedIndices.has(img.originalIndex);

          return (
            <div
              key={img.originalIndex}
              ref={(el) => {
                tileRefs.current[displayPos] = el;
              }}
              className="flex flex-col gap-1 items-center shrink-0 cursor-pointer"
              onClick={(e) => {
                if (hasMultiSelect && (e.metaKey || e.ctrlKey || e.shiftKey)) {
                  onTileClick(img.originalIndex, {
                    cmd: e.metaKey || e.ctrlKey,
                    shift: e.shiftKey,
                  });
                } else {
                  onSelectImage(img.originalIndex);
                  if (hasMultiSelect) {
                    onTileClick(img.originalIndex, { cmd: false, shift: false });
                  }
                }
              }}
            >
              <div
                className="rounded-md p-[3px] transition-colors"
                style={{
                  border: isActive
                    ? "2px solid #ffffff"
                    : isSelected
                      ? "2px solid rgba(255,255,255,0.5)"
                      : "1px solid #303030",
                }}
              >
                <div className="w-[96px] h-[64px] overflow-hidden rounded-[2px] relative">
                  <img
                    src={img.src}
                    alt={img.filename}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                  {img.isRaw && (
                    <div className="absolute top-1 left-1 backdrop-blur-[2px] bg-[rgba(17,17,17,0.85)] border-[0.5px] border-[#474747] flex items-center justify-center px-[3px] py-[2px] rounded-[2px]">
                      <span className="text-[#e2e2e2] text-[8px] font-medium leading-normal whitespace-nowrap">
                        RAW
                      </span>
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
