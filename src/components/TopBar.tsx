import { Grid3X3, LayoutList, Filter, SlidersHorizontal, ImagePlus, Download } from "lucide-react";

const tabs = ["IMPORT", "CULL", "EDIT", "RETOUCH"] as const;

interface TopBarProps {
  activeTab: string;
}

const TopBar = ({ activeTab }: TopBarProps) => {
  return (
    <header className="flex items-center justify-between h-11 px-3 bg-[#1c1c1c] shrink-0">
      {/* Left: Views + Filter + Add */}
      <div className="flex items-center gap-2.5 w-[400px]">
        <div className="flex items-center gap-1">
          <button className="flex items-center justify-center w-6 h-6 rounded bg-white/10 border border-[#5e5e5e]">
            <Grid3X3 className="w-4 h-4 text-[#e2e2e2]" />
          </button>
          <button className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors">
            <LayoutList className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        <div className="w-px h-4 bg-[#303030]" />

        <div className="flex items-center gap-1">
          <button className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors">
            <Filter className="w-4 h-4 text-[#777]" />
          </button>
          <button className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors">
            <SlidersHorizontal className="w-4 h-4 text-[#777]" />
          </button>
        </div>

        <div className="w-px h-4 bg-[#303030]" />

        <button className="flex items-center gap-1 text-[#ababab] text-[12px] font-medium hover:text-[#e2e2e2] transition-colors">
          <ImagePlus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Center: Feature Switcher */}
      <div className="flex items-center bg-[#111] rounded p-[2px]">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`w-20 h-7 text-[11px] font-semibold tracking-[0.5px] rounded transition-colors ${
              tab === activeTab
                ? "bg-[#303030] text-[#e2e2e2]"
                : "text-[#777] hover:text-[#ababab]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Right: Export */}
      <div className="flex items-center justify-end w-[400px]">
        <button className="flex items-center gap-1 pl-2 pr-3 py-2 bg-[#303030] rounded text-[12px] font-medium text-[#e2e2e2] hover:bg-[#3a3a3a] transition-colors">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
