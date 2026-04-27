import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVerticalIcon, CaretRight, ArrowCounterClockwise, NotePencil } from "@phosphor-icons/react";
import SliderRow from "./SliderRow";
import type { SliderDef } from "@/data/presetMapping";

interface SliderSectionProps {
  id: string;
  sectionIdx: number;
  title: string;
  sliders: readonly SliderDef[];
  values: number[];
  onSliderChange: (sliderIdx: number, value: number) => void;
  onReset: () => void;
  pinnedSliders: Set<string>;
  onTogglePin: (sliderIdx: number) => void;
}

const SliderSection = ({
  id,
  sectionIdx,
  title,
  sliders,
  values,
  onReset,
  onSliderChange,
  pinnedSliders,
  onTogglePin,
}: SliderSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex flex-col"
    >
      <div className="group/section flex items-center gap-2 h-6">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-3 h-3 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
        >
          <CaretRight
            size={12}
            className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
        </button>

        <span className="flex-1 text-[11px] font-semibold text-[#ababab] uppercase tracking-[0.5px]">{title}</span>

        <button
          onClick={onReset}
          className="w-4 h-4 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
        >
          <NotePencil size={16} />
        </button>

        <button
          onClick={onReset}
          className="w-4 h-4 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
        >
          <ArrowCounterClockwise size={16} />
        </button>

        <button
          {...attributes}
          {...listeners}
          className="w-4 h-4 flex items-center justify-center text-[#aaa] hover:text-[#777] transition-colors shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <DotsSixVerticalIcon size={14} />
        </button>
      </div>

      {isOpen && (
        <div className="pt-2.5 pb-2.5 flex flex-col gap-3">
          {sliders.map((slider, sliderIdx) => (
            <SliderRow
              key={slider.name}
              label={slider.name}
              badge={slider.badge}
              badgeLabel={slider.badgeLabel}
              value={values[sliderIdx]}
              onChange={(v) => onSliderChange(sliderIdx, v)}
              pinned={pinnedSliders.has(`${sectionIdx}:${sliderIdx}`)}
              onTogglePin={() => onTogglePin(sliderIdx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SliderSection;
