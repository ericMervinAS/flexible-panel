import { useCallback, useRef, useState } from "react";
import { sharedInpainter } from "@/lib/inpainting";
import { MODEL_TO_UI } from "@/lib/distractionDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";

const BOX_PAD = 6;

const uiLabelOf = (d: DistractionDetection) => MODEL_TO_UI[d.label] ?? d.label;

const loadImg = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });

/**
 * Single source of truth for inpainting results, shared by the grid, the loupe
 * editor, and the grid-level batch action. Tracks, per image index:
 *   - active object removals grouped by UI label (so per-object reset is exact)
 *   - an accumulated brush mask at natural resolution (loupe-only)
 * and derives `patchedByIndex` (result data URLs) by recomputing from the
 * ORIGINAL image each time the active set changes.
 */
export function useInpaintStore(getSrc: (index: number) => string | undefined) {
  const [patchedByIndex, setPatchedByIndex] = useState<Record<number, string>>({});
  const [isBusy, setIsBusy] = useState(false);

  const activeBoxesRef = useRef<Record<number, Record<string, DistractionDetection[]>>>({});
  // Brush strokes are kept as a keyed list per image so a single brush removal
  // (and its on-canvas dot) can be restored independently.
  const brushMaskRef = useRef<Record<number, { id: string; canvas: HTMLCanvasElement }[]>>({});
  const runningRef = useRef(false);

  const composeMask = (index: number, nW: number, nH: number): HTMLCanvasElement | null => {
    const out = document.createElement("canvas");
    out.width = nW;
    out.height = nH;
    const octx = out.getContext("2d")!;
    let painted = false;

    const brushes = brushMaskRef.current[index];
    if (brushes) {
      for (const b of brushes) { octx.drawImage(b.canvas, 0, 0, nW, nH); painted = true; }
    }

    const byLabel = activeBoxesRef.current[index];
    if (byLabel) {
      octx.fillStyle = "rgba(0,0,0,1)"; // opaque → alpha>0 → removed by MI-GAN
      for (const boxes of Object.values(byLabel)) {
        for (const d of boxes) {
          octx.fillRect(d.x1 - BOX_PAD, d.y1 - BOX_PAD, (d.x2 - d.x1) + BOX_PAD * 2, (d.y2 - d.y1) + BOX_PAD * 2);
          painted = true;
        }
      }
    }
    return painted ? out : null;
  };

  // Re-run MI-GAN from the original using the index's current active mask. Clears
  // the override when nothing remains masked (image restored to original).
  const recompute = useCallback(async (index: number) => {
    const src = getSrc(index);
    if (!src) return;
    const original = await loadImg(src);
    const nW = original.naturalWidth, nH = original.naturalHeight;
    const mask = composeMask(index, nW, nH);
    if (!mask) {
      setPatchedByIndex((prev) => {
        if (!(index in prev)) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }
    await sharedInpainter.loadModel();
    const result = await sharedInpainter.inpaint(original, mask);
    setPatchedByIndex((prev) => ({ ...prev, [index]: result.toDataURL("image/png") }));
  }, [getSrc]);

  // ── Mutations (mark active set, then caller recomputes) ──
  const addObjectRemovals = useCallback((index: number, dets: DistractionDetection[]) => {
    if (!dets.length) return;
    const grouped: Record<string, DistractionDetection[]> = {};
    for (const d of dets) (grouped[uiLabelOf(d)] ??= []).push(d);
    activeBoxesRef.current[index] = { ...(activeBoxesRef.current[index] ?? {}), ...grouped };
  }, []);

  const addBrushMask = useCallback((index: number, id: string, natMask: HTMLCanvasElement) => {
    (brushMaskRef.current[index] ??= []).push({ id, canvas: natMask });
  }, []);

  // ── High-level actions (mutate + recompute, with the busy flag) ──
  const runExclusive = useCallback(async (fn: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsBusy(true);
    try { await fn(); }
    catch (err) { console.error("[Inpaint]", err); }
    finally { runningRef.current = false; setIsBusy(false); }
  }, []);

  // Loupe: apply the pending brush mask + selected boxes to one image.
  const inpaintImage = useCallback(
    (index: number, dets: DistractionDetection[], brushMask: HTMLCanvasElement | null, brushId?: string) =>
      runExclusive(async () => {
        addObjectRemovals(index, dets);
        if (brushMask && brushId) addBrushMask(index, brushId, brushMask);
        await recompute(index);
      }),
    [runExclusive, addObjectRemovals, addBrushMask, recompute],
  );

  // Restore a single brush removal by id — drop that stroke, recompute from original.
  const resetBrush = useCallback(
    (index: number, id: string) =>
      runExclusive(async () => {
        const list = brushMaskRef.current[index];
        if (list) brushMaskRef.current[index] = list.filter((b) => b.id !== id);
        await recompute(index);
      }),
    [runExclusive, recompute],
  );

  const resetLabel = useCallback(
    (index: number, uiLabel: string) =>
      runExclusive(async () => {
        const byLabel = activeBoxesRef.current[index];
        if (byLabel && uiLabel in byLabel) delete byLabel[uiLabel];
        await recompute(index);
      }),
    [runExclusive, recompute],
  );

  const resetImage = useCallback(
    (index: number) =>
      runExclusive(async () => {
        delete activeBoxesRef.current[index];
        delete brushMaskRef.current[index];
        await recompute(index);
      }),
    [runExclusive, recompute],
  );

  // Whether any image still has this UI label actively removed. Lets a caller
  // (e.g. a full-image reset) know if a label can be safely cleared from a
  // shared album-wide "removed" set, or if another image still needs it flagged.
  const hasActiveLabel = useCallback((uiLabel: string) => {
    for (const byLabel of Object.values(activeBoxesRef.current)) {
      if (uiLabel in byLabel) return true;
    }
    return false;
  }, []);

  // Grid batch: remove the given UI labels across every already-scanned image.
  const inpaintBatch = useCallback(
    (uiLabels: string[], distractionMap: Map<number, DistractionDetection[]>) =>
      runExclusive(async () => {
        const wanted = new Set(uiLabels);
        for (const [index, dets] of distractionMap) {
          const matching = dets.filter((d) => wanted.has(uiLabelOf(d)));
          if (!matching.length) continue;
          addObjectRemovals(index, matching);
          await recompute(index);
        }
      }),
    [runExclusive, addObjectRemovals, recompute],
  );

  return {
    patchedByIndex,
    isBusy,
    inpaintImage,
    resetBrush,
    resetLabel,
    resetImage,
    inpaintBatch,
    hasActiveLabel,
  };
}
