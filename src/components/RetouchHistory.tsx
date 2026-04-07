import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface RetouchHistoryEntry {
  id: number;
  photoCount: number;
  presets: { label: string; preset: string }[];
  objectsRemoved: { label: string; count: number }[];
  restoredObjects?: { label: string; count: number }[];
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
    <div className="px-5 flex flex-col gap-3">
      <h3 className="text-base font-normal text-[#e2e2e2]">AI Retouch History</h3>

      <div className="flex flex-col gap-2">
        {entries.map((entry) => {
          const isOpen = expanded.has(entry.id);
          return (
            <div key={entry.id} className="rounded-lg border border-[#2e2e2e] overflow-hidden">

              {/* Card header */}
              <button
                onClick={() => toggle(entry.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-[#242424] hover:bg-[#282828] transition-colors"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[#e2e2e2]">
                    {entry.restoredObjects?.length ? "Reset" : "Retouch"} {entry.id}
                  </span>
                  <span className="text-[11px] text-[#555]">{entry.photoCount} photos</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#555] shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                />
              </button>

              {/* Card body */}
              {isOpen && (
                <div className="flex flex-col divide-y divide-[#2e2e2e]">

                  {entry.presets.length > 0 && (
                    <div className="px-3 py-3 flex flex-col gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#555]">
                        Presets
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {entry.presets.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="text-[12px] text-[#777] shrink-0">{p.label}</span>
                            <span className="text-[12px] text-[#ababab] text-right">{p.preset}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.objectsRemoved.length > 0 && (
                    <div className="px-3 py-3 flex flex-col gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#555]">
                        Objects Removed
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {entry.objectsRemoved.map((o, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="text-[12px] text-[#777]">{o.label}</span>
                            <span className="text-[12px] text-[#ababab]">{o.count} photos</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.restoredObjects && entry.restoredObjects.length > 0 && (
                    <div className="px-3 py-3 flex flex-col gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#555]">
                        Objects Restored
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {entry.restoredObjects.map((o, i) => (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <span className="text-[12px] text-[#777]">{o.label}</span>
                            <span className="text-[12px] text-[#ababab]">{o.count} photos</span>
                          </div>
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
