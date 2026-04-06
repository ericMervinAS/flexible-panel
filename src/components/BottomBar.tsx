import { Eye, LayoutGrid } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface BottomBarProps {
  columns: number;
  onColumnsChange: (cols: number) => void;
  totalPhotos: number;
  visiblePhotos: number;
  albumName: string;
}

const BottomBar = ({ columns, onColumnsChange, totalPhotos, visiblePhotos, albumName }: BottomBarProps) => {
  return (
    <footer className="flex items-center justify-between h-9 px-4 bg-surface-overlay border-t border-border text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="text-primary font-medium">{albumName}</span>
        <span>({totalPhotos})</span>
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          <span>{visiblePhotos} / {totalPhotos}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Slider
          value={[columns]}
          onValueChange={(v) => onColumnsChange(v[0])}
          min={2}
          max={6}
          step={1}
          className="w-28"
        />
        <LayoutGrid className="w-4 h-4" />
      </div>
    </footer>
  );
};

export default BottomBar;
