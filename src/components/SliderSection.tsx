import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, CaretRight, ArrowCounterClockwise } from "@phosphor-icons/react";
import SliderRow from "./SliderRow";

interface SliderSectionProps {
  id: string;
  sectionIdx: number;
  title: string;
  sliders: readonly string[];
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
      <div className="flex items-center gap-2 h-6">
        <button
          {...attributes}
          {...listeners}
          className="w-4 h-4 flex items-center justify-center text-[#474747] hover:text-[#777] transition-colors shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <DotsSixVertical size={14} />
        </button>

        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-3 h-3 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
        >
          <CaretRight
            size={12}
            className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
        </button>

        <span className="flex-1 text-[14px] font-normal text-[#e2e2e2]">{title}</span>

        <button
          onClick={onReset}
          className="w-4 h-4 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
        >
          <ArrowCounterClockwise size={16} />
        </button>
      </div>

      {isOpen && (
        <div className="pt-2.5 pb-2.5 flex flex-col gap-3">
          {sliders.map((label, sliderIdx) => (
            <SliderRow
              key={label}
              label={label}
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
