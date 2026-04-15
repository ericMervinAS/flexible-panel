interface TooltipProps {
  label: string;
  visible: boolean;
  prefix?: string;
  position?: "top" | "bottom";
}

const Tooltip = ({ label, visible, prefix, position = "bottom" }: TooltipProps) => {
  const slideHidden = position === "bottom" ? "-translate-y-1" : "translate-y-1";

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none transition-all duration-150 ${
        position === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
      } ${visible ? `opacity-100 translate-y-0` : `opacity-0 ${slideHidden}`}`}
      style={visible ? { transitionDelay: "300ms" } : { transitionDelay: "0ms" }}
    >
      <span className="whitespace-nowrap px-[6px] py-[4px] text-[11px] text-[#474747] bg-[#f6f6f6] rounded-[4px] flex gap-1">
        {prefix && <span className="font-semibold">{prefix}</span>}
        <span className="font-medium">{label}</span>
      </span>
    </div>
  );
};

export default Tooltip;
