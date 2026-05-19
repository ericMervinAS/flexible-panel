import { PushPin } from "@phosphor-icons/react";
import { SECTIONS } from "@/data/presetMapping";
import SliderRow from "./SliderRow";

interface PinnedSlidersCardProps {
  pinnedSliders: Set<string>;
  onTogglePin: (sIdx: number, sliderIdx: number) => void;
  getValue: (sIdx: number, sliderIdx: number) => number;
  onChange: (sIdx: number, sliderIdx: number, v: number) => void;
}

const PinnedSlidersCard = ({
  pinnedSliders,
  onTogglePin,
  getValue,
  onChange,
}: PinnedSlidersCardProps) => {
  if (pinnedSliders.size === 0) return null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 h-6">
        <div className="w-3 h-3 flex items-center justify-center shrink-0">
          <PushPin size={12} weight="fill" className="text-[#777]" />
        </div>
        <span className="flex-1 text-[11px] font-semibold text-[#ababab] uppercase tracking-[0.5px]">
          Favorite Sliders
        </span>
      </div>
      <div className="pt-2.5 pb-2.5 flex flex-col gap-3">
        {Array.from(pinnedSliders).map((key) => {
          const [sIdx, sliderIdx] = key.split(":").map(Number);
          const section = SECTIONS[sIdx];
          if (!section?.sliders[sliderIdx]) return null;
          return (
            <SliderRow
              key={key}
              label={section.sliders[sliderIdx].name}
              value={getValue(sIdx, sliderIdx)}
              onChange={(v) => onChange(sIdx, sliderIdx, v)}
              pinned
              onTogglePin={() => onTogglePin(sIdx, sliderIdx)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PinnedSlidersCard;
