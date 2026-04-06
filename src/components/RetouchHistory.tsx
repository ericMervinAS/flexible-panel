import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface RetouchHistoryEntry {
  id: number;
  photoCount: number;
  presets: { label: string; preset: string }[];
  objectsRemoved: { label: string; count: number }[];
}

interface RetouchHistoryProps {
  entries: RetouchHistoryEntry[];
}

const RetouchHistory = ({ entries }: RetouchHistoryProps) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set(entries.map((e) => e.id)));

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
      <h3 className="text-base font-normal text-[#e2e2e2]">AI Retouch History</h3>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const isOpen = expanded.has(entry.id);
          return (
            <div key={entry.id} className="flex flex-col gap-3">
              <button
                onClick={() => toggle(entry.id)}
                className="flex items-center gap-1.5 text-[13px] text-[#e2e2e2] leading-4 w-fit"
              >
                <span>Retouch {entry.id} ({entry.photoCount} Photos)</span>
                <ChevronDown
                  className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                />
              </button>

              {isOpen && (
                <div className="flex flex-col gap-3">
                  {entry.presets.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] text-[#ababab] leading-4">Presets:</span>
                      <div className="flex flex-col pl-4">
                        {entry.presets.map((p, i) => (
                          <span key={i} className="text-[13px] text-[#ababab] leading-4">
                            {p.label}: {p.preset}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {entry.objectsRemoved.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] text-[#ababab] leading-4">Objects Removed:</span>
                      <div className="flex flex-col pl-4">
                        {entry.objectsRemoved.map((o, i) => (
                          <span key={i} className="text-[13px] text-[#ababab] leading-4">
                            {o.label} ({o.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RetouchHistory;
