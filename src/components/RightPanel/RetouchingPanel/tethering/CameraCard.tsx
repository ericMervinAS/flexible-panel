import { useState, useRef } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

interface CameraCardProps {
  label: string;
  stops: string[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  renderValue: (v: string) => React.ReactNode;
  onDragStart: () => void;
  onDragEnd: () => void;
  suppressHover: boolean;
}

const DRAG_STEP_PX = 16;

export const CameraCard = ({
  label,
  stops,
  index,
  onPrev,
  onNext,
  renderValue,
  onDragStart,
  onDragEnd,
  suppressHover,
}: CameraCardProps) => {
  const dragRef = useRef<{ lastX: number } | null>(null);
  const [isActive, setIsActive] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { lastX: e.clientX };
    setIsActive(true);
    onDragStart();
    document.body.style.cursor = "ew-resize";

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.lastX;
      if (delta > DRAG_STEP_PX) {
        onNext();
        dragRef.current.lastX = ev.clientX;
      } else if (delta < -DRAG_STEP_PX) {
        onPrev();
        dragRef.current.lastX = ev.clientX;
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setIsActive(false);
      onDragEnd();
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const overlayClass = isActive
    ? "opacity-100"
    : suppressHover
      ? "opacity-0"
      : "opacity-0 group-hover:opacity-100";

  return (
    <div
      className="flex-1 bg-[#242424] rounded-[6px] flex flex-col items-center gap-[6px] pt-4 pb-[10px] px-1 relative cursor-ew-resize select-none group"
      onMouseDown={handleMouseDown}
    >
      <div
        className={`absolute inset-0 rounded-[6px] bg-white/5 transition-opacity pointer-events-none ${overlayClass}`}
      />
      <div className="flex items-baseline gap-0.5 justify-center w-full">
        {renderValue(stops[index])}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#777]">
        {label}
      </span>
      <div className="absolute inset-x-1 top-4 h-6 flex items-center justify-between pointer-events-none">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          disabled={index === 0}
          className="text-[#666] hover:text-[#ababab] disabled:opacity-25 transition-colors pointer-events-auto"
        >
          <CaretLeft size={12} weight="bold" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          disabled={index === stops.length - 1}
          className="text-[#666] hover:text-[#ababab] disabled:opacity-25 transition-colors pointer-events-auto"
        >
          <CaretRight size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
};
