import { useState } from "react";
import { PushPinIcon, StarFourIcon, FlaskIcon, ArrowFatLineUpIcon } from "@phosphor-icons/react";
import type { BadgeType } from "@/data/presetMapping";
import Tooltip from "./Tooltip";

const BADGE_ICON: Record<BadgeType, React.ReactNode> = {
  new: <StarFourIcon size={12} weight="fill" className="text-yellow-500 hover:text-yellow-400" />,
  beta: <FlaskIcon size={12} weight="fill" className=" text-yellow-500 hover:text-yellow-400" />,
  improved: <ArrowFatLineUpIcon size={12} weight="fill" className="text-yellow-500 hover:text-yellow-400" />,
};

interface SliderRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  badge?: BadgeType;
  badgeLabel?: string;
}

const SliderRow = ({ label, value, min = 0, max = 100, onChange, pinned, onTogglePin, badge, badgeLabel }: SliderRowProps) => {
  const pct = ((value - min) / (max - min)) * 100;
  const [badgeHovered, setBadgeHovered] = useState(false);
  return (
    <div className="group flex items-center">
      {/* {onTogglePin ? (
        <button
          onClick={onTogglePin}
          className={`mr-1.5 w-4 h-4 flex items-center justify-center transition-colors shrink-0 ${pinned ? "text-[#e2e2e2]" : "text-[#474747] opacity-0 group-hover:opacity-100"}`}
        >
          <PushPinIcon size={12} weight="fill" />
        </button>
      ) : (
        <div className="ml-1.5 w-4 shrink-0" />
      )} */}

      <div className="w-[106px] shrink-0 flex items-center gap-1">
        <span className="text-[12px] font-medium text-[#777] truncate">
          {label}
        </span>
        {badge && (
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
        <div className="w-full h-1 bg-[#474747] rounded-full relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[#777]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{ left: `calc(${pct}% - 4px)` }}
        >
          <div className="bg-[#1c1c1c] rounded-full p-[2px]">
            <div className="w-[2px] h-3 bg-[#474747] rounded-full" />
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>

      <span className="w-[36px] text-[12px] font-medium text-[#777] text-right shrink-0">
        {value}
      </span>
    </div>
  );
};

export default SliderRow;
