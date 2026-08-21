import { X } from "@phosphor-icons/react";

// Format a label list naturally: one → "A"; two → "A and B"; three+ → "A, B and C".
const formatLabels = (labels: string[]): string => {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

interface BatchRemovalOfferProps {
  /** UI labels that were just removed on the current image. */
  labels: string[];
  /** Called to tear down the offer (X or "Not now"). */
  onDismiss: () => void;
  /** Switch the app back to the grid view, where the user can scan and remove
   *  the same distraction(s) across the rest of the album. Receives the labels
   *  so the grid can preselect them instead of showing them as already removed. */
  onGoToGrid?: (labels: string[]) => void;
}

/**
 * Album-wide batch-removal offer card. Pinned just above the panel footer by its
 * host (RightPanel). Points the user at the grid to scan for and remove the same
 * distraction elsewhere, rather than guessing at how many other photos have it.
 */
// const BatchRemovalOffer = ({ labels, onDismiss, onGoToGrid }: BatchRemovalOfferProps) => {
//   return (
//     <div className="rounded-[10px] bg-[#242424] border border-[#303030] p-3 shadow-lg">
//       <div className="flex flex-col gap-2.5">
//         <div className="flex items-start gap-2">
//           <div className="flex flex-col gap-0.5 min-w-0 flex-1">
//             <p className="text-[13px] font-semibold text-[#e2e2e2] leading-5">
//               Remove more such distractions?
//             </p>
//             <p className="text-[12px] font-normal text-[#ababab] leading-4">
//               Scan the album to see where {formatLabels(labels)} appear, then remove them everywhere in one go.
//             </p>
//           </div>
//           <button
//             onClick={onDismiss}
//             title="Dismiss"
//             className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors"
//           >
//             <X className="w-3.5 h-3.5 text-[#777]" />
//           </button>
//         </div>
//         <div className="flex items-center gap-2">
//           <button
//             onClick={() => {
//               onGoToGrid?.(labels);
//               onDismiss();
//             }}
//             className="flex items-center justify-center h-8 px-3 rounded bg-[#2563eb] hover:bg-[#1d56d1] text-[12px] font-medium text-white transition-colors"
//           >
//             Scan the album
//           </button>
//           <button
//             onClick={onDismiss}
//             className="flex items-center justify-center h-8 px-3 rounded bg-[#303030] hover:bg-[#3a3a3a] text-[12px] font-medium text-[#e2e2e2] transition-colors"
//           >
//             Not now
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

export default BatchRemovalOffer;
