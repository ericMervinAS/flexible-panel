interface RetouchingOpportunityBannerProps {
  visible: boolean;
  onRetouch: () => void;
}

const RetouchingOpportunityBanner = ({ visible, onRetouch }: RetouchingOpportunityBannerProps) => {
  return (
    <div
      className={`absolute left-4 right-4 z-20 transition-all duration-300 ${visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-1 pointer-events-none"
        }`}
      style={{ bottom: "calc(56px + 8px)" }}
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-[#f6f6f6] rounded-[4px] shadow-lg">
        <p className="flex-1 text-[12px] font-medium leading-[1.45] text-[#474747]">
          Aftershoot detected a few images that could benefit from retouching. Would you like to apply it now?
        </p>
        <button
          onClick={onRetouch}
          className="text-[12px] font-medium text-blue-500 hover:text-blue-400 transition-colors shrink-0 whitespace-nowrap pt-px"
        >
          Retouch Now
        </button>
      </div>
    </div>
  );
};

export default RetouchingOpportunityBanner;
