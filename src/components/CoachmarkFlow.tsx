import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

export const COACHMARK_KEY = "as_tethering_coachmarks_seen";

// In-memory flag — intentionally not persisted so a reload always re-shows coachmarks
let _coachmarksSeen = false;
export const getCoachmarksSeen = () => _coachmarksSeen;
export const setCoachmarksSeen = () => {
  _coachmarksSeen = true;
};

// ── Welcome step features ─────────────────────────────────────────────────────

const WELCOME_FEATURES = [
  "Edit & Retouch on every shot",
  "Camera settings, always visible",
  "Space bar captures too",
] as const;

const TOTAL_STEPS = 4; // welcome + 3 tooltip steps

// ── Shared primitives ─────────────────────────────────────────────────────────

// Beak points right — sits on the right edge of the card
const BeakRight = () => (
  <svg
    className="absolute pointer-events-none"
    style={{ right: -9, top: "50%", transform: "translateY(-50%)" }}
    width="9"
    height="16"
    viewBox="0 0 9 16"
    fill="none"
  >
    <path d="M0 0 L9 8 L0 16 Z" fill="rgba(0,0,0,0.10)" />
    <path d="M0 1 L8 8 L0 15 Z" fill="white" />
  </svg>
);

// Beak points left — sits on the left edge of the card
const BeakLeft = () => (
  <svg
    className="absolute pointer-events-none"
    style={{ left: -9, top: "50%", transform: "translateY(-50%)" }}
    width="9"
    height="16"
    viewBox="0 0 9 16"
    fill="none"
  >
    <path d="M9 0 L0 8 L9 16 Z" fill="rgba(0,0,0,0.10)" />
    <path d="M9 1 L1 8 L9 15 Z" fill="white" />
  </svg>
);

const StepDots = ({ current }: { current: number }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <div
        key={i}
        className={`rounded-full transition-all duration-200 ${
          i === current ? "w-5 h-1.5 bg-blue-500" : "w-1.5 h-1.5 bg-[#d4d4d8]"
        }`}
      />
    ))}
  </div>
);

const Card = ({
  children,
  style,
  width = 280,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
  width?: number;
}) => (
  <div style={{ position: "fixed", zIndex: 50, ...style }}>
    <div
      className="relative bg-white rounded-xl p-4 flex flex-col gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.22)]"
      style={{ width, border: "0.5px solid rgba(0,0,0,0.08)" }}
    >
      {children}
    </div>
  </div>
);

// Shared tooltip card body
const TooltipBody = ({
  title,
  body,
  step,
  isLast,
  beak,
  onPrev,
  onNext,
  onDismiss,
}: {
  title: string;
  body: string;
  step: number;
  isLast: boolean;
  beak: "right" | "left" | null;
  onPrev: () => void;
  onNext: () => void;
  onDismiss: () => void;
}) => (
  <>
    {beak === "right" && <BeakRight />}
    {beak === "left" && <BeakLeft />}

    <div className="flex items-start gap-2">
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <p className="text-[#1a1a1a] text-[15px] font-semibold leading-5">{title}</p>
        <p className="text-[#71717a] text-[13px] leading-[18px]">{body}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 transition-colors mt-0.5"
      >
        <X className="w-3.5 h-3.5 text-[#a1a1aa]" />
      </button>
    </div>

    <div className="flex items-center justify-between gap-2">
      <StepDots current={step} />
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          className="px-3 py-1.5 rounded text-[13px] font-medium text-[#3b82f6] bg-[rgba(37,99,235,0.10)] hover:bg-[rgba(37,99,235,0.16)] transition-colors"
        >
          Previous
        </button>
        <button
          onClick={isLast ? onDismiss : onNext}
          className="px-3 py-1.5 rounded text-[13px] font-medium text-white bg-[#2563eb] hover:bg-[#1d56d1] transition-colors"
        >
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  </>
);

// ── Main component ────────────────────────────────────────────────────────────

interface CoachmarkFlowProps {
  onDismiss: () => void;
}

