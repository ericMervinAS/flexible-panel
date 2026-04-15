import { useState } from "react";
import { Flag, Star, CaretDown } from "@phosphor-icons/react";

const COLOR_TAGS = [
  { label: "Green",  color: "#22c55e" },
  { label: "Blue",   color: "#3b82f6" },
  { label: "Yellow", color: "#eab308" },
  { label: "Red",    color: "#ef4444" },
  { label: "Purple", color: "#a855f7" },
  { label: "Gray",   color: "#71717a" },
];

const RIGHT_DROPDOWNS = ["File Type", "Orientation", "Capture Info", "Other"];

const Divider = () => <div className="w-px h-4 bg-[#303030] shrink-0" />;

const DropdownButton = ({ label }: { label: string }) => (
  <button className="flex items-center gap-1 px-2 py-1.5 rounded text-[12px] text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5 transition-colors">
    <span>{label}</span>
    <CaretDown className="w-3 h-3 shrink-0" />
  </button>
);

const StarRow = ({ count }: { count: number }) => (
  <div className="flex items-center gap-[1px]">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} weight={i < count ? "fill" : "regular"} className={`w-[9px] h-[9px] ${i < count ? "text-[#e2e2e2]" : "text-[#474747]"}`} />
    ))}
  </div>
);

const FilterBar = () => {
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
                <StarRow count={n} />
              </button>
            );
          })}
        </div>

        <Divider />

        {/* People */}
        <DropdownButton label="People" />
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
