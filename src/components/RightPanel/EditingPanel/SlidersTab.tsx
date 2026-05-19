import { useSessionState } from "@/hooks/useSessionState";
import PinnedSlidersCard from "../../PinnedSlidersCard";

const SlidersTab = () => {
  const [pinnedSliders, setPinnedSliders] = useSessionState<Set<string>>(
    "subjectTab:pinnedSliders",
    new Set(),
    { serialize: (s) => [...s], deserialize: (a) => new Set(a as string[]) }
  );
  const [favValues, setFavValues] = useSessionState<Record<string, number>>(
    "favorites:values",
    {}
  );

  const togglePin = (sIdx: number, sliderIdx: number) => {
    const key = `${sIdx}:${sliderIdx}`;
    setPinnedSliders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
      style={{ scrollbarWidth: "none" }}
    >
      {pinnedSliders.size === 0 ? (
        <div className="flex-1 flex items-end justify-center pb-8 text-[#474747] text-[13px]">
          Pin sliders from the Retouch tab to see them here
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <PinnedSlidersCard
            pinnedSliders={pinnedSliders}
            onTogglePin={togglePin}
            getValue={(sIdx, sliderIdx) => favValues[`${sIdx}:${sliderIdx}`] ?? 0}
            onChange={(sIdx, sliderIdx, v) =>
              setFavValues((prev) => ({ ...prev, [`${sIdx}:${sliderIdx}`]: v }))
            }
          />
        </div>
      )}
    </div>
  );
};

export default SlidersTab;