const CoachmarkFlow = ({ onDismiss }: CoachmarkFlowProps) => {
  const [step, setStep] = useState(0);
  const [captureRect, setCaptureRect] = useState<DOMRect | null>(null);
  const [editRect, setEditRect] = useState<DOMRect | null>(null);
  const [retouchRect, setRetouchRect] = useState<DOMRect | null>(null);

  // Re-measure anchor elements whenever step changes
  useEffect(() => {
    requestAnimationFrame(() => {
      const captureEl = document.querySelector('[data-coachmark="capture-btn"]');
      if (captureEl) setCaptureRect(captureEl.getBoundingClientRect());

      const editEl = document.querySelector('[data-coachmark="edit-profile"]');
      if (editEl) setEditRect(editEl.getBoundingClientRect());

      const retouchEl = document.querySelector('[data-coachmark="retouch-preset"]');
      if (retouchEl) setRetouchRect(retouchEl.getBoundingClientRect());
    });
  }, [step]);

  const dismiss = () => {
    setCoachmarksSeen();
    onDismiss();
  };

  const prev = () => setStep((s) => s - 1);
  const next = () => setStep((s) => s + 1);

  // ── Step 0: Welcome ───────────────────────────────────────────────────────

  if (step === 0) {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(17,17,17,0.85)" }}
      >
        <div
          className="w-[296px] bg-white rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
          style={{ border: "0.5px solid rgba(0,0,0,0.06)" }}
        >
          {/* Blue accent bar */}
          <div className="h-[3px] bg-gradient-to-r from-blue-500 to-blue-400" />

          <div className="p-5 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-[#111] text-[16px] font-semibold leading-[22px]">
                  Welcome to Tethered Shooting
                </p>
                <p className="text-[#71717a] text-[13px] leading-[18px]">
                  Your camera, your canvas — live.
                </p>
              </div>
              <button
                onClick={dismiss}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-[#a1a1aa]" />
              </button>
            </div>

            {/* Feature rows */}
            <div className="flex flex-col gap-1.5">
              {WELCOME_FEATURES.map((text) => (
                <div
                  key={text}
                  className="flex items-center gap-3 bg-[#f4f7ff] rounded-lg px-3 py-2.5"
                >
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[13px] font-medium text-[#1a1a1a] leading-none">
                    {text}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <StepDots current={0} />
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-[#2563eb] hover:bg-[#1d56d1] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const isLast = step === TOTAL_STEPS - 1;

  // ── Step 1: Capture button — spotlight backdrop ───────────────────────────

  if (step === 1) {
    const buttonCenterY = captureRect ? captureRect.top + captureRect.height / 2 : 220;

    return createPortal(
      <>
        {/* Transparent hole at the capture button; box-shadow darkens the rest */}
        {captureRect && (
          <div
            className="fixed pointer-events-none"
            style={{
              zIndex: 49,
              top: captureRect.top - 4,
              left: captureRect.left - 4,
              width: captureRect.width + 8,
              height: captureRect.height + 8,
              borderRadius: 6,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            }}
          />
        )}
        <Card width={264} style={{ right: 360, top: buttonCenterY, transform: "translateY(-50%)" }}>
          <TooltipBody
            title="Capture from the app"
            body="Hit this button — or press Space — to trigger a shot anytime"
            step={step}
            isLast={isLast}
            beak="right"
            onPrev={prev}
            onNext={next}
            onDismiss={dismiss}
          />
        </Card>
      </>,
      document.body
    );
  }

  // ── Step 2: Canvas — tooltip on right side of canvas, beak pointing left ──

  if (step === 2) {
    return createPortal(
      <Card width={264} style={{ right: 360, top: "50%", transform: "translateY(-50%)" }}>
        <TooltipBody
          title="Images land here instantly"
          body="Each shot populates the canvas the moment it's taken"
          step={step}
          isLast={isLast}
          beak="left"
          onPrev={prev}
          onNext={next}
          onDismiss={dismiss}
        />
      </Card>,
      document.body
    );
  }

  // ── Step 3 (last): Edit Profile + Retouching Preset spotlight ────────────

  const presetsMidY = editRect && retouchRect ? (editRect.top + retouchRect.bottom) / 2 : 460;

  return createPortal(
    <>
      {/* Spotlight covering Edit Profile → Retouching Preset */}
      {editRect && retouchRect && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 49,
            top: editRect.top - 8,
            left: editRect.left - 8,
            width: editRect.width + 16,
            height: retouchRect.bottom - editRect.top + 16,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
          }}
        />
      )}
      <Card width={264} style={{ right: 360, top: presetsMidY, transform: "translateY(-50%)" }}>
        <TooltipBody
          title="Auto-apply your style"
          body="Set an editing and retouching preset once — it applies to every new capture automatically"
          step={step}
          isLast={isLast}
          beak="right"
          onPrev={prev}
          onNext={next}
          onDismiss={dismiss}
        />
      </Card>
    </>,
    document.body
  );
};

export default CoachmarkFlow;
