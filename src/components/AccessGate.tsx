import { useState, useRef, useEffect } from "react";
import { Lock } from "@phosphor-icons/react";

// Must match the salt used in scripts/set-code.mjs
const SALT = "aftershoot-arc-v1";
const STORED_HASH = import.meta.env.VITE_ACCESS_CODE_HASH ?? "";
const SESSION_KEY = "as_arc_access";

async function deriveHash(code: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(SALT), iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const AccessGate = ({ children }: { children: React.ReactNode }) => {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);
  const [granted, setGranted] = useState(
    () => !STORED_HASH || sessionStorage.getItem(SESSION_KEY) === "1"
  );
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!granted) setTimeout(() => refs.current[0]?.focus(), 80);
  }, [granted]);

  const verify = async (code: string) => {
    setChecking(true);
    const hash = await deriveHash(code);
    if (hash === STORED_HASH) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setGranted(true);
    } else {
      setShake(true);
      setDigits(Array(6).fill(""));
      setTimeout(() => {
        setShake(false);
        refs.current[0]?.focus();
      }, 650);
    }
    setChecking(false);
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) refs.current[index + 1]?.focus();
    if (digit && index === 5 && next.every((d) => d !== "")) verify(next.join(""));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = Array(6).fill("").map((_, i) => text[i] ?? "");
    setDigits(next);
    refs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) verify(text);
  };

  if (granted) return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0d0d0d]">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_55%_45%_at_50%_48%,rgba(37,99,235,0.08)_0%,transparent_100%)]" />

      <div className="relative flex flex-col items-center gap-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-[52px] h-[52px] rounded-2xl bg-[#151515] border border-[#242424] flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
            <Lock className="w-[22px] h-[22px] text-[#474747]" weight="duotone" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[#d4d4d4] text-[15px] font-medium tracking-[-0.01em]">
              Album Retouch Suite
            </span>
            <span className="text-[#3a3a3a] text-[12px]">Enter your 6-digit access code</span>
          </div>
        </div>

        {/* Digit inputs */}
        <div className={`flex items-center gap-2.5 ${shake ? "animate-shake" : ""}`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              disabled={checking}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`w-11 h-[54px] text-center text-[22px] font-semibold rounded-xl border bg-[#111] outline-none transition-all duration-150 caret-transparent select-none
                ${shake
                  ? "border-[#7f1d1d] text-[#ef4444] bg-[#1a0a0a]"
                  : d
                  ? "border-[#1d4ed8] text-[#e2e2e2] shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                  : "border-[#1e1e1e] text-[#e2e2e2] focus:border-[#2e2e2e] focus:bg-[#131313]"
                }
                ${checking ? "opacity-30" : ""}
              `}
            />
          ))}
        </div>

        {/* Status */}
        <div className="h-4 flex items-center justify-center">
          {checking && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-[#2a2a2a] border-t-[#555] animate-spin" />
              <span className="text-[11px] text-[#333]">Verifying</span>
            </div>
          )}
          {shake && !checking && (
            <span className="text-[11px] text-[#ef4444]">Incorrect code. Try again.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessGate;
