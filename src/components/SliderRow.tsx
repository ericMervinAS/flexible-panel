import { useState, useRef, useEffect } from "react";
import {
  PushPinSimpleIcon,
  StarFourIcon,
  FlaskIcon,
  ArrowFatLineUpIcon,
  LightningIcon,
} from "@phosphor-icons/react";
import type { BadgeType } from "@/data/presetMapping";
import Tooltip from "./Tooltip";

const BADGE_ICON: Record<BadgeType, React.ReactNode> = {
  new: <StarFourIcon size={12} weight="fill" className=" text-blue-500 hover:text-blue-400" />,
  beta: <FlaskIcon size={12} weight="fill" className=" text-yellow-500 hover:text-yellow-400" />,
  improved: (
    <LightningIcon size={12} weight="fill" className=" text-blue-500 hover:text-blue-400" />
  ),
};

interface SliderRowProps {
  label: string;
  value: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  badge?: BadgeType;
  badgeLabel?: string;
}

const LABEL_RESET_DELAY = 600;

const SliderRow = ({
  label,
  value,
  defaultValue = 0,
  min = 0,
  max = 100,
  onChange,
  pinned,
  onTogglePin,
  badge,
  badgeLabel,
}: SliderRowProps) => {
  const pct = ((value - min) / (max - min)) * 100;
  const [badgeHovered, setBadgeHovered] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = rowHovered || isDragging;
  const hasValue = value !== defaultValue;

  const handleLabelEnter = () => {
    if (!hasValue) return;
    labelTimerRef.current = setTimeout(() => setShowReset(true), LABEL_RESET_DELAY);
  };
  const handleLabelLeave = () => {
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    setShowReset(false);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mouseup", onUp);
  };

  useEffect(
    () => () => {
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    },
    []
  );

  // Track fill: same for hover and grabbed (#5e5e5e)
  // Handle: hover = #5e5e5e, grabbed = #ababab
  const fillColor = isActive ? "bg-[#ababab]" : "bg-[#777]";
  const handleColor = isDragging ? "bg-[#ababab]" : isActive ? "bg-[#5e5e5e]" : "bg-[#474747]";
  const textColor = isActive ? "text-[#ababab]" : "text-[#777]";

  return (
    <div
      className="group flex items-center"
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
    >
      {/* {onTogglePin ? (
        <button
          onClick={onTogglePin}
          className={`mr-1.5 w-3 h-3 flex items-center justify-center transition-colors shrink-0 ${pinned ? "text-[#e2e2e2] hover:text-[#ababab]" : "text-[#474747] hover:text-[#ababab] opacity-0 group-hover:opacity-100"}`}
        >
          <PushPinSimpleIcon size={12} weight="fill" />
        </button>
      ) : (
        <div className="ml-1.5 w-4 shrink-0" />
      )} */}

      <div className="w-[106px] shrink-0 flex items-center gap-1">
        <span
          className={`text-[12px] font-medium truncate transition-colors cursor-default select-none ${showReset ? "text-[#e2e2e2] cursor-pointer" : textColor}`}
          onMouseEnter={handleLabelEnter}
          onMouseLeave={handleLabelLeave}
          onClick={() => {
            if (showReset) {
              onChange(defaultValue);
              setShowReset(false);
            }
          }}
        >
          {showReset ? "Reset" : label}
        </span>
        {!showReset && badge && (
          <div
            className="relative flex items-center justify-center shrink-0"
            onMouseEnter={() => setBadgeHovered(true)}
            onMouseLeave={() => setBadgeHovered(false)}
          >
            {BADGE_ICON[badge]}
            {badgeLabel && <Tooltip label={badgeLabel} visible={badgeHovered} position="bottom" />}
          </div>
        )}
      </div>

      <div className="flex-1 relative h-3 flex items-center">
        <div
          className={`w-full h-1 rounded-full relative overflow-hidden transition-colors ${isActive ? "bg-[#5e5e5e]" : "bg-[#474747]"}`}
        >
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-colors ${fillColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
        >
          <div className="bg-[#1c1c1c] rounded-full w-[8px] h-[18px] flex items-center justify-center">
            <div
              className={`rounded-full transition-[width,height,background-color] duration-150 ${handleColor} ${isActive ? "w-[4px] h-[14px]" : "w-[2px] h-3"}`}
            />
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => onChange(defaultValue)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>

      <span
        className={`w-[36px] text-[12px] font-medium text-right shrink-0 transition-colors ${textColor}`}
      >
        {value}
      </span>
    </div>
  );
};

export default SliderRow;
