import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check, Minus } from "@phosphor-icons/react";

type CheckState = "checked" | "indeterminate" | "unchecked";

interface EditStatusFilterDropdownProps {
  onFilterChange: (values: Set<string>) => void;
  counts?: {
    retouched: number;
    aiRetouched: number;
    distractionRemoved: number;
    nonRetouched: number;
  };
}

const Checkbox = ({ state }: { state: CheckState }) => (
  <div
    className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${
      state !== "unchecked"
        ? "bg-[#2563eb] border-[#2563eb]"
        : "border-[#5e5e5e]"
    }`}
  >
    {state === "checked" && (
      <Check weight="bold" className="w-3 h-3 text-white" />
    )}
    {state === "indeterminate" && (
      <Minus weight="bold" className="w-3 h-3 text-white" />
    )}
  </div>
);

const EditStatusFilterDropdown = ({
  onFilterChange,
  counts,
}: EditStatusFilterDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  // "edited" / "nonEdited" are UI-only placeholders — not wired to any
  // actual filtering yet, since edit history isn't tracked in this prototype.
  const [placeholder, setPlaceholder] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  };

  const togglePlaceholder = (key: string) =>
    setPlaceholder((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const commit = (next: Set<string>) => {
    setSelected(next);
    onFilterChange(next);
  };

  const toggle = (key: string) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    commit(next);
  };

  const hasAi = selected.has("aiRetouched");
  const hasDist = selected.has("distractionRemoved");

  const retouchedState: CheckState = (() => {
    if (hasAi && hasDist) return "checked";
    if (!hasAi && !hasDist) return "unchecked";
    // Exactly one child is checked — if the other bucket is empty, the
    // checked child already covers every retouched image, so the parent
    // reads as fully checked rather than partial.
    const otherCount = hasAi
      ? (counts?.distractionRemoved ?? 0)
      : (counts?.aiRetouched ?? 0);
    return otherCount === 0 ? "checked" : "indeterminate";
  })();

  const toggleRetouched = () => {
    const next = new Set(selected);
    if (retouchedState === "checked") {
      next.delete("aiRetouched");
      next.delete("distractionRemoved");
    } else {
      next.add("aiRetouched");
      next.add("distractionRemoved");
    }
    commit(next);
  };

  const isActive = selected.size > 0;
  const activeCount = selected.size;

  const Row = ({
    label,
    state,
    onClick,
    indent = false,
    count,
  }: {
    label: string;
    state: CheckState;
    onClick: () => void;
    indent?: boolean;
    count?: number;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-[13px] text-left transition-colors hover:bg-white/5 ${
        indent ? "pl-7" : ""
      } ${state !== "unchecked" ? "text-[#e2e2e2]" : "text-[#ababab]"}`}
    >
      <Checkbox state={state} />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="text-[11px] text-[#777]">{count}</span>
      )}
    </button>
  );

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 px-2 py-1.5 rounded text-[12px] transition-colors ${
          open || isActive
            ? "text-white bg-white/10 border-[0.5px] border-[#5e5e5e]"
            : "text-[#ababab] hover:text-[#e2e2e2] hover:bg-white/5"
        }`}
      >
        <span>Edit Status</span>
        {isActive && (
          <span className="flex items-center justify-center min-w-[12px] px-[2px] rounded-[16px] bg-white text-[#474747] text-[11px] font-semibold tracking-[0.5px] leading-[12px]">
            {activeCount}
          </span>
        )}
        <CaretDown
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] flex flex-col gap-1 bg-[#242424] border border-[#474747] rounded-lg px-2 py-2"
            style={{ top: pos.top, left: pos.left, width: 240 }}
          >
            <Row
              label="Edited"
              state={placeholder.has("edited") ? "checked" : "unchecked"}
              onClick={() => togglePlaceholder("edited")}
            />
            <Row
              label="Non Edited"
              state={placeholder.has("nonEdited") ? "checked" : "unchecked"}
              onClick={() => togglePlaceholder("nonEdited")}
            />
            <div className="h-px bg-[#333] my-1" />
            <Row
              label="Retouched"
              state={retouchedState}
              onClick={toggleRetouched}
              count={counts?.retouched}
            />
            <Row
              label="AI Retouched"
              state={hasAi ? "checked" : "unchecked"}
              onClick={() => toggle("aiRetouched")}
              indent
              count={counts?.aiRetouched}
            />
            <Row
              label="Distraction Removed"
              state={hasDist ? "checked" : "unchecked"}
              onClick={() => toggle("distractionRemoved")}
              indent
              count={counts?.distractionRemoved}
            />
            <Row
              label="Non Retouched"
              state={selected.has("nonRetouched") ? "checked" : "unchecked"}
              onClick={() => toggle("nonRetouched")}
              count={counts?.nonRetouched}
            />
          </div>,
          document.body,
        )}
    </div>
  );
};

export default EditStatusFilterDropdown;
