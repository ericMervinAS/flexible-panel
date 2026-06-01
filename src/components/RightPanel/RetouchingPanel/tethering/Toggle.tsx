interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

export const Toggle = ({ value, onChange }: ToggleProps) => (
  <button onClick={(e) => { e.stopPropagation(); onChange(!value); }} className="shrink-0">
    <div
      className="relative w-8 h-[18px] rounded-full transition-colors"
      style={{ backgroundColor: value ? "#2563eb" : "#383838" }}
    >
      <div
        style={{ transform: value ? "translateX(16px)" : "translateX(2px)" }}
        className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform"
      />
    </div>
  </button>
);
