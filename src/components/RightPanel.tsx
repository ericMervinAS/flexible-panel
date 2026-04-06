import { useState, useRef } from "react";
import SubjectSync, { SubjectSyncState } from "./SubjectSync";
import SmartObjectRemoval, { SmartObjectState } from "./SmartObjectRemoval";
import RetouchHistory, { RetouchHistoryEntry } from "./RetouchHistory";

interface RightPanelProps {
  isScanning: boolean;
}

const RightPanel = ({ isScanning }: RightPanelProps) => {
  const [subjectActive, setSubjectActive] = useState(false);
  const [objectActive, setObjectActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [history, setHistory] = useState<RetouchHistoryEntry[]>([]);
  const [appliedPresets, setAppliedPresets] = useState<Record<string, string>>({});
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());

  const subjectStateRef = useRef<SubjectSyncState>({
    selectedSubjects: [],
    selectedGroups: [],
    presets: {},
    subjectCounts: [],
  });
  const objectStateRef = useRef<SmartObjectState>({ selectedWithCounts: [] });

  const isActive = subjectActive || objectActive;

  const handleStart = () => {
    const ss = subjectStateRef.current;
    const os = objectStateRef.current;

    const presets = [
      ...ss.selectedSubjects
        .filter((i) => !!ss.presets[`subject-${i}`])
        .map((i) => ({ label: `Subject ${i + 1}`, preset: ss.presets[`subject-${i}`]! })),
      ...ss.selectedGroups
        .filter((label) => !!ss.presets[`group-${label}`])
        .map((label) => ({ label, preset: ss.presets[`group-${label}`]! })),
    ];

    const photoCount = ss.selectedSubjects.reduce(
      (sum, i) => sum + (ss.subjectCounts[i] ?? 0),
      0
    );

    const entry: RetouchHistoryEntry = {
      id: history.length + 1,
      photoCount,
      presets,
      objectsRemoved: os.selectedWithCounts,
    };

    // Build persistent applied state from this run
    const newApplied: Record<string, string> = { ...appliedPresets };
    ss.selectedSubjects.forEach((i) => {
      const preset = ss.presets[`subject-${i}`];
      if (preset) newApplied[`subject-${i}`] = preset;
    });
    ss.selectedGroups.forEach((label) => {
      const preset = ss.presets[`group-${label}`];
      if (preset) newApplied[`group-${label}`] = preset;
    });

    const newRemoved = new Set(removedItems);
    os.selectedWithCounts.forEach(({ label }) => newRemoved.add(label));

    setIsProcessing(true);

    setTimeout(() => {
      setHistory((prev) => [...prev, entry]);
      setAppliedPresets(newApplied);
      setRemovedItems(newRemoved);
      setResetSignal((s) => s + 1);
      setIsProcessing(false);
    }, 3000);
  };

  return (
    <aside className="w-[344px] min-w-[344px] bg-[#1c1c1c] flex flex-col relative">
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pt-5">
        <SubjectSync
          isScanning={isScanning}
          disabled={isProcessing}
          resetSignal={resetSignal}
          appliedPresets={appliedPresets}
          onSelectionsChange={setSubjectActive}
          onStateChange={(s) => { subjectStateRef.current = s; }}
        />
        <div className="h-px bg-[#303030]" />
        <SmartObjectRemoval
          isScanning={isScanning}
          disabled={isProcessing}
          resetSignal={resetSignal}
          removedItems={removedItems}
          onResetItem={(label) =>
            setRemovedItems((prev) => {
              const next = new Set(prev);
              next.delete(label);
              return next;
            })
          }
          onSelectionsChange={setObjectActive}
          onStateChange={(s) => { objectStateRef.current = s; }}
        />
        {history.length > 0 && (
          <>
            <div className="h-px bg-[#303030]" />
            <RetouchHistory entries={history} />
          </>
        )}
      </div>
      <div className="p-4">
        <button
          disabled={isProcessing || !isActive}
          onClick={handleStart}
          className={`w-full py-2 rounded text-[12px] font-medium transition-colors ${
            isProcessing
              ? "bg-[#1d56d1] text-white cursor-not-allowed"
              : isActive
              ? "bg-[#2563eb] text-white hover:bg-[#1d56d1]"
              : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
          }`}
        >
          {isProcessing ? "Processing..." : "Start AI Retouching"}
        </button>
      </div>
    </aside>
  );
};

export default RightPanel;
