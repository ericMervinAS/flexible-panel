import { useState } from "react";
import { ChevronRight, PenLine, RotateCcw } from "lucide-react";

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onEdit?: () => void;
  onReset?: () => void;
  actions?: React.ReactNode;
}

const Accordion = ({ title, children, defaultOpen = true, onEdit, onReset, actions }: AccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 h-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-3 h-3 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
        >
          <ChevronRight
            size={12}
            className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
        </button>
        <span className="flex-1 text-[14px] text-[#e2e2e2] font-normal leading-5">
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {actions ?? (
            <>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="w-4 h-4 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors"
                >
                  <PenLine size={16} />
                </button>
              )}
              {onReset && (
                <button
                  onClick={onReset}
                  className="w-4 h-4 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="pt-2.5 pb-2.5 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
