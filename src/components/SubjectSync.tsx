import { Sparkles, Eye, Plus } from "lucide-react";
import subject1 from "@/assets/subject-1.png";
import subject2 from "@/assets/subject-2.png";
import subject3 from "@/assets/subject-3.png";
import subject4 from "@/assets/subject-4.png";

const groups = [
  { label: "All Subjects", active: false },
  { label: "Masculine", active: false },
  { label: "Feminine", active: false },
  { label: "Elderly", active: false },
  { label: "Child", active: false },
];

const subjects = [
  { avatar: subject1, count: 562 },
  { avatar: subject2, count: 560 },
  { avatar: subject3, count: 250 },
  { avatar: subject4, count: 200 },
];

interface SubjectSyncProps {
  isScanning: boolean;
}

const SubjectSync = ({ isScanning }: SubjectSyncProps) => {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-foreground">Subject Sync</h3>
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-success text-success-foreground">
          New
        </span>
        {isScanning && (
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Apply presets on subjects identified across the entire album
      </p>

      {!isScanning && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {groups.map((g) => (
              <button
                key={g.label}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-border text-secondary-foreground hover:bg-accent transition-colors"
              >
                {g.label}
                <Plus className="w-3 h-3" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {subjects.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors cursor-pointer">
                  <img
                    src={s.avatar}
                    alt={`Subject ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{s.count}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1">
              <button className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-foreground transition-colors cursor-pointer">
                <Eye className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-muted-foreground">View More</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SubjectSync;
