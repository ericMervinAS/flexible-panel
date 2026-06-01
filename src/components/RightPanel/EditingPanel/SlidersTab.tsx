import { useState } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import SliderSection from "../../SliderSection";

const SECTIONS: { title: string; sliders: { name: string }[] }[] = [
  {
    title: "White Balance",
    sliders: [{ name: "Temp" }, { name: "Tint" }],
  },
  {
    title: "Light",
    sliders: [
      { name: "Exposure" },
      { name: "Contrast" },
      { name: "Highlights" },
      { name: "Shadows" },
      { name: "Whites" },
      { name: "Blacks" },
    ],
  },
  {
    title: "Presence",
    sliders: [
      { name: "Texture" },
      { name: "Clarity" },
      { name: "Dehaze" },
      { name: "Vibrance" },
      { name: "Saturation" },
    ],
  },
];

const SlidersTab = () => {
  const [values, setValues] = useState<number[][]>(() =>
    SECTIONS.map((s) => s.sliders.map(() => 0))
  );
  const [sectionOrder, setSectionOrder] = useState<number[]>(() => SECTIONS.map((_, i) => i));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionOrder((prev) => {
      const oldIdx = prev.indexOf(Number(active.id));
      const newIdx = prev.indexOf(Number(over.id));
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleSliderChange = (sIdx: number, sliderIdx: number, v: number) => {
    setValues((prev) => {
      const next = prev.map((row) => [...row]);
      next[sIdx][sliderIdx] = v;
      return next;
    });
  };

  const handleReset = (sIdx: number) => {
    setValues((prev) => {
      const next = prev.map((row) => [...row]);
      next[sIdx] = SECTIONS[sIdx].sliders.map(() => 0);
      return next;
    });
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-5 pb-2 pt-4 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={sectionOrder.map(String)} strategy={verticalListSortingStrategy}>
          {sectionOrder.map((sIdx) => {
            const section = SECTIONS[sIdx];
            return (
              <SliderSection
                key={sIdx}
                id={String(sIdx)}
                sectionIdx={sIdx}
                title={section.title}
                sliders={section.sliders}
                values={values[sIdx]}
                onSliderChange={(sliderIdx, v) => handleSliderChange(sIdx, sliderIdx, v)}
                onReset={() => handleReset(sIdx)}
                pinnedSliders={new Set()}
                onTogglePin={() => {}}
              />
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default SlidersTab;
