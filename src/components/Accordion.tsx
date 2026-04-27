import { useState } from "react";
import { CaretRight, PencilLine, ArrowCounterClockwise } from "@phosphor-icons/react";

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onEdit?: () => void;
  onReset?: () => void;
  actions?: React.ReactNode;
  dragHandle?: React.ReactNode;
}

const Accordion = ({ title, children, defaultOpen = true, onEdit, onReset, actions, dragHandle }: AccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 h-6">
        {dragHandle}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-3 h-3 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors shrink-0"
        >
          <CaretRight
            size={12}
            className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
        </button>
        {/* <span className="flex-1 text-[14px] text-[#e2e2e2] font-normal leading-5"> */}
        <span className="flex-1 text-[11px] font-semibold text-[#ababab] uppercase tracking-[0.5px]">{title}</span>
        {/* {title}
        </span> */}
        <div className="flex items-center gap-2 shrink-0">
          {actions ?? (
            <>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="w-4 h-4 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors"
                >
                  <PencilLine size={16} />
                </button>
              )}
              {onReset && (
                <button
                  onClick={onReset}
                  className="w-4 h-4 flex items-center justify-center text-[#777] hover:text-[#ababab] transition-colors"
                >
                  <ArrowCounterClockwise size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="pt-2.5 pb-2.5 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
