import { Grid3X3, LayoutList, Filter, SlidersHorizontal, ImagePlus, Download } from "lucide-react";

const tabs = ["IMPORT", "CULL", "EDIT", "RETOUCH"] as const;

interface TopBarProps {
  activeTab: string;
}

const TopBar = ({ activeTab }: TopBarProps) => {
  return (
    <header className="flex items-center justify-between h-12 px-4 bg-surface-overlay border-b border-border">
      <div className="flex items-center gap-3">
        <button className="p-1.5 rounded bg-accent hover:bg-secondary transition-colors">
          <Grid3X3 className="w-4 h-4 text-foreground" />
        </button>
        <button className="p-1.5 rounded hover:bg-secondary transition-colors">
          <LayoutList className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button className="p-1.5 rounded hover:bg-secondary transition-colors">
          <Filter className="w-4 h-4 text-muted-foreground" />
        </button>
        <button className="p-1.5 rounded hover:bg-secondary transition-colors">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-secondary transition-colors text-sm text-muted-foreground">
          <ImagePlus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      <nav className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider rounded transition-colors ${
              tab === activeTab
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>
    </header>
  );
};

export default TopBar;
