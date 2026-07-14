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
  // Index actually being (re)computed right now — lets a caller ask "is *this*
  // image mid-inpaint" instead of relying on `isBusy` alone, which stays true
  // for as long as any recompute is running (e.g. one started before the user
  // navigated to a different photo) and would otherwise show that unrelated
  // photo's loupe as still "Removing…" until the old job finishes.
  const [busyIndex, setBusyIndex] = useState<number | null>(null);

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
    // The inpainter caps its working resolution (MAX_SIDE), so the result can come
    // back smaller than the original — resize it back to the original's exact
    // dimensions so before/after share the same natural size (keeps zoom % consistent).
    let dataUrl: string;
    if (result.width === nW && result.height === nH) {
      dataUrl = result.toDataURL("image/png");
    } else {
      const full = document.createElement("canvas");
      full.width = nW;
      full.height = nH;
      full.getContext("2d")!.drawImage(result, 0, 0, nW, nH);
      dataUrl = full.toDataURL("image/png");
    }
    setPatchedByIndex((prev) => ({ ...prev, [index]: dataUrl }));
  }, [getSrc]);

  // ── Mutations (mark active set, then caller recomputes) ──
  const addObjectRemovals = useCallback((index: number, dets: DistractionDetection[]) => {
    if (!dets.length) return;
    const grouped: Record<string, DistractionDetection[]> = {};
    for (const d of dets) (grouped[uiLabelOf(d)] ??= []).push(d);
    activeBoxesRef.current[index] = { ...(activeBoxesRef.current[index] ?? {}), ...grouped };
  }, []);

  // Upsert: editing an existing brush stroke resubmits under the same id, and
  // should replace its canvas in place rather than stacking a duplicate.
  const addBrushMask = useCallback((index: number, id: string, natMask: HTMLCanvasElement) => {
    const list = (brushMaskRef.current[index] ??= []);
    const i = list.findIndex((b) => b.id === id);
    if (i >= 0) list[i] = { id, canvas: natMask };
    else list.push({ id, canvas: natMask });
  }, []);

  // ── High-level actions (mutate + recompute, with the busy flag) ──
  // `index` is the image this particular call is working on (null for the
  // grid batch, which sweeps many indices and updates `busyIndex` itself as
  // it goes — see `inpaintBatch`).
  const runExclusive = useCallback(async (index: number | null, fn: () => Promise<void>) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsBusy(true);
    setBusyIndex(index);
    try { await fn(); }
    catch (err) { console.error("[Inpaint]", err); }
    finally { runningRef.current = false; setIsBusy(false); setBusyIndex(null); }
  }, []);

  // Loupe: apply the pending brush mask + selected boxes to one image. `extraBrushes`
  // are previously hand-edited per-instance masks (canvas "Edit" -> "Save", queued
  // rather than applied immediately) being included in this same removal pass —
  // added alongside the live brush in one recompute rather than one each.
  const inpaintImage = useCallback(
    (
      index: number,
      dets: DistractionDetection[],
      brushMask: HTMLCanvasElement | null,
      brushId?: string,
      extraBrushes?: { id: string; canvas: HTMLCanvasElement }[],
    ) =>
      runExclusive(index, async () => {
        addObjectRemovals(index, dets);
        if (brushMask && brushId) addBrushMask(index, brushId, brushMask);
        for (const eb of extraBrushes ?? []) addBrushMask(index, eb.id, eb.canvas);
        await recompute(index);
      }),
    [runExclusive, addObjectRemovals, addBrushMask, recompute],
  );

  // Restore a single brush removal by id — drop that stroke, recompute from original.
  const resetBrush = useCallback(
    (index: number, id: string) =>
      runExclusive(index, async () => {
        const list = brushMaskRef.current[index];
        if (list) brushMaskRef.current[index] = list.filter((b) => b.id !== id);
        await recompute(index);
      }),
    [runExclusive, recompute],
  );

  // Loupe "Edit mask" on an AI (object) dot: the user repainted it with the brush,
  // so it's no longer a plain detection box. Atomically drop that one detection
  // from the label's active boxes and add the user's shape as a brush mask, in a
  // single recompute (two separate calls would race under the exclusivity lock).
  const convertObjectToBrush = useCallback(
    (index: number, uiLabel: string, det: DistractionDetection, brushId: string, natMask: HTMLCanvasElement) =>
      runExclusive(index, async () => {
        const byLabel = activeBoxesRef.current[index];
        if (byLabel?.[uiLabel]) {
          byLabel[uiLabel] = byLabel[uiLabel].filter(
            (d) => !(d.x1 === det.x1 && d.y1 === det.y1 && d.x2 === det.x2 && d.y2 === det.y2),
          );
          if (!byLabel[uiLabel].length) delete byLabel[uiLabel];
        }
        addBrushMask(index, brushId, natMask);
        await recompute(index);
      }),
    [runExclusive, addBrushMask, recompute],
  );

  const resetLabel = useCallback(
    (index: number, uiLabel: string) =>
      runExclusive(index, async () => {
        const byLabel = activeBoxesRef.current[index];
        if (byLabel && uiLabel in byLabel) delete byLabel[uiLabel];
        await recompute(index);
      }),
    [runExclusive, recompute],
  );

  const resetImage = useCallback(
    (index: number) =>
      runExclusive(index, async () => {
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
      runExclusive(null, async () => {
        const wanted = new Set(uiLabels);
        for (const [index, dets] of distractionMap) {
          const matching = dets.filter((d) => wanted.has(uiLabelOf(d)));
          if (!matching.length) continue;
          setBusyIndex(index);
          addObjectRemovals(index, matching);
          await recompute(index);
        }
      }),
    [runExclusive, addObjectRemovals, recompute],
  );

  return {
    patchedByIndex,
    isBusy,
    busyIndex,
    inpaintImage,
    resetBrush,
    resetLabel,
    resetImage,
    convertObjectToBrush,
    inpaintBatch,
    hasActiveLabel,
  };
}
