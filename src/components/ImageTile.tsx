import {
  WarningCircleIcon,
  PaletteIcon,
  BandaidsIcon,
  SparkleIcon,
  CopySimpleIcon,
  StarIcon,
  FlagIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";

interface ImageTileProps {
  src: string;
  filename: string;
  isScanning?: boolean;
  isSelected?: boolean;
  isPrimary?: boolean;
  hasWarning?: boolean;
  isEdited?: boolean;
  isRetouched?: boolean;
  fileType?: string;
  hasHighlights?: boolean;
  duplicateCount?: number;
  rating?: number;
  isFlagged?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onRatingChange?: (rating: number) => void;
  onFlagToggle?: () => void;
}

const badgeBase =
  "backdrop-blur-[2px] bg-[rgba(17,17,17,0.85)] border-[0.5px] border-[#474747] flex h-6 min-w-6 items-center justify-center gap-1 overflow-clip px-1 py-1 rounded-[4px] shrink-0";

const ImageTile = ({
  src,
  filename,
  isScanning = false,
  isSelected = false,
  isPrimary = false,
  hasWarning = false,
  isEdited = false,
  isRetouched = false,
  fileType,
  hasHighlights = false,
  duplicateCount,
  rating = 0,
  isFlagged = false,
  onClick,
  onDoubleClick,
  onPrev,
  onNext,
  onRatingChange,
  onFlagToggle,
}: ImageTileProps) => {
  const hasBadges =
    hasWarning || isEdited || isRetouched || fileType || hasHighlights || (duplicateCount != null && duplicateCount > 0);

  return (
    <div
      className="relative aspect-square bg-[#1c1c1c]"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 310px" }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute inset-0 flex flex-col gap-2 pb-3 pt-2 px-3 overflow-hidden">
      {isSelected && (
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: `rgba(226, 226, 226, ${isPrimary ? 0.2 : 0.1})` }}
        />
      )}

      {/* Metadata row */}
      <div className="flex h-6 items-center gap-8 w-full shrink-0">
        <span className="flex-1 min-w-0 text-[12px] text-[#ababab] truncate leading-4">{filename}</span>
        {hasBadges && (
          <div className="flex items-center gap-[2px] shrink-0">
            {hasWarning && (
              <div className="backdrop-blur-[2px] bg-[rgba(202,138,4,0.12)] border-[0.5px] border-[rgba(202,138,4,0.4)] flex h-6 min-w-6 items-center justify-center gap-1 overflow-clip px-1 py-1 rounded-[4px] shrink-0">
                <WarningCircleIcon size={16} className="text-[rgba(202,138,4,1)] shrink-0" />
              </div>
            )}
            {isEdited && (
              <div className={badgeBase}>
                <PaletteIcon size={16} className="text-[#e2e2e2] shrink-0" />
              </div>
            )}
            {isRetouched && (
              <div className={badgeBase}>
                <BandaidsIcon size={16} className="text-[#e2e2e2] shrink-0" />
              </div>
            )}
            {fileType && (
              <div className={badgeBase}>
                <span className="text-[12px] font-medium text-[#e2e2e2] leading-4">{fileType}</span>
              </div>
            )}
            {hasHighlights && (
              <div className={badgeBase}>
                <SparkleIcon size={16} className="text-[#e2e2e2] shrink-0" />
              </div>
            )}
            {duplicateCount != null && duplicateCount > 0 && (
              <div className={badgeBase}>
                <CopySimpleIcon size={16} className="text-[#e2e2e2] shrink-0" />
                <span className="text-[12px] font-medium text-[#e2e2e2] leading-4">{duplicateCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image frame */}
      <div className="relative flex-1 min-h-0 w-full rounded-[4px] overflow-clip">
        <img
          src={src}
          alt={filename}
          loading="lazy"
          className="w-full h-full object-contain rounded-[2px]"
        />
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Actions row */}
      <div className="flex h-[18px] items-center justify-betwen w-full shrink-0">
        {/* Left nav */}

        <div className="flex flex-1 items-center min-w-0">
          {(duplicateCount != null && duplicateCount > 0) && (
            <button
              className="flex items-center justify-center w-6 h-6 rounded-[4px] text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5 transition-colors"
              onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
            >
              <CaretLeftIcon size={16} />
            </button>
          )}
        </div>

        {/* Rating + flag */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-[2px] bg-[#5e5e5e] px-1 py-[2px] rounded-[4px]">
            {Array.from({ length: 5 }, (_, i) => (
              <button
                key={i}
                className="shrink-0"
                onClick={(e) => { e.stopPropagation(); onRatingChange?.(i + 1 === rating ? 0 : i + 1); }}
              >
                <StarIcon
                  size={10}
                  weight={i < rating ? "fill" : "regular"}
                  className={i < rating ? "text-[#e2e2e2]" : "text-[#ababab]"}
                />
              </button>
            ))}
          </div>
          <button
            className="flex items-center justify-center text-[#ababab] hover:text-[#e2e2e2] transition-colors"
            onClick={(e) => { e.stopPropagation(); onFlagToggle?.(); }}
          >
            <FlagIcon size={12} weight={isFlagged ? "fill" : "regular"} className={isFlagged ? "text-[#e2e2e2]" : undefined} />
          </button>
        </div>

        {/* Right nav */}
        <div className="flex flex-1 items-center justify-end min-w-0">
          {(duplicateCount != null && duplicateCount > 0) && (
            <button
              className="flex items-center justify-center w-6 h-6 rounded-[4px] text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5 transition-colors"
              onClick={(e) => { e.stopPropagation(); onNext?.(); }}
            >
              <CaretRightIcon size={16} />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ImageTile;
