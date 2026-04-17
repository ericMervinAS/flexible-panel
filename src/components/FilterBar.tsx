import { useState } from "react";
import { Flag, CaretDown } from "@phosphor-icons/react";
import star0 from "../assets/stars/Star 0.png";
import star1 from "../assets/stars/Star 1.png";
import star2 from "../assets/stars/Star 2.png";
import star3 from "../assets/stars/Star 3.png";
import star4 from "../assets/stars/Star 4.png";
import star5 from "../assets/stars/Star 5.png";
import PeopleFilterDropdown from "./PeopleFilterDropdown";

const COLOR_TAGS = [
  { label: "Green", color: "#22c55e" },
  { label: "Blue", color: "#3b82f6" },
  { label: "Yellow", color: "#eab308" },
  { label: "Red", color: "#ef4444" },
  { label: "Purple", color: "#a855f7" },
  { label: "Gray", color: "#71717a" },
];

const RIGHT_DROPDOWNS = ["File Type", "Orientation", "Capture Info", "Other"];


const Divider = () => <div className="w-px h-4 bg-[#303030] shrink-0" />;

const DropdownButton = ({ label }: { label: string }) => (
  <button className="flex items-center gap-1 px-2 py-1.5 rounded text-[12px] text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5 transition-colors">
    <span>{label}</span>
    <CaretDown className="w-3 h-3 shrink-0" />
  </button>
);

const STAR_IMAGES = [star0, star1, star2, star3, star4, star5];

const StarRatingIcon = ({ count }: { count: number }) => (
  <img src={STAR_IMAGES[count]} alt={`${count} stars`} className="w-4 h-4" />
);

interface FilterBarProps {
  onPeopleFilter: (subjectIndices: number[]) => void;
}

const FilterBar = ({ onPeopleFilter }: FilterBarProps) => {
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedStars, setSelectedStars] = useState<Set<number>>(new Set());
  const toggleFlag = (flag: string) =>
    setSelectedFlags((prev) => { const s = new Set(prev); s.has(flag) ? s.delete(flag) : s.add(flag); return s; });

  const toggleColor = (label: string) =>
    setSelectedColors((prev) => { const s = new Set(prev); s.has(label) ? s.delete(label) : s.add(label); return s; });

  const toggleStar = (n: number) =>
    setSelectedStars((prev) => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });

  const iconBtn = (active: boolean) =>
    `flex items-center justify-center w-6 h-6 rounded transition-colors ${active ? "bg-white/10 border border-[#5e5e5e] text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab] hover:bg-white/5"}`;

  return (
    <div className="flex items-center justify-between h-10 px-2 bg-[#1c1c1c] border-b border-[#242424] shrink-0">
      {/* Left */}
      <div className="flex items-center gap-1.5">
        {/* Flags */}
        <div className="flex items-center gap-1">
          <button onClick={() => toggleFlag("picked")} className={iconBtn(selectedFlags.has("picked"))} title="Picked">
            <Flag weight="fill" className="w-4 h-4" />
          </button>
          <button onClick={() => toggleFlag("unpicked")} className={iconBtn(selectedFlags.has("unpicked"))} title="Unpicked">
            <Flag className="w-4 h-4" />
          </button>
        </div>

        <Divider />

        {/* Color tags */}
        <div className="flex items-center gap-0.5">
          {COLOR_TAGS.map(({ label, color }) => {
            const active = selectedColors.has(label);
            return (
              <button
                key={label}
                onClick={() => toggleColor(label)}
                title={label}
                className={`w-5 h-5 flex items-center justify-center rounded transition-all ${active ? "bg-white/10" : "hover:bg-white/5"}`}
              >
                <div
                  className="w-3 h-3 rounded-full transition-all"
                  style={{
                    backgroundColor: color,
                    opacity: active ? 1 : 0.5,
                    boxShadow: active ? `0 0 0 1.5px ${color}40` : "none",
                  }}
                />
              </button>
            );
          })}
        </div>

        <Divider />

        {/* Star ratings */}
        <div className="flex items-center gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((n) => {
            const active = selectedStars.has(n);
            return (
              <button
                key={n}
                onClick={() => toggleStar(n)}
                title={`${n} star${n !== 1 ? "s" : ""}`}
                className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${active ? "bg-white/10 border border-[#5e5e5e]" : "hover:bg-white/5"}`}
              >
                <StarRatingIcon count={n} />
              </button>
            );
          })}
        </div>

        <Divider />

        {/* People */}
        <PeopleFilterDropdown onFilterChange={onPeopleFilter} />
      </div>

      {/* Right */}
      <div className="flex items-center gap-0.5">
        {RIGHT_DROPDOWNS.map((label) => (
          <DropdownButton key={label} label={label} />
        ))}
      </div>
    </div>
  );
};

export default FilterBar;
