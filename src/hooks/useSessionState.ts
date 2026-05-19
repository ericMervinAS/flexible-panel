import { useState, useCallback } from "react";

function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Like useState, but backed by sessionStorage — survives component remounts within
 * the same tab session and is automatically cleared on hard refresh / new tab.
 *
 * For Set values, pass a serialiser/deserialiser pair:
 *   useSessionState("key", new Set<string>(), {
 *     serialize: (s) => [...s],
 *     deserialize: (a) => new Set(a),
 *   })
 */
export function useSessionState<T>(
  key: string,
  initialValue: T,
  opts?: {
    serialize?: (val: T) => unknown;
    deserialize?: (raw: unknown) => T;
  }
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw === null) return initialValue;
      const parsed = JSON.parse(raw);
      return opts?.deserialize ? opts.deserialize(parsed) : (parsed as T);
    } catch {
      return initialValue;
    }
  });

  const setState = useCallback(
    (action: React.SetStateAction<T>) => {
      setStateRaw((prev) => {
        const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
        try {
          const toStore = opts?.serialize ? opts.serialize(next) : next;
          sessionStorage.setItem(key, JSON.stringify(toStore));
        } catch {
          // storage quota exceeded or private-mode restriction — degrade silently
        }
        return next;
      });
    },
    [key, opts?.serialize]
  );

  return [state, setState];
}
