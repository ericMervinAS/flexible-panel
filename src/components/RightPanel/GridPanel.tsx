import { useState, useRef } from "react";
import SubjectSync, { SubjectSyncState } from "../SubjectSync";
import SmartObjectRemoval, { SmartObjectState } from "../SmartObjectRemoval";
import { RetouchHistoryEntry } from "../RetouchHistory";
import type { ModelSubject } from "@/hooks/useFaceDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";

interface GridPanelProps {
  isScanning: boolean;
  appliedPresets: Record<string, string>;
  removedItems: Set<string>;
  onAppliedPresetsChange: (presets: Record<string, string>) => void;
  onRemovedItemsSet: (items: Set<string>) => void;
  onResetRemovedItem: (label: string) => void;
  distractionMap?: Map<number, DistractionDetection[]>;
  isDistractionScanning?: boolean;
  onDistractionRerun?: () => void;
  visibleSubjectIndices?: Set<number> | null;
  modelSubjects?: ModelSubject[];
  isModelDetecting?: boolean;
  modelStatusMessage?: string;
  modelSubjectFilter?: number[];
  onSuggestObject?: (suggestion: string) => void;
}

const GridPanel = ({
  isScanning,
  appliedPresets,
  removedItems,
  onAppliedPresetsChange,
  onRemovedItemsSet,
  onResetRemovedItem,
  distractionMap,
  isDistractionScanning = false,
  onDistractionRerun,
  visibleSubjectIndices,
  modelSubjects,
  isModelDetecting,
  modelStatusMessage,
  modelSubjectFilter,
  onSuggestObject,
}: GridPanelProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [subjectActive, setSubjectActive] = useState(false);
  const [objectActive, setObjectActive] = useState(false);
  const [history, setHistory] = useState<RetouchHistoryEntry[]>([]);

  const subjectStateRef = useRef<SubjectSyncState>({
    selectedSubjects: [],
    selectedGroups: [],
    presets: {},
    subjectCounts: [],
    selectedModelSubjects: [],
    modelPresets: {},
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
      ...(ss.selectedModelSubjects ?? [])
        .filter((id) => !!(ss.modelPresets?.[`model-${id}`]))
        .map((id) => ({ label: `Person ${id + 1}`, preset: ss.modelPresets![`model-${id}`]! })),
    ];

    const subjectPhotoCount = ss.selectedSubjects.reduce(
      (sum, i) => sum + (ss.subjectCounts[i] ?? 0), 0
    );
    const modelPhotoCount = (ss.selectedModelSubjects ?? []).reduce(
      (sum, id) => sum + (modelSubjects?.find((s) => s.id === id)?.photoCount ?? 0), 0
    );
    const objectPhotoCount = os.selectedWithCounts.reduce((sum, o) => sum + o.count, 0);
    const photoCount = subjectPhotoCount + modelPhotoCount + objectPhotoCount;

    const entry: RetouchHistoryEntry = {
      id: history.length + 1,
      photoCount,
      presets,
      objectsRemoved: os.selectedWithCounts,
    };

    const newApplied: Record<string, string> = { ...appliedPresets };
    ss.selectedSubjects.forEach((i) => {
      const preset = ss.presets[`subject-${i}`];
      if (preset) newApplied[`subject-${i}`] = preset;
    });
    ss.selectedGroups.forEach((label) => {
      const preset = ss.presets[`group-${label}`];
      if (preset) newApplied[`group-${label}`] = preset;
    });
    (ss.selectedModelSubjects ?? []).forEach((id) => {
      const preset = ss.modelPresets?.[`model-${id}`];
      if (preset) newApplied[`model-${id}`] = preset;
    });

    const newRemoved = new Set(removedItems);
    os.selectedWithCounts.forEach(({ label }) => newRemoved.add(label));

    setIsProcessing(true);
    setTimeout(() => {
      setHistory((prev) => [...prev, entry]);
      onAppliedPresetsChange(newApplied);
      onRemovedItemsSet(newRemoved);
      setResetSignal((s) => s + 1);
      setIsProcessing(false);
    }, 3000);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="py-5">
          <SubjectSync
            isScanning={isScanning}
            disabled={isProcessing}
            resetSignal={resetSignal}
            appliedPresets={appliedPresets}
            visibleSubjectIndices={visibleSubjectIndices}
            onSelectionsChange={setSubjectActive}
            onStateChange={(s) => { subjectStateRef.current = s; }}
            modelSubjects={modelSubjects}
            isModelDetecting={isModelDetecting}
            modelStatusMessage={modelStatusMessage}
            modelSubjectFilter={modelSubjectFilter}
          />
        </div>
        <div className="h-px bg-background" />
        <div className="py-5">
          <SmartObjectRemoval
            isScanning={isDistractionScanning}
            disabled={isProcessing}
            resetSignal={resetSignal}
            removedItems={removedItems}
            distractionMap={distractionMap}
            onRerun={onDistractionRerun}
            onReport={() => console.log('[DistractionDetection] User reported a missed detection')}
            onSuggestSubmit={onSuggestObject}
            onResetItem={onResetRemovedItem}
            onResetConfirmed={(label, count) =>
              setHistory((prev) => [
                ...prev,
                {
                  id: prev.length + 1,
                  photoCount: count,
                  presets: [],
                  objectsRemoved: [],
                  restoredObjects: [{ label, count }],
                },
              ])
            }
            onSelectionsChange={setObjectActive}
            onStateChange={(s) => { objectStateRef.current = s; }}
          />
        </div>
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
    </div>
  );
};

export default GridPanel;
