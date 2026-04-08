import { useRef, useEffect } from "react";
import { Star, Flag, Info, Eye, RotateCcw, Columns2, Keyboard, ChevronDown } from "lucide-react";
import type { ImageData, ColorTag } from "./ImageGrid";

const colorTagBg: Record<ColorTag, string> = {
  green: "#15803d",
  yellow: "#a16207",
  red: "#b91c1c",
  none: "transparent",
};

const filmstripPillBg: Record<ColorTag, string> = {
  green: "#1f6a46",
  yellow: "#a16207",
  red: "#ac3131",
  none: "#303030",
};

interface LoupeViewProps {
  image: ImageData;
  images: ImageData[];
  currentIndex: number;
  totalImages: number;
  onSelectImage: (index: number) => void;
}

const LoupeView = ({ image, images, currentIndex, totalImages, onSelectImage }: LoupeViewProps) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const strip = stripRef.current;
    const tile = tileRefs.current[currentIndex];
    if (!strip || !tile) return;
    const targetLeft = tile.offsetLeft - strip.offsetWidth / 2 + tile.offsetWidth / 2;
    strip.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        onSelectImage(Math.max(0, currentIndex - 1));
      } else if (e.key === "ArrowRight") {
        onSelectImage(Math.min(totalImages - 1, currentIndex + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, totalImages, onSelectImage]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Image area */}
      <div className="flex-1 bg-[#141414] flex items-center justify-center overflow-hidden">
        <img
          src={image.src}
          alt={image.filename}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Filmstrip */}
      <div className="bg-[#1c1c1c] shrink-0">
        {/* Tiles row */}
        <div
          ref={stripRef}
          className="flex gap-1 h-[87px] items-center px-2 py-1 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img, i) => (
            <div
              key={i}
              ref={(el) => { tileRefs.current[i] = el; }}
              className="flex flex-col gap-1 items-center shrink-0 cursor-pointer"
              onClick={() => onSelectImage(i)}
            >
              {/* Thumbnail card */}
              <div
                className={`rounded-md p-[3px] transition-colors ${
                  i === currentIndex
                    ? "border-2 border-white"
                    : "border border-[#303030] hover:border-[#5e5e5e]"
                }`}
              >
                <div className="w-[96px] h-[64px] overflow-hidden rounded-[2px]">
                  <img
                    src={img.src}
                    alt={img.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              {/* Color tag pill */}
              <div
                className="h-1 w-6 rounded-full shrink-0"
                style={{ backgroundColor: filmstripPillBg[img.colorTag] }}
              />
            </div>
          ))}
        </div>
        {/* Scroll indicator */}
        <div className="h-3 px-2 flex items-center">
          <div className="h-1 w-14 bg-[#777] rounded-full" />
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between h-10 pl-2 pr-4 bg-[#1c1c1c] border-t border-background shrink-0">
        {/* Left: filename + eye count */}
        <div className="flex items-center gap-3 w-[220px]">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[13px] text-[#e2e2e2] font-normal truncate">
              {image.filename}
            </span>
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

        {/* Center: Star color rating */}
        <div className="flex items-center gap-1">
          <div
            className="flex items-center gap-[2px] px-2 py-1 rounded-md shrink-0"
            style={{ backgroundColor: image.colorTag !== "none" ? colorTagBg[image.colorTag] : "#303030" }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                fill={i < image.stars ? "white" : "rgba(255,255,255,0.3)"}
                strokeWidth={0}
              />
            ))}
          </div>
          <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
            <Flag size={16} />
          </button>
        </div>

        {/* Right: history, compare, zoom, keyboard */}
        <div className="flex items-center gap-3 w-[220px] justify-end">
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
              <RotateCcw size={16} />
            </button>
            <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
              <Columns2 size={16} />
            </button>
          </div>
          <div className="w-px h-4 bg-[#303030]" />
          <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity">
            <span className="text-[12px] font-medium text-[#e2e2e2]">Fit</span>
            <span className="text-[12px] font-medium text-[#777]">100%</span>
            <ChevronDown size={12} className="text-[#777]" />
          </div>
          <div className="w-px h-4 bg-[#303030]" />
          <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
            <Keyboard size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LoupeView;
