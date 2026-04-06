import { useState } from "react";
import SubjectSync from "./SubjectSync";
import SmartObjectRemoval from "./SmartObjectRemoval";

interface RightPanelProps {
  isScanning: boolean;
}

const RightPanel = ({ isScanning }: RightPanelProps) => {
  const [subjectActive, setSubjectActive] = useState(false);
  const [objectActive, setObjectActive] = useState(false);

  const isActive = subjectActive || objectActive;

  return (
    <aside className="w-[344px] min-w-[344px] bg-[#1c1c1c] flex flex-col relative">
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pt-5">
        <SubjectSync isScanning={isScanning} onSelectionsChange={setSubjectActive} />
        <div className="h-px bg-[#303030]" />
        <SmartObjectRemoval isScanning={isScanning} onSelectionsChange={setObjectActive} />
      </div>
      <div className="p-4">
        <button
          className={`w-full py-2 rounded text-[12px] font-medium transition-colors ${
            isActive
              ? "bg-[#2563eb] text-white hover:bg-[#1d56d1]"
              : "bg-[#1e2a45] text-[#474747] cursor-not-allowed"
          }`}
        >
          Start AI Retouching
        </button>
      </div>
    </aside>
  );
};

export default RightPanel;
