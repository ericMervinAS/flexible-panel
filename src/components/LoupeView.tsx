import { useRef, useEffect, useState } from "react";
import type { ImageData } from "./ImageGrid";
import BrushToolbar, { BrushSlider } from "./BrushToolbar";
import FilmstripBar from "./FilmstripBar";
import BottomBar from "./BottomBar";
import type { DistractionDetection } from "@/lib/distractionDetection";
import { MODEL_TO_UI } from "@/lib/distractionDetection";


// ── Removal masks ──────────────────────────────────────────────────────────────
// A dot marks where a removed region was. Geometry is stored normalized (0..1 of
// the displayed image); dx/dy is a normalized drag offset. `nx1..ny2` is the actual
// inpaint mask rect (object: padded detection box; brush: stroke bounding box).
// `dataUrl` holds the real brush-stroke mask image for the reveal overlay.
interface RemovalMask {
  id: string;
  kind: "object" | "brush";
  label?: string;
  nx1: number; ny1: number; nx2: number; ny2: number;
  dataUrl?: string;
  dx: number;
  dy: number;
}

// Padding (natural px) applied around object detection boxes — must match the
// store's BOX_PAD so the revealed outline is the mask actually inpainted.
const BOX_PAD = 6;

// Stable identity for a still-pending (not yet removed) detection instance —
// drives per-box hover state and the dismissed-detection lookup.
const pendingKeyOf = (det: DistractionDetection) => {
  const label = MODEL_TO_UI[det.label] ?? det.label;
  return `${label}:${det.x1}:${det.y1}:${det.x2}:${det.y2}`;
};

interface LoupeViewProps {
  image: ImageData;
  images: ImageData[];
  filteredImages?: Array<ImageData & { originalIndex: number }>;
  currentIndex: number;
  totalImages: number;
  onSelectImage: (index: number) => void;
  /** Filmstrip multi-selection (always includes currentIndex) — owned by the
   *  parent so batch scan/remove actions elsewhere can read it. */
  selectedIndices: Set<number>;
  onSelectedIndicesChange: (indices: Set<number>) => void;
  onGoToGrid?: () => void;
  isPatchActive?: boolean;
  onHasStrokesChange?: (has: boolean) => void;
  clearCanvasSignal?: number;
  /** Incremented by the parent to trigger inpainting of the current brush mask. */
  inpaintSignal?: number;
  /** Detection boxes (image-natural coords) to include in the inpaint mask. */
  pendingInpaintDetections?: DistractionDetection[];
  /** Patched result data URL for the current image (from the shared store). */
  patchedSrc?: string;
  /** True while the shared store is running an inpaint pass — drives the spinner. */
  isInpainting?: boolean;
  /** Apply brush strokes + selected boxes to an image (shared store). `extraBrushes`
   *  are queued per-instance edited masks (see onSaveEditedDetection) being
   *  included in this same removal pass. */
  onInpaint?: (
    index: number,
    dets: DistractionDetection[],
    brushMask: HTMLCanvasElement | null,
    brushId?: string,
    extraBrushes?: { id: string; canvas: HTMLCanvasElement }[],
  ) => void;
  /** Reset the whole image (R key) — clears all removals for an index. */
  onResetImageAll?: (index: number) => void;
  /** Restore a single brush removal by id (deletes its dot + re-inpaints). */
  onResetBrush?: (id: string) => void;
  autoRemoveAfterStroke?: boolean;
  isExternallyRemoving?: boolean;
  highlightedDetections?: DistractionDetection[];
  hoveredDetections?: DistractionDetection[];
  /** Fired after a canvas-side brush removal completes (timer-driven). */
  onCanvasRemoveSuccess?: () => void;
  /** Shared removed-items state (Set of removed object UI labels) — owned by the page. */
  removedItems?: Set<string>;
  /** Merge a set of labels into the shared removed set. */
  onAddRemovedItems?: (labels: Set<string>) => void;
  /** Delete one label from the shared removed set. */
  onResetRemovedItem?: (label: string) => void;
  /** Replace the shared removed set wholesale. */
  onSetRemovedItems?: (labels: Set<string>) => void;
  /** Removed detections on the current image (per-object geometry, raw image px). */
  removedDetections?: DistractionDetection[];
  /** Restore one removed object by UI label (drops it from the shared set + re-inpaints). */
  onRestoreObject?: (label: string) => void;
  /** "Edit mask" on an AI (object) dot: converts it to a custom brush mask —
   *  excludes this one detection from the label's boxes and adds the user's
   *  painted shape in its place. */
  onConvertObjectMask?: (index: number, det: DistractionDetection, brushId: string, natMask: HTMLCanvasElement) => void;
  /** True while one or more objects are selected in the patch panel — object
   *  selection and brush drawing are mutually exclusive removal methods, so
   *  this locks out brush strokes until the selection is cleared. */
  disableBrush?: boolean;
  /** Canvas "Skip" on a still-pending (not yet removed) detection box — excludes
   *  it from the next batch removal / dot seeding, but leaves it as a normal
   *  detected instance for a later round (see Index.tsx). */
  onSkipDetection?: (index: number, det: DistractionDetection) => void;
  /** Canvas "Edit" -> "Save" on a still-pending detection box: queues the user's
   *  hand-painted mask for this one instance rather than inpainting immediately —
   *  it's applied the next time the panel's "Remove Object" actually runs. */
  onSaveEditedDetection?: (index: number, det: DistractionDetection, brushId: string, natMask: HTMLCanvasElement) => void;
  /** Queued edited masks (from onSaveEditedDetection) relevant to the currently
   *  selected label(s) — captured by the parent right before it bumps
   *  inpaintSignal, mirroring pendingInpaintDetections. */
  pendingExtraBrushes?: { id: string; canvas: HTMLCanvasElement; det: DistractionDetection }[];
}

const LoupeView = ({
  image,
  images,
  filteredImages,
  currentIndex,
  totalImages,
  onSelectImage,
  selectedIndices,
  onSelectedIndicesChange,
  onGoToGrid,
  isPatchActive = false,
  onHasStrokesChange,
  clearCanvasSignal = 0,
  inpaintSignal = 0,
  pendingInpaintDetections = [],
  pendingExtraBrushes = [],
  patchedSrc,
  isInpainting = false,
  onInpaint,
  onResetImageAll,
  onResetBrush,
  autoRemoveAfterStroke = false,
  isExternallyRemoving = false,
  highlightedDetections = [],
  hoveredDetections = [],
  onCanvasRemoveSuccess,
  removedItems = new Set(),
  onAddRemovedItems: _onAddRemovedItems,
  onResetRemovedItem: _onResetRemovedItem,
  onSetRemovedItems: _onSetRemovedItems,
  removedDetections = [],
  onRestoreObject,
  onConvertObjectMask,
  disableBrush = false,
  onSkipDetection,
  onSaveEditedDetection,
}: LoupeViewProps) => {
  const stripImages = filteredImages ?? images.map((img, i) => ({ ...img, originalIndex: i }));

  // Canvas reads the same shared removed-items set: don't draw highlight/hover
  // boxes for objects that have already been removed album-wide.
  const visibleHighlighted = highlightedDetections.filter(
    (d) => !removedItems.has(MODEL_TO_UI[d.label] ?? d.label),
  );
  const visibleHovered = hoveredDetections.filter(
    (d) => !removedItems.has(MODEL_TO_UI[d.label] ?? d.label),
  );
  const stripRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Filmstrip multi-select ───────────────────────────────────────────────────
  // Shift/cmd/ctrl-click grow `selectedIndices` (owned by the parent) for batch
  // use without touching the large preview — only a plain click or arrow-key
  // nav moves `currentIndex`, and that always collapses the set back down to
  // just that index. `filmstripAnchor` is purely local shift-range bookkeeping.
  const [filmstripAnchor, setFilmstripAnchor] = useState<number>(currentIndex);

  const filmstripRangeSet = (a: number, b: number): Set<number> => {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return new Set(Array.from({ length: hi - lo + 1 }, (_, k) => lo + k));
  };

  const handleFilmstripClick = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      onSelectedIndicesChange(filmstripRangeSet(filmstripAnchor, index));
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIndices);
      if (next.has(index)) next.delete(index); else next.add(index);
      onSelectedIndicesChange(next);
      setFilmstripAnchor(index);
      return;
    }
    onSelectedIndicesChange(new Set([index]));
    setFilmstripAnchor(index);
    onSelectImage(index);
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomDropdownRef = useRef<HTMLDivElement>(null);

  // ── Zoom / pan ───────────────────────────────────────────────────────────────
  // Refs hold the live values (safe inside event listeners).
  // State drives re-renders.
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // CSS zoom factor that corresponds to 1 image-pixel = 1 screen-pixel.
  // Computed after the image loads; null until then.
  const trueHundredZoomRef = useRef<number | null>(null);

  // Last non-fit zoom state, for spacebar toggle.
  const prevZoomStateRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);

  // ── Pan-drag state ───────────────────────────────────────────────────────────
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // ── Zoom dropdown ────────────────────────────────────────────────────────────
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);

  // ── Shift key — enables grab-to-pan while in patch mode ──────────────────────
  const isShiftHeldRef = useRef(false);
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  // ── Rendered image bounds in canvas space — used to constrain drawing ────────
  const imageBoundsRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);
  const [imageBounds, setImageBounds] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);

  // ── Brush cursor (raw container coords) ─────────────────────────────────────
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(null);

  // ── Drawing refs ─────────────────────────────────────────────────────────────
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasStrokesRef = useRef(false);
  // Mirrors hasStrokesRef as reactive state so the brush toolbar's Reset
  // button can enable/disable itself based on whether there's an active mask.
  const [hasStrokes, setHasStrokesState] = useState(false);
  const setHasStrokes = (v: boolean) => {
    hasStrokesRef.current = v;
    setHasStrokesState(v);
  };
  const committedHasStrokesRef = useRef(false);
  const committedSnapshotRef = useRef<globalThis.ImageData | null>(null);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const autoRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brushSeqRef = useRef(0);

  const [isAutoRemoving, setIsAutoRemoving] = useState(false);
  const [showStrokeHint, setShowStrokeHint] = useState(false);

  // ── Removal dots ─────────────────────────────────────────────────────────────
  const [removalsByImage, setRemovalsByImage] = useState<Record<number, RemovalMask[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dotMenu, setDotMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // Id of the brush-kind mask currently loaded onto the live drawing canvas for
  // correction (via the dot's "Edit mask" menu item) — null when not editing.
  // While set, finishing the stroke (Remove) replaces that mask instead of
  // creating a new one; Cancel (or erasing it to nothing) just abandons the edit.
  const [editingMaskId, setEditingMaskId] = useState<string | null>(null);
  // Mirrors editingMaskId for the global mouseup/checkBounds effect below, whose
  // closures are fixed at mount and would otherwise see a stale value.
  const editingMaskIdRef = useRef<string | null>(null);
  editingMaskIdRef.current = editingMaskId;
  // Still-pending (not yet removed) detection currently being hand-edited via
  // the brush, opened from its hover Skip/Edit hint — null when not editing.
  // Distinct from editingMaskId, which is for already-applied removal dots.
  const [editingPendingDet, setEditingPendingDet] = useState<DistractionDetection | null>(null);
  // Which pending box's Skip/Edit hint is currently showing (hover-driven).
  const [hoveredPendingKey, setHoveredPendingKey] = useState<string | null>(null);
  const pendingHoverHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Object-mask ids (per image index) that have been converted to a custom brush
  // edit — the detection is excluded from the store's box list, so the seeding
  // effect below must stop re-creating their plain-box dot.
  const [suppressedObjectIds, setSuppressedObjectIds] = useState<Record<number, Set<string>>>({});
  // Cursor position in canvas (pre-transform) space, for proximity reveal.
  const [dotHoverPos, setDotHoverPos] = useState<{ x: number; y: number } | null>(null);
  // True while a brush stroke is actively being drawn (hides dots).
  const [isBrushing, setIsBrushing] = useState(false);
  const dotMenuRef = useRef<HTMLDivElement>(null);
  // Decoded pixel alpha for brush-kind masks, keyed by mask id — lets hover
  // reveal test the cursor against the mask's real painted shape instead of a
  // bounding-box/proximity approximation.
  const brushAlphaRef = useRef<Record<string, { data: Uint8ClampedArray; width: number; height: number }>>({});

  useEffect(() => {
    const masks = removalsByImage[currentIndex] ?? [];
    for (const m of masks) {
      if (m.kind !== "brush" || !m.dataUrl || brushAlphaRef.current[m.id]) continue;
      const id = m.id;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
        brushAlphaRef.current[id] = { data, width, height };
      };
      img.src = m.dataUrl;
    }
  }, [removalsByImage, currentIndex]);

  // Whether canvas-space point (px, py) sits over an opaque (painted) pixel of a
  // brush mask's actual shape. `dx`/`dy` are the mask's normalized drag offset;
  // `rW`/`rH` are the rendered image's pixel dimensions (the mask image, like the
  // photo, spans exactly that rect).
  const isPointInBrushMask = (m: RemovalMask, px: number, py: number, b: { left: number; top: number }, rW: number, rH: number): boolean => {
    const cache = brushAlphaRef.current[m.id];
    if (!cache) return false;
    const relX = (px - b.left) / rW - m.dx;
    const relY = (py - b.top) / rH - m.dy;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return false;
    const sx = Math.min(cache.width - 1, Math.max(0, Math.floor(relX * cache.width)));
    const sy = Math.min(cache.height - 1, Math.max(0, Math.floor(relY * cache.height)));
    return cache.data[(sy * cache.width + sx) * 4 + 3] > 0;
  };

  // Whether canvas-space point (px, py) sits over a mask's real footprint — the
  // padded detection box for an object mask, the actual painted shape for a
  // brush mask. Shared by the dot-reveal test and the brush-cursor suppression
  // below, so both agree on exactly where the mask "is".
  const isInsideMaskFootprint = (
    m: RemovalMask, px: number, py: number,
    b: { left: number; top: number; right: number; bottom: number },
  ): boolean => {
    const rW = b.right - b.left, rH = b.bottom - b.top;
    if (m.kind === "object") {
      const mx = b.left + (m.nx1 + m.dx) * rW;
      const my = b.top + (m.ny1 + m.dy) * rH;
      const mw = (m.nx2 - m.nx1) * rW;
      const mh = (m.ny2 - m.ny1) * rH;
      return px >= mx && px <= mx + mw && py >= my && py <= my + mh;
    }
    return isPointInBrushMask(m, px, py, b, rW, rH);
  };

  // ── Before/after toggle — \ key (or the bottom-bar button) swaps back to the
  // original, unedited image. Resets whenever the user moves to another photo.
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => setShowOriginal(false), [currentIndex]);
  const hasEdits = !!patchedSrc;
  const hasEditsRef = useRef(hasEdits);
  hasEditsRef.current = hasEdits;

  // Patched result for this image comes from the shared store (via props).
  const displaySrc = showOriginal ? image.src : (patchedSrc ?? image.src);
  // Bounding box of the committed mask, in canvas pixel space (pre-zoom).
  // The Cancel/Remove hint is anchored to this so it follows zoom/pan in render.
  const [maskBBox, setMaskBBox] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);

  // ── Brush size (owned here; mirrored to BrushToolbar and right-click popover) ──
  const [brushSize, setBrushSize] = useState(50);
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;

  // ── Brush mode (controlled by BrushToolbar) ──────────────────────────────────
  const brushModeRef = useRef<"add" | "subtract">("add");

  // ── Right-click brush-size popover ──────────────────────────────────────────
  const [sizePopover, setSizePopover] = useState<{ x: number; y: number } | null>(null);
  const sizePopoverRef = useRef<HTMLDivElement>(null);

  // Prop refs — keep global listeners free from stale closures
  const autoRemoveAfterStrokeRef = useRef(autoRemoveAfterStroke);
  autoRemoveAfterStrokeRef.current = autoRemoveAfterStroke;
  const onHasStrokesChangeRef = useRef(onHasStrokesChange);
  onHasStrokesChangeRef.current = onHasStrokesChange;
  const onCanvasRemoveSuccessRef = useRef(onCanvasRemoveSuccess);
  onCanvasRemoveSuccessRef.current = onCanvasRemoveSuccess;
  const pendingInpaintDetectionsRef = useRef(pendingInpaintDetections);
  pendingInpaintDetectionsRef.current = pendingInpaintDetections;
  const pendingExtraBrushesRef = useRef(pendingExtraBrushes);
  pendingExtraBrushesRef.current = pendingExtraBrushes;
  const onInpaintRef = useRef(onInpaint);
  onInpaintRef.current = onInpaint;
  const onResetImageAllRef = useRef(onResetImageAll);
  onResetImageAllRef.current = onResetImageAll;
  const onSaveEditedDetectionRef = useRef(onSaveEditedDetection);
  onSaveEditedDetectionRef.current = onSaveEditedDetection;

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  const applyZoomAndPan = (newZoom: number, newPan: { x: number; y: number }) => {
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan(newPan);
  };

  const goToFit = () => {
    const cur = { zoom: zoomRef.current, pan: panRef.current };
    if (cur.zoom !== 1 || cur.pan.x !== 0 || cur.pan.y !== 0) {
      prevZoomStateRef.current = cur;
    }
    applyZoomAndPan(1, { x: 0, y: 0 });
  };

  const goToTrueHundred = () => {
    const t100 = trueHundredZoomRef.current;
    if (t100 === null) return;
    prevZoomStateRef.current = { zoom: zoomRef.current, pan: panRef.current };
    applyZoomAndPan(t100, { x: 0, y: 0 });
  };

  // Percentage of true image size at current CSS zoom
  const displayPct = (): number => {
    const t100 = trueHundredZoomRef.current;
    return Math.round((t100 !== null ? zoom / t100 : zoom) * 100);
  };

  const isFit = zoom === 1 && pan.x === 0 && pan.y === 0;

  // Compute the CSS zoom that gives 1 image-pixel = 1 screen-pixel
  const computeTrueHundredZoom = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cW = container.clientWidth, cH = container.clientHeight;
    const nW = img.naturalWidth, nH = img.naturalHeight;
    if (!nW || !nH) return;
    // At CSS zoom=1 the image fills the container via object-contain
    const renderedW = (cW / cH) >= (nW / nH) ? cH * (nW / nH) : cW;
    trueHundredZoomRef.current = nW / renderedW;
  };

  // Compute the image's rendered bounds in canvas space (px).
  // The canvas is the same size as the container; the image is object-contain centered.
  const computeImageBounds = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cW = container.clientWidth, cH = container.clientHeight;
    const nW = img.naturalWidth, nH = img.naturalHeight;
    if (!nW || !nH) return;
    const renderedW = (cW / cH) >= (nW / nH) ? cH * (nW / nH) : cW;
    const renderedH = (cW / cH) >= (nW / nH) ? cH : cW * (nH / nW);
    const bounds = {
      left: (cW - renderedW) / 2,
      top: (cH - renderedH) / 2,
      right: (cW + renderedW) / 2,
      bottom: (cH + renderedH) / 2,
    };
    imageBoundsRef.current = bounds;
    setImageBounds(bounds);
  };

  const isInsideImage = (pos: { x: number; y: number }): boolean => {
    const b = imageBoundsRef.current;
    if (!b) return true; // bounds unknown — allow
    return pos.x >= b.left && pos.x <= b.right && pos.y >= b.top && pos.y <= b.bottom;
  };

  // Handle a preset string from the dropdown
  const handleZoomPreset = (pct: number | "fit") => {
    if (pct === "fit") { goToFit(); return; }
    const t100 = trueHundredZoomRef.current;
    const newZoom = Math.max(0.5, Math.min(4, t100 !== null ? (pct / 100) * t100 : pct / 100));
    prevZoomStateRef.current = { zoom: zoomRef.current, pan: panRef.current };
    applyZoomAndPan(newZoom, { x: 0, y: 0 });
  };

  // Scans the committed mask snapshot for the bounding box of opaque pixels and
  // updates `maskBBox`. Returns true if any opaque pixels were found.
  const updateMaskBBox = (): boolean => {
    const snap = committedSnapshotRef.current;
    if (!snap) {
      setMaskBBox(null);
      return false;
    }
    const { data, width, height } = snap;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      const rowStart = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (data[rowStart + x * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      setMaskBBox(null);
      return false;
    }
    setMaskBBox({ minX, minY, maxX, maxY });
    return true;
  };

  // ── Auto-remove timer ────────────────────────────────────────────────────────
  const clearAutoRemove = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasStrokes(false);
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChangeRef.current?.(false);
    setIsAutoRemoving(false);
    setShowStrokeHint(false);
    setMaskBBox(null);
    setEditingMaskId(null);
    setEditingPendingDet(null);
    setShowOriginal(false);
    autoRemoveTimerRef.current = null;
  };

  // Extract the committed brush strokes as a natural-resolution mask (cropped
  // from the container-space mask canvas to the rendered image rect). Null if none.
  const extractBrushMaskNatural = (nW: number, nH: number): HTMLCanvasElement | null => {
    const maskCanvas = maskCanvasRef.current;
    const b = imageBoundsRef.current;
    if (!maskCanvas || !b || !committedHasStrokesRef.current) return null;
    const out = document.createElement("canvas");
    out.width = nW;
    out.height = nH;
    out.getContext("2d")!.drawImage(
      maskCanvas, b.left, b.top, b.right - b.left, b.bottom - b.top, 0, 0, nW, nH,
    );
    return out;
  };

  // Bounding box (natural px) of opaque pixels in a mask canvas. Null if empty.
  const maskBBoxNatural = (c: HTMLCanvasElement): { x1: number; y1: number; x2: number; y2: number } | null => {
    const { width, height } = c;
    const data = c.getContext("2d")!.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (data[row + x * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  };

  // Capture the pending brush strokes + selected boxes and hand them to the
  // shared store (which owns the per-image removal set + result), then clear the
  // live brush layer. The store recomputes from the original and drives the
  // spinner via the `isInpainting` prop.
  const performInpaint = () => {
    const idx = currentIndex;
    const img = imgRef.current;
    const nW = img?.naturalWidth ?? 0, nH = img?.naturalHeight ?? 0;
    const brush = nW && nH ? extractBrushMaskNatural(nW, nH) : null;
    const bbox = brush ? maskBBoxNatural(brush) : null;
    const dets = pendingInpaintDetectionsRef.current ?? [];
    // Capture before any of the resets below (clearAutoRemove included) clear it.
    const editingId = editingMaskId;
    const editingOriginal = editingId ? (removalsByImage[idx] ?? []).find((m) => m.id === editingId) : undefined;
    const isObjectEdit = editingOriginal?.kind === "object";
    // Captured before any of the resets below (clearAutoRemove included) clear it.
    const pendingDet = editingPendingDet;
    const extraBrushes = pendingExtraBrushesRef.current ?? [];
    if (!brush && !dets.length && !extraBrushes.length) { clearAutoRemove(); return; }

    // Editing an existing mask and erased it down to nothing: abandon.
    if (editingId && !bbox) {
      if (isObjectEdit) {
        // Nothing was excluded from the store yet (that only happens on a
        // successful conversion below) — the plain AI box is untouched.
        clearAutoRemove();
        return;
      }
      // Brush: drop the dot and ask the store to purge that id outright, rather
      // than resubmitting an empty stroke under its id.
      setRemovalsByImage((prev) => ({ ...prev, [idx]: (prev[idx] ?? []).filter((m) => m.id !== editingId) }));
      onResetBrush?.(editingId);
      clearAutoRemove();
      return;
    }

    // Hand-editing a still-pending detection (canvas "Edit" hint) and erased it
    // down to nothing: abandon — the plain box goes back to being pending.
    if (pendingDet && !bbox) {
      clearAutoRemove();
      return;
    }

    // Clear the live brush layer now that it's captured.
    const canvas = canvasRef.current, maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasStrokes(false);
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChangeRef.current?.(false);
    setShowStrokeHint(false);
    setMaskBBox(null);
    setIsAutoRemoving(false);
    autoRemoveTimerRef.current = null;

    // Hand-editing a still-pending detection (canvas "Edit" hint, before the
    // label itself is removed): just queue the hand-painted mask — no inpaint
    // yet, no dot yet. It's applied the next time the panel's "Remove Object"
    // actually runs (see the extraBrushes handling below), same as the box
    // would have been had the user left it alone.
    if (pendingDet && brush && bbox) {
      const brushId = `brush:${brushSeqRef.current++}`;
      setEditingPendingDet(null);
      onSaveEditedDetectionRef.current?.(idx, pendingDet, brushId, brush);
      return;
    }

    // Editing an AI (object) dot: converting it to a custom brush mask, rather
    // than replacing an existing brush mask or adding a fresh one. Look up the
    // raw detection to tell the store which box to drop.
    const editingDet = isObjectEdit && editingOriginal ? findDetectionForObjectMask(editingOriginal) : undefined;

    // Seed a brush removal dot at the stroke's location (actual mask preserved as
    // a data URL for the reveal overlay). Editing an existing brush dot reuses
    // its id and replaces its entry in place; converting an AI dot mints a new
    // brush id and drops the old object entry.
    let brushId: string | undefined;
    if (brush && bbox) {
      const dataUrl = brush.toDataURL("image/png");
      if (editingDet) {
        brushId = `brush:${brushSeqRef.current++}`;
        const id = brushId;
        const entry: RemovalMask = {
          id, kind: "brush",
          nx1: bbox.x1 / nW, ny1: bbox.y1 / nH, nx2: bbox.x2 / nW, ny2: bbox.y2 / nH,
          dataUrl, dx: 0, dy: 0,
        };
        setRemovalsByImage((prev) => ({
          ...prev,
          [idx]: [...(prev[idx] ?? []).filter((m) => m.id !== editingId), entry],
        }));
        setSuppressedObjectIds((prev) => {
          const set = new Set(prev[idx] ?? []);
          set.add(editingId!);
          return { ...prev, [idx]: set };
        });
      } else {
        brushId = editingId ?? `brush:${brushSeqRef.current++}`;
        const id = brushId;
        const entry: RemovalMask = {
          id, kind: "brush",
          nx1: bbox.x1 / nW, ny1: bbox.y1 / nH, nx2: bbox.x2 / nW, ny2: bbox.y2 / nH,
          dataUrl, dx: 0, dy: 0,
        };
        setRemovalsByImage((prev) => {
          const list = prev[idx] ?? [];
          const i = list.findIndex((m) => m.id === id);
          return { ...prev, [idx]: i >= 0 ? list.map((m, mi) => (mi === i ? entry : m)) : [...list, entry] };
        });
      }
    }

    // Apply any queued edited masks (canvas "Edit" -> "Save" on now-included
    // instances) alongside this same removal — one dot per instance, and
    // suppressed from the generic seeding effect below so a later removedItems
    // flip for this label doesn't also draw a duplicate plain-box dot for it.
    if (extraBrushes.length) {
      const newEntries: RemovalMask[] = [];
      const newSuppressed: string[] = [];
      for (const eb of extraBrushes) {
        const ebBbox = maskBBoxNatural(eb.canvas);
        if (!ebBbox) continue;
        newEntries.push({
          id: eb.id, kind: "brush",
          nx1: ebBbox.x1 / nW, ny1: ebBbox.y1 / nH, nx2: ebBbox.x2 / nW, ny2: ebBbox.y2 / nH,
          dataUrl: eb.canvas.toDataURL("image/png"), dx: 0, dy: 0,
        });
        const uiLabel = MODEL_TO_UI[eb.det.label] ?? eb.det.label;
        newSuppressed.push(`obj:${uiLabel}:${eb.det.x1}:${eb.det.y1}`);
      }
      if (newEntries.length) {
        setRemovalsByImage((prev) => ({ ...prev, [idx]: [...(prev[idx] ?? []), ...newEntries] }));
        setSuppressedObjectIds((prev) => {
          const set = new Set(prev[idx] ?? []);
          newSuppressed.forEach((s) => set.add(s));
          return { ...prev, [idx]: set };
        });
      }
    }

    setEditingMaskId(null);
    setShowOriginal(false);
    if (editingDet && brush && bbox && brushId) {
      onConvertObjectMask?.(idx, editingDet, brushId, brush);
    } else {
      onInpaintRef.current?.(idx, dets, brush, brushId, extraBrushes.map((eb) => ({ id: eb.id, canvas: eb.canvas })));
    }
  };

  const startAutoRemoveTimer = () => {
    if (autoRemoveTimerRef.current) clearTimeout(autoRemoveTimerRef.current);
    setIsAutoRemoving(true);
    autoRemoveTimerRef.current = setTimeout(() => {
      autoRemoveTimerRef.current = null;
      void performInpaint();
    }, 2000);
  };

  // Cancel a pending auto-remove timer if this view unmounts (e.g. navigating
  // back to the grid) before it fires. Without this, the 2s timeout survives
  // the unmount and later calls performInpaint() against the stale mask/index
  // it closed over — silently inpainting a leftover mask onto whatever image
  // the store ends up applying it to once the user is back in loupe.
  useEffect(() => {
    return () => {
      if (autoRemoveTimerRef.current) {
        clearTimeout(autoRemoveTimerRef.current);
        autoRemoveTimerRef.current = null;
      }
    };
  }, []);

  // ── Filmstrip auto-scroll ────────────────────────────────────────────────────
  useEffect(() => {
    const strip = stripRef.current;
    const displayPos = stripImages.findIndex((img) => img.originalIndex === currentIndex);
    const tile = tileRefs.current[displayPos];
    if (!strip || !tile) return;
    strip.scrollTo({
      left: tile.offsetLeft - strip.offsetWidth / 2 + tile.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [currentIndex, stripImages]);

  // ── Shift key tracking — enables grab-to-pan in patch mode ─────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") { isShiftHeldRef.current = true; setIsShiftHeld(true); }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") { isShiftHeldRef.current = false; setIsShiftHeld(false); }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ── Keyboard navigation + spacebar zoom toggle ───────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "g" || e.key === "G") && !e.metaKey && !e.ctrlKey) { onGoToGrid?.(); return; }
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        onResetImageAllRef.current?.(currentIndex);
        // Object-kind dots get pruned once removedDetections updates, but brush-kind
        // dots have no such trigger — drop them here or their hints outlive the reset.
        setRemovalsByImage((prev) => {
          const list = prev[currentIndex];
          if (!list?.some((m) => m.kind === "brush")) return prev;
          return { ...prev, [currentIndex]: list.filter((m) => m.kind !== "brush") };
        });
        // Un-suppress any AI dots converted to brush edits on this image, so a
        // fresh removal of the same object seeds its plain box again.
        setSuppressedObjectIds((prev) => {
          if (!prev[currentIndex]?.size) return prev;
          const next = { ...prev };
          delete next[currentIndex];
          return next;
        });
        return;
      }
      if (e.key === "ArrowLeft") {
        const next = Math.max(0, currentIndex - 1);
        onSelectedIndicesChange(new Set([next]));
        setFilmstripAnchor(next);
        onSelectImage(next);
      }
      if (e.key === "ArrowRight") {
        const next = Math.min(totalImages - 1, currentIndex + 1);
        onSelectedIndicesChange(new Set([next]));
        setFilmstripAnchor(next);
        onSelectImage(next);
      }

      if (e.key === "\\") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        if (!hasEditsRef.current) return;
        e.preventDefault();
        setShowOriginal((v) => !v);
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        if (zoomRef.current === 1 && panRef.current.x === 0 && panRef.current.y === 0) {
          // At fit — jump to previous zoom if any
          if (prevZoomStateRef.current) {
            const { zoom: pz, pan: pp } = prevZoomStateRef.current;
            applyZoomAndPan(pz, pp);
          }
        } else {
          // Save current, go to fit
          prevZoomStateRef.current = { zoom: zoomRef.current, pan: { ...panRef.current } };
          applyZoomAndPan(1, { x: 0, y: 0 });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentIndex, totalImages, onSelectImage, onGoToGrid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep canvas pixel dimensions in sync with container ─────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    maskCanvasRef.current = document.createElement("canvas");

    const sync = () => {
      // Preserve visible canvas content
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext("2d")?.drawImage(canvas, 0, 0);
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      canvas.getContext("2d")?.drawImage(tmp, 0, 0);

      // Preserve mask canvas content
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const maskTmp = document.createElement("canvas");
        maskTmp.width = maskCanvas.width;
        maskTmp.height = maskCanvas.height;
        maskTmp.getContext("2d")?.drawImage(maskCanvas, 0, 0);
        maskCanvas.width = container.clientWidth;
        maskCanvas.height = container.clientHeight;
        maskCanvas.getContext("2d")?.drawImage(maskTmp, 0, 0);
        // Invalidate snapshot — dimensions changed, stored ImageData no longer matches
        committedSnapshotRef.current = null;
        committedHasStrokesRef.current = false;
        setHasStrokes(false);
      }

      computeImageBounds();
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Reset everything when navigating to a different image ────────────────────
  useEffect(() => {
    if (autoRemoveTimerRef.current) {
      clearTimeout(autoRemoveTimerRef.current);
      autoRemoveTimerRef.current = null;
    }
    setIsAutoRemoving(false);
    setShowStrokeHint(false);
    setMaskBBox(null);
    setActiveId(null);
    setDotMenu(null);
    setDraggingId(null);
    setDotHoverPos(null);
    setIsBrushing(false);
    setEditingPendingDet(null);
    setHoveredPendingKey(null);
    if (pendingHoverHideTimerRef.current) {
      clearTimeout(pendingHoverHideTimerRef.current);
      pendingHoverHideTimerRef.current = null;
    }
    // Reset zoom / pan / true-100 / image bounds (recomputed on image load)
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    trueHundredZoomRef.current = null;
    prevZoomStateRef.current = null;
    imageBoundsRef.current = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasStrokes(false);
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChange?.(false);
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Seed object removal masks from the removed detections ───────────────────
  // One mask per removed detection (stable id), pruned when the panel restores an
  // object. Brush masks (none yet) are left untouched.
  useEffect(() => {
    const img = imgRef.current;
    const nW = img?.naturalWidth ?? 0, nH = img?.naturalHeight ?? 0;
    if (!nW || !nH) return; // wait for image to load so px→normalized is correct

    const suppressed = suppressedObjectIds[currentIndex];
    setRemovalsByImage((prev) => {
      const existing = prev[currentIndex] ?? [];
      const objMasks = existing.filter((m) => m.kind === "object");
      const brushMasks = existing.filter((m) => m.kind === "brush");

      const nextObj: RemovalMask[] = [];
      const wantedIds = new Set<string>();
      for (const det of removedDetections) {
        const label = MODEL_TO_UI[det.label] ?? det.label;
        const id = `obj:${label}:${det.x1}:${det.y1}`;
        // Converted to a custom brush edit — don't re-seed the plain-box dot.
        if (suppressed?.has(id)) continue;
        wantedIds.add(id);
        const found = objMasks.find((m) => m.id === id);
        if (found) { nextObj.push(found); continue; } // keep drag offset etc.
        // Padded box = the exact region the store inpaints (BOX_PAD around the det).
        nextObj.push({
          id, kind: "object", label,
          nx1: (det.x1 - BOX_PAD) / nW, ny1: (det.y1 - BOX_PAD) / nH,
          nx2: (det.x2 + BOX_PAD) / nW, ny2: (det.y2 + BOX_PAD) / nH,
          dx: 0, dy: 0,
        });
      }
      // Prune restored object masks; keep the ordering deterministic.
      const pruned = nextObj.filter((m) => wantedIds.has(m.id));
      return { ...prev, [currentIndex]: [...pruned, ...brushMasks] };
    });
  }, [removedDetections, currentIndex, imageBounds, suppressedObjectIds]);

  // ── Dot context menu: dismiss on outside mousedown ──────────────────────────
  useEffect(() => {
    if (!dotMenu) return;
    const onDown = (e: MouseEvent) => {
      if (dotMenuRef.current && !dotMenuRef.current.contains(e.target as Node)) {
        setDotMenu(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [dotMenu]);

  // ── Delete / Backspace removes the active dot (object dots restore the object) ─
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!activeId) return;
      e.preventDefault();
      deleteMask(activeId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, currentIndex, removalsByImage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wheel zoom (passive:false so we can preventDefault) ─────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.5, Math.min(4, zoomRef.current * factor));
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const newPan = {
        x: cx - (cx - panRef.current.x) * newZoom / zoomRef.current,
        y: cy - (cy - panRef.current.y) * newZoom / zoomRef.current,
      };
      // Save pre-zoom state for spacebar toggle before each wheel change
      if (zoomRef.current === 1 && panRef.current.x === 0 && panRef.current.y === 0) {
        prevZoomStateRef.current = { zoom: zoomRef.current, pan: { ...panRef.current } };
      }
      zoomRef.current = newZoom;
      panRef.current = newPan;
      setZoom(newZoom);
      setPan(newPan);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // `clearCanvasSignal`/`inpaintSignal` are ever-incrementing counters owned by
  // Index.tsx, which never unmounts — so their value already reflects however
  // many removals have happened *anywhere in the session*, not just on this
  // photo. A fresh LoupeView mount (e.g. opening a different image from the
  // grid) has no prior render to diff against, so `useEffect`'s dependency
  // check treats that already-nonzero value as "new" and fires immediately —
  // running performInpaint() against the new image using whatever stale
  // pendingInpaintDetections/pendingExtraBrushes are still sitting in
  // Index.tsx from the last photo's action, silently inpainting a bogus
  // region. Seed each tracker with the signal's value as of mount so the
  // effect only reacts to a genuinely new increment received while this
  // instance is actually mounted.
  const lastHandledClearSignalRef = useRef(clearCanvasSignal);
  const lastHandledInpaintSignalRef = useRef(inpaintSignal);

  // ── Clear canvas on demand (e.g. after patch removal) ────────────────────────
  useEffect(() => {
    if (clearCanvasSignal === lastHandledClearSignalRef.current) return;
    lastHandledClearSignalRef.current = clearCanvasSignal;
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasStrokes(false);
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChange?.(false);
    setShowStrokeHint(false);
    setMaskBBox(null);
  }, [clearCanvasSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inpaint on demand (right-panel "Remove Object" for brush strokes) ────────
  useEffect(() => {
    if (inpaintSignal === lastHandledInpaintSignalRef.current) return;
    lastHandledInpaintSignalRef.current = inpaintSignal;
    performInpaint();
  }, [inpaintSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close zoom dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!showZoomDropdown) return;
    const handler = (e: MouseEvent) => {
      if (!zoomDropdownRef.current?.contains(e.target as Node)) {
        setShowZoomDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showZoomDropdown]);

  // ── Global mouseup / checkBounds ─────────────────────────────────────────────
  useEffect(() => {
    const snapshotMask = () => {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas?.getContext("2d");
      if (maskCtx && maskCanvas) {
        committedSnapshotRef.current = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        committedHasStrokesRef.current = true;
      }
    };

    const restoreMask = () => {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas?.getContext("2d");
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (maskCtx && maskCanvas) {
        if (committedSnapshotRef.current) maskCtx.putImageData(committedSnapshotRef.current, 0, 0);
        else maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (committedSnapshotRef.current && maskCanvas) {
          ctx.globalAlpha = 0.35;
          ctx.drawImage(maskCanvas, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
    };

    const finalizeStroke = () => {
      // Refresh mask bbox; only show the hint if any opaque pixels remain.
      const hasPixels = updateMaskBBox();
      if (!hasPixels) {
        setHasStrokes(false);
        committedHasStrokesRef.current = false;
        onHasStrokesChangeRef.current?.(false);
        setShowStrokeHint(false);
        setEditingMaskId(null);
        setShowOriginal(false);
        return;
      }
      // Fine-tuning an existing mask shouldn't auto-submit after every stroke.
      if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current && !editingMaskIdRef.current) {
        startAutoRemoveTimer();
      } else {
        setShowStrokeHint(true);
      }
    };

    const stop = (e: MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
        void e;
      }
      if (!isDrawingRef.current) return;
      snapshotMask();
      finalizeStroke();
      currentStrokeRef.current = [];
      isDrawingRef.current = false;
      setIsBrushing(false);
      lastPosRef.current = null;
    };

    const checkBounds = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const outside =
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom;
      if (!outside) return;

      setBrushPos(null);
      if (autoRemoveAfterStrokeRef.current && !editingMaskIdRef.current) {
        restoreMask();
        if (!committedHasStrokesRef.current) {
          setHasStrokes(false);
          onHasStrokesChangeRef.current?.(false);
        }
      } else {
        snapshotMask();
        finalizeStroke();
      }
      currentStrokeRef.current = [];
      isDrawingRef.current = false;
      setIsBrushing(false);
      lastPosRef.current = null;
    };

    window.addEventListener("mouseup", stop);
    window.addEventListener("mousemove", checkBounds);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("mousemove", checkBounds);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drawing ──────────────────────────────────────────────────────────────────
  const redrawCurrentStroke = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const maskCtx = maskCanvas?.getContext("2d");
    if (!ctx || !canvas || !maskCtx || !maskCanvas) return;

    const points = currentStrokeRef.current;
    if (points.length === 0) return;

    // Restore committed strokes to mask canvas (full opacity)
    if (committedSnapshotRef.current) {
      maskCtx.putImageData(committedSnapshotRef.current, 0, 0);
    } else {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }

    // Clip drawing to the rendered image rect so strokes can't bleed onto the
    // black canvas surrounding the image.
    const b = imageBoundsRef.current;
    maskCtx.save();
    if (b) {
      maskCtx.beginPath();
      maskCtx.rect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      maskCtx.clip();
    }

    // Draw current stroke at full opacity on mask canvas. In subtract mode, the
    // stroke erases existing committed pixels via destination-out compositing.
    if (brushModeRef.current === "subtract") {
      maskCtx.globalCompositeOperation = "destination-out";
    }
    maskCtx.beginPath();
    maskCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      maskCtx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    maskCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    maskCtx.strokeStyle = "rgb(59, 130, 246)";
    maskCtx.lineWidth = brushSize;
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.globalAlpha = 1;
    maskCtx.stroke();
    maskCtx.restore();

    // Blit mask → visible canvas at uniform 0.35 opacity
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalAlpha = 1;
  };

  // Maps a React mouse event in container space → canvas pixel space
  const posFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cW = rect.width, cH = rect.height;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const z = zoomRef.current, p = panRef.current;
    return {
      x: (cx - cW / 2 - p.x) / z + cW / 2,
      y: (cy - cH / 2 - p.y) / z + cH / 2,
    };
  };

  const commitStroke = () => {
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext("2d");
    if (maskCtx && maskCanvas) {
      committedSnapshotRef.current = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      committedHasStrokesRef.current = true;
    }
    currentStrokeRef.current = [];
    isDrawingRef.current = false;
    setIsBrushing(false);
    lastPosRef.current = null;
  };

  const discardStroke = () => {
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext("2d");
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (maskCtx && maskCanvas) {
      if (committedSnapshotRef.current) maskCtx.putImageData(committedSnapshotRef.current, 0, 0);
      else maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (committedSnapshotRef.current && maskCanvas) {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    if (!committedHasStrokesRef.current) {
      setHasStrokes(false);
      onHasStrokesChange?.(false);
    }
    currentStrokeRef.current = [];
    isDrawingRef.current = false;
    setIsBrushing(false);
    lastPosRef.current = null;
  };

  // ── Stroke hint handlers ─────────────────────────────────────────────────────
  const handleHintRemove = () => {
    setShowStrokeHint(false);
    setMaskBBox(null);
    void performInpaint();
  };

  const handleHintCancel = () => {
    setShowStrokeHint(false);
    clearAutoRemove();
  };

  // ── Removal-dot helpers ──────────────────────────────────────────────────────
  const updateMask = (id: string, patch: Partial<RemovalMask>) => {
    setRemovalsByImage((prev) => {
      const list = prev[currentIndex] ?? [];
      return { ...prev, [currentIndex]: list.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
    });
  };

  const deleteMask = (id: string) => {
    const mask = (removalsByImage[currentIndex] ?? []).find((m) => m.id === id);
    setActiveId(null);
    setDotMenu(null);
    if (mask?.kind === "object" && mask.label) {
      // Restoring drops the label from the shared set → removedDetections changes
      // → the seeding effect prunes this mask.
      onRestoreObject?.(mask.label);
      return;
    }
    // Brush: re-inpaint from the original without this stroke, then drop the dot.
    if (mask?.kind === "brush") onResetBrush?.(id);
    setRemovalsByImage((prev) => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] ?? []).filter((m) => m.id !== id),
    }));
  };

  // Given an object-kind RemovalMask, find the raw DistractionDetection behind
  // it — needed to tell the store which exact box to exclude on conversion.
  const findDetectionForObjectMask = (mask: RemovalMask): DistractionDetection | undefined => {
    if (mask.kind !== "object") return undefined;
    return removedDetections.find((det) => {
      const label = MODEL_TO_UI[det.label] ?? det.label;
      return `obj:${label}:${det.x1}:${det.y1}` === mask.id;
    });
  };

  // "Edit mask" on a dot: seed the live drawing canvas (same layer regular
  // strokes use) with the mask's actual shape — the real painted stroke for a
  // brush dot, or the padded detection box (the exact region the store inpaints)
  // for an AI dot — and open the stroke hint, so the brush is immediately ready
  // to add/erase. Finishing via the hint either replaces this mask in place
  // (brush) or converts it to a custom brush mask (object) — see
  // `performInpaint`'s `editingId`/`isObjectEdit` handling.
  const startEditingMask = (mask: RemovalMask) => {
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    const b = imageBoundsRef.current;
    if (!maskCanvas || !canvas || !b) return;
    const rW = b.right - b.left, rH = b.bottom - b.top;

    const seedAndReveal = (draw: (mctx: CanvasRenderingContext2D) => void) => {
      const mctx = maskCanvas.getContext("2d");
      const ctx = canvas.getContext("2d");
      if (!mctx || !ctx) return;
      mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      draw(mctx);
      committedSnapshotRef.current = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      committedHasStrokesRef.current = true;
      setHasStrokes(true);
      onHasStrokesChange?.(true);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.35;
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalAlpha = 1;
      updateMaskBBox();
      setShowStrokeHint(true);
    };

    if (mask.kind === "brush" && mask.dataUrl) {
      const img = new Image();
      img.onload = () => seedAndReveal((mctx) => {
        mctx.drawImage(img, b.left + mask.dx * rW, b.top + mask.dy * rH, rW, rH);
      });
      img.src = mask.dataUrl;
    } else if (mask.kind === "object") {
      const mx = b.left + (mask.nx1 + mask.dx) * rW;
      const my = b.top + (mask.ny1 + mask.dy) * rH;
      const mw = (mask.nx2 - mask.nx1) * rW;
      const mh = (mask.ny2 - mask.ny1) * rH;
      seedAndReveal((mctx) => {
        // Color here is purely cosmetic (only the alpha channel drives the actual
        // inpaint mask) — match the same blue regular brush strokes use so the
        // live preview looks consistent regardless of which kind of dot this is.
        mctx.fillStyle = "rgb(59, 130, 246)";
        mctx.fillRect(mx, my, mw, mh);
      });
    }
  };

  // Canvas "Edit" hint on a still-pending (not yet removed) detection box: seed
  // the live drawing canvas with the same padded box the store would otherwise
  // inpaint verbatim, and open the stroke hint (reading "Save" while this is
  // set — see the render below) so the brush is immediately ready to adjust it.
  const startEditingPendingDet = (det: DistractionDetection) => {
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    const b = imageBoundsRef.current;
    const img = imgRef.current;
    if (!maskCanvas || !canvas || !b || !img) return;
    const rW = b.right - b.left, rH = b.bottom - b.top;
    const nW = img.naturalWidth, nH = img.naturalHeight;
    const mx = b.left + ((det.x1 - BOX_PAD) / nW) * rW;
    const my = b.top + ((det.y1 - BOX_PAD) / nH) * rH;
    const mw = ((det.x2 - det.x1 + BOX_PAD * 2) / nW) * rW;
    const mh = ((det.y2 - det.y1 + BOX_PAD * 2) / nH) * rH;

    const mctx = maskCanvas.getContext("2d");
    const ctx = canvas.getContext("2d");
    if (!mctx || !ctx) return;
    mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    mctx.fillStyle = "rgb(59, 130, 246)";
    mctx.fillRect(mx, my, mw, mh);
    committedSnapshotRef.current = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    committedHasStrokesRef.current = true;
    setHasStrokes(true);
    onHasStrokesChange?.(true);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalAlpha = 1;
    updateMaskBBox();
    setShowStrokeHint(true);
    setEditingPendingDet(det);
    setHoveredPendingKey(null);
  };

  // Canvas "Skip" hint on a still-pending detection box: drop it from the
  // batch entirely, no inpaint. Nothing to undo short of re-selecting the
  // label (Restore also brings skipped instances back — see Index.tsx).
  const handleSkipDetection = (det: DistractionDetection) => {
    setHoveredPendingKey(null);
    onSkipDetection?.(currentIndex, det);
  };

  // Hover-intent helpers for the Skip/Edit hint — a short hide delay lets the
  // cursor cross the gap from the box down to the hint pill without it
  // disappearing mid-transit (the pill re-affirms via the same show call).
  const showPendingHover = (key: string) => {
    if (pendingHoverHideTimerRef.current) {
      clearTimeout(pendingHoverHideTimerRef.current);
      pendingHoverHideTimerRef.current = null;
    }
    setHoveredPendingKey(key);
  };
  const scheduleHidePendingHover = () => {
    if (pendingHoverHideTimerRef.current) clearTimeout(pendingHoverHideTimerRef.current);
    pendingHoverHideTimerRef.current = setTimeout(() => {
      setHoveredPendingKey(null);
      pendingHoverHideTimerRef.current = null;
    }, 150);
  };

  // Left mousedown on a dot: select (click, <3px) or drag (dx/dy). Stops
  // propagation so the container never starts a brush stroke.
  const handleDotMouseDown = (e: React.MouseEvent, mask: RemovalMask) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const b = imageBoundsRef.current;
    if (!b) return;
    const rW = b.right - b.left, rH = b.bottom - b.top;
    const z = zoomRef.current;
    const startX = e.clientX, startY = e.clientY;
    const startDx = mask.dx, startDy = mask.dy;
    let moved = false;

    const onMove = (ev: MouseEvent) => {
      const ddx = ev.clientX - startX, ddy = ev.clientY - startY;
      if (!moved && Math.hypot(ddx, ddy) >= 3) moved = true;
      if (!moved) return;
      setDraggingId(mask.id);
      // screen px per normalized unit = rendered px (rW) × zoom
      updateMask(mask.id, { dx: startDx + ddx / (rW * z), dy: startDy + ddy / (rH * z) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDraggingId(null);
      if (!moved) { setActiveId(mask.id); setDotMenu(null); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleDotContextMenu = (e: React.MouseEvent, mask: RemovalMask) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setActiveId(mask.id);
    setDotMenu({ id: mask.id, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // ── Mouse handlers ───────────────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPatchActive) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setSizePopover({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    // If a stroke just started on right mousedown, abort it
    if (isDrawingRef.current) {
      discardStroke();
    }
  };

  // Close the size popover on outside click / Escape
  useEffect(() => {
    if (!sizePopover) return;
    const onDown = (e: MouseEvent) => {
      if (sizePopoverRef.current && !sizePopoverRef.current.contains(e.target as Node)) {
        setSizePopover(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSizePopover(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [sizePopover]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Right-click is reserved for the brush-size popover; never start drawing/panning.
    if (e.button === 2) return;
    // Pan: either not in patch mode, or Shift held in patch mode
    if (!isPatchActive || e.shiftKey) {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      return;
    }

    // Drawing mode — locked out while an object is selected in the patch panel
    // (object selection and brush strokes are mutually exclusive), and only
    // starts if the cursor is over the image. Unlocked while hand-editing one
    // pending detection's mask (canvas "Edit" hint), regardless of selection.
    if (disableBrush && !editingPendingDet) return;
    const canvasPos = posFromEvent(e);
    if (!isInsideImage(canvasPos)) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const maskCtx = maskCanvas?.getContext("2d");
    if (!canvas || !ctx || !maskCanvas || !maskCtx) return;

    if (autoRemoveTimerRef.current) {
      clearTimeout(autoRemoveTimerRef.current);
      autoRemoveTimerRef.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setHasStrokes(false);
      committedHasStrokesRef.current = false;
      committedSnapshotRef.current = null;
      onHasStrokesChangeRef.current?.(false);
      setIsAutoRemoving(false);
    }

    setShowStrokeHint(false);
    setMaskBBox(null);

    committedSnapshotRef.current = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    currentStrokeRef.current = [canvasPos];
    isDrawingRef.current = true;
    setIsBrushing(true);
    lastPosRef.current = canvasPos;
    redrawCurrentStroke();

    if (brushModeRef.current === "add" && !hasStrokesRef.current) {
      setHasStrokes(true);
      onHasStrokesChange?.(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle pan drag
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      const newPan = {
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      };
      panRef.current = newPan;
      setPan(newPan);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const rawPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPos = posFromEvent(e);
    const inside = isInsideImage(canvasPos);

    // Track cursor in canvas (pre-transform) space for removal-dot proximity reveal.
    if (isPatchActive) setDotHoverPos(canvasPos);

    // Show brush cursor anywhere inside the canvas area (not just over the image),
    // except in shift-pan mode, while locked out by a selection, or while hovering
    // a revealed mask hint (that area gets a plain pointer cursor instead — see
    // the mask's own `cursor` style — so the two don't show at once).
    const overMaskHint = dotsVisible && dotMasks.some((m) => isInsideMaskFootprint(m, canvasPos.x, canvasPos.y, imageBounds!));
    if (isPatchActive && !isShiftHeldRef.current && (!disableBrush || editingPendingDet) && !overMaskHint) {
      setBrushPos(rawPos);
    } else {
      setBrushPos(null);
    }

    if (isPatchActive && isDrawingRef.current) {
      if (!inside) {
        // Cursor exited the image — commit the stroke and stop
        commitStroke();
        if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current && !editingMaskIdRef.current) startAutoRemoveTimer();
      } else {
        currentStrokeRef.current.push(canvasPos);
        lastPosRef.current = canvasPos;
        redrawCurrentStroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      return;
    }
    if (!isDrawingRef.current) return;
    commitStroke();
    if (!updateMaskBBox()) {
      // Stroke (likely a subtract) emptied the mask — clear state silently
      setHasStrokes(false);
      committedHasStrokesRef.current = false;
      onHasStrokesChange?.(false);
      setEditingMaskId(null);
      setShowOriginal(false);
      return;
    }
    // Fine-tuning an existing mask shouldn't auto-submit after every stroke.
    if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current && !editingMaskIdRef.current) {
      startAutoRemoveTimer();
    } else {
      setShowStrokeHint(true);
    }
  };

  const handleMouseLeave = () => {
    setBrushPos(null);
    setDotHoverPos(null);
    // Keep panning across boundary (global mouseup stops it)
    if (isPanningRef.current) return;
    if (isDrawingRef.current) {
      if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current && !editingMaskIdRef.current) {
        discardStroke();
      } else {
        commitStroke();
        if (!updateMaskBBox()) {
          setHasStrokes(false);
          committedHasStrokesRef.current = false;
          onHasStrokesChange?.(false);
          setEditingMaskId(null);
          setShowOriginal(false);
          return;
        }
        setShowStrokeHint(true);
      }
    }
  };

  // ── Cursor class ─────────────────────────────────────────────────────────────
  const cursorClass = isPatchActive && !isShiftHeld
    ? (disableBrush && !editingPendingDet ? "cursor-not-allowed" : "cursor-none")
    : isPanning
      ? "cursor-grabbing"
      : "cursor-grab";

  // Removal masks for the current image + whether the dot layer should render.
  const dotMasks = removalsByImage[currentIndex] ?? [];
  const dotsVisible =
    isPatchActive && !!imageBounds && dotMasks.length > 0 && !showOriginal &&
    !isBrushing && !showStrokeHint && !isAutoRemoving && !isExternallyRemoving;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Image area ──────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={`flex-1 bg-[#141414] overflow-hidden relative select-none ${cursorClass}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      >
        {/* Before/after indicator — fixed in the viewport, unaffected by zoom/pan */}
        {showOriginal && (
          <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-medium tracking-wide pointer-events-none">
            Original
          </div>
        )}

        {/* Zoom + pan wrapper — image and canvas scale together */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <img
            ref={imgRef}
            src={displaySrc}
            alt={image.filename}
            className="max-w-full max-h-full object-contain"
            draggable={false}
            onLoad={() => { computeTrueHundredZoom(); computeImageBounds(); }}
          />

          {/* Drawing canvas — always in DOM to preserve strokes across tab switches */}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${isPatchActive ? "opacity-100" : "opacity-0"}`}
          />

          {/* Hover hint — slim frame, no label, for the patch panel item under the cursor */}
          {isPatchActive && imageBounds && visibleHovered.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              {visibleHovered.map((det, i) => {
                const imgW = imgRef.current?.naturalWidth ?? 1;
                const imgH = imgRef.current?.naturalHeight ?? 1;
                const rW = imageBounds.right - imageBounds.left;
                const rH = imageBounds.bottom - imageBounds.top;
                const PAD = 14;
                const x = imageBounds.left + (det.x1 / imgW) * rW - PAD;
                const y = imageBounds.top + (det.y1 / imgH) * rH - PAD;
                const w = ((det.x2 - det.x1) / imgW) * rW + PAD * 2;
                const h = ((det.y2 - det.y1) / imgH) * rH + PAD * 2;
                return (
                  <rect
                    key={i}
                    x={x} y={y} width={w} height={h}
                    fill="rgba(59,130,246,0.02)"
                    stroke="rgba(59,130,246,0.55)"
                    strokeWidth={1.5 / zoom}
                    // strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                    rx={3 / zoom}
                  />
                );
              })}
            </svg>
          )}

          {/* Bounding box overlay for selected distraction objects */}
          {isPatchActive && imageBounds && visibleHighlighted.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              {visibleHighlighted
                .filter((det) => det !== editingPendingDet)
                .map((det) => {
                const key = pendingKeyOf(det);
                const imgW = imgRef.current?.naturalWidth ?? 1;
                const imgH = imgRef.current?.naturalHeight ?? 1;
                const rW = imageBounds.right - imageBounds.left;
                const rH = imageBounds.bottom - imageBounds.top;
                const PAD = 14;
                const x = imageBounds.left + (det.x1 / imgW) * rW - PAD;
                const y = imageBounds.top + (det.y1 / imgH) * rH - PAD;
                const w = ((det.x2 - det.x1) / imgW) * rW + PAD * 2;
                const h = ((det.y2 - det.y1) / imgH) * rH + PAD * 2;

                const uiLabel = MODEL_TO_UI[det.label] ?? det.label;
                const sz = 11 / zoom;
                const chipPad = 5 / zoom;
                const chipH = 18 / zoom;
                const chipW = (uiLabel.length * 6.2 / zoom) + chipPad * 2;
                const chipR = 3 / zoom;
                const chipX = x + chipW * 0.25;
                const chipY = y - chipH * 0.5;

                // Hover reveals this instance's Skip/Edit hint — suppressed while
                // another instance is mid-edit or a stroke is being drawn.
                const hoverEnabled = !editingPendingDet && !isBrushing;

                return (
                  <g key={key}>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill="rgba(59,130,246,0.08)"
                      stroke="#3b82f6"
                      strokeWidth={3 / zoom}
                      rx={3 / zoom}
                      style={{ cursor: hoverEnabled ? "pointer" : undefined, pointerEvents: hoverEnabled ? "auto" : "none" }}
                      onMouseEnter={() => hoverEnabled && showPendingHover(key)}
                      onMouseLeave={() => hoverEnabled && scheduleHidePendingHover()}
                    />
                    <rect
                      x={chipX} y={chipY}
                      width={chipW} height={chipH}
                      fill="#3b82f6"
                      rx={chipR}
                    />
                    <text
                      x={chipX + chipPad}
                      y={chipY + chipH / 2}
                      fontSize={sz}
                      fill="white"
                      dominantBaseline="central"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fontWeight="500"
                    >
                      {uiLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Removal dots — one per removed object, proximity-revealed outline */}
          {dotsVisible && imageBounds && (
            <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
              <g style={{ pointerEvents: "auto" }}>
                {dotMasks.map((m) => {
                  const rW = imageBounds.right - imageBounds.left;
                  const rH = imageBounds.bottom - imageBounds.top;
                  const cx = imageBounds.left + ((m.nx1 + m.nx2) / 2 + m.dx) * rW;
                  const cy = imageBounds.top + ((m.ny1 + m.ny2) / 2 + m.dy) * rH;
                  const isActive = activeId === m.id;
                  const isDragging = draggingId === m.id;
                  const menuOpen = dotMenu?.id === m.id;
                  const mx = imageBounds.left + (m.nx1 + m.dx) * rW;
                  const my = imageBounds.top + (m.ny1 + m.dy) * rH;
                  const mw = (m.nx2 - m.nx1) * rW;
                  const mh = (m.ny2 - m.ny1) * rH;
                  // Reveal only once the brush cursor's exact center sits over the
                  // mask's real footprint — the padded detection box for objects, the
                  // actual painted shape (via alpha lookup) for brush strokes.
                  const pointerInMask = dotHoverPos
                    ? isInsideMaskFootprint(m, dotHoverPos.x, dotHoverPos.y, imageBounds)
                    : false;
                  const revealed = isActive || isDragging || menuOpen || pointerInMask;
                  const r = revealed ? 6.5 / zoom : 5 / zoom;
                  const dotOpacity = revealed ? 1 : 0.8;
                  const borderW = isActive ? 2 / zoom : 1 / zoom;
                  return (
                    <g key={m.id}>
                      {revealed && m.kind === "object" && (
                        // Actual inpaint mask: the padded detection box. Its bbox is the
                        // real mask footprint, so it can host the right-click handler directly.
                        <rect
                          x={mx} y={my} width={mw} height={mh}
                          rx={3 / zoom}
                          fill="rgba(59,130,246,0.22)"
                          stroke="#3b82f6"
                          strokeWidth={2 / zoom}
                          style={{ cursor: "pointer" }}
                          onContextMenu={(e) => handleDotContextMenu(e, m)}
                        />
                      )}
                      {revealed && m.kind === "brush" && m.dataUrl && (
                        <>
                          {/* Actual brush mask, drawn in place (mask canvas is full-image sized). */}
                          <image
                            href={m.dataUrl}
                            x={imageBounds.left + m.dx * rW}
                            y={imageBounds.top + m.dy * rH}
                            width={rW}
                            height={rH}
                            opacity={0.5}
                            preserveAspectRatio="none"
                          />
                          {/* Invisible hit-region gated by the same exact alpha test used for
                              reveal, so cursor/right-click only engage over painted pixels. */}
                          <rect
                            x={imageBounds.left + m.dx * rW}
                            y={imageBounds.top + m.dy * rH}
                            width={rW}
                            height={rH}
                            fill="transparent"
                            style={{
                              cursor: pointerInMask ? "pointer" : "default",
                              pointerEvents: pointerInMask ? "auto" : "none",
                            }}
                            onContextMenu={(e) => handleDotContextMenu(e, m)}
                          />
                        </>
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="#3b82f6"
                        fillOpacity={dotOpacity}
                        stroke="rgba(255,255,255,0.95)"
                        strokeWidth={borderW}
                        style={{ cursor: "pointer" }}
                        onMouseDown={(e) => handleDotMouseDown(e, m)}
                        onContextMenu={(e) => handleDotContextMenu(e, m)}
                      />
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* Removal-dot context menu — container space (unscaled) */}
        {isPatchActive && dotMenu && (
          <div
            ref={dotMenuRef}
            className="absolute z-40 bg-[#1c1c1c] border border-[#303030] rounded-[8px] py-1 shadow-xl min-w-[128px]"
            style={{ left: dotMenu.x, top: dotMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <button
              onClick={() => {
                const mask = dotMasks.find((m) => m.id === dotMenu.id);
                setDotMenu(null);
                if (mask) {
                  setActiveId(null);
                  setEditingMaskId(mask.id);
                  setShowOriginal(true);
                  startEditingMask(mask);
                }
              }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#e2e2e2] hover:bg-white/5 transition-colors"
            >
              Edit mask
            </button>
            <button
              onClick={() => deleteMask(dotMenu.id)}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#e2e2e2] hover:bg-white/5 transition-colors"
            >
              Delete
            </button>
          </div>
        )}

        {/* Brush cursor ring — container space, sized to match visual brush */}
        {isPatchActive && brushPos && (
          <div
            className="absolute pointer-events-none rounded-full border border-white/80"
            style={{
              left: brushPos.x,
              top: brushPos.y,
              width: brushSize * zoom,
              height: brushSize * zoom,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
            }}
          />
        )}

        {/* Stroke action hint — anchored to the mask bbox so it tracks zoom/pan */}
        {showStrokeHint && !isAutoRemoving && !isExternallyRemoving && maskBBox && containerRef.current && (() => {
          const cW = containerRef.current.clientWidth;
          const cH = containerRef.current.clientHeight;
          const midX = (maskBBox.minX + maskBBox.maxX) / 2;
          const cx = (midX - cW / 2) * zoom + cW / 2 + pan.x;
          const cy = (maskBBox.maxY - cH / 2) * zoom + cH / 2 + pan.y + 12;
          const x = Math.max(52, Math.min(cW - 52, cx));
          const y = Math.min(cH - 40, Math.max(10, cy));
          return (
            <div
              className="absolute flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-[8px] px-1 py-1 z-10"
              style={{ left: x, top: y, transform: "translateX(-50%)" }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleHintCancel}
                className="text-[12px] text-[#ababab] hover:text-white px-2.5 py-1 rounded-[5px] hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleHintRemove}
                className="text-[12px] text-white font-medium px-2.5 py-1 rounded-[5px] bg-blue-500/80 hover:bg-blue-500 transition-colors"
              >
                {editingPendingDet ? "Save" : "Remove"}
              </button>
            </div>
          );
        })()}

        {/* Canvas removal loader */}
        {(isAutoRemoving || isExternallyRemoving || isInpainting) && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/80 rounded-lg px-3 py-1.5 pointer-events-none">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin shrink-0" />
            <span className="text-[12px] text-[#e2e2e2]">Removing</span>
          </div>
        )}

        {/* ── Brush toolbar ────────────────────────────────────────────────── */}
        {isPatchActive && (
          <BrushToolbar
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            onBrushModeChange={(m) => { brushModeRef.current = m; }}
            resetDisabled={!hasStrokes}
            onClear={() => {
              if (autoRemoveTimerRef.current) {
                clearTimeout(autoRemoveTimerRef.current);
                autoRemoveTimerRef.current = null;
              }
              clearAutoRemove();
            }}
          />
        )}

        {/* Right-click brush-size popover — anchored to cursor inside the canvas */}
        {isPatchActive && sizePopover && (() => {
          const container = containerRef.current;
          const cW = container?.clientWidth ?? 0;
          const cH = container?.clientHeight ?? 0;
          const POP_W = 220, POP_H = 64;
          const left = Math.max(8, Math.min(cW - POP_W - 8, sizePopover.x + 12));
          const top = Math.max(8, Math.min(cH - POP_H - 8, sizePopover.y + 12));
          return (
            <div
              ref={sizePopoverRef}
              className="absolute z-30 bg-[#1c1c1c]/95 border border-[#303030] rounded-[8px] p-4 backdrop-blur-sm shadow-xl"
              style={{ left, top, width: POP_W }}
              onMouseDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <BrushSlider
                label="Brush Size"
                value={brushSize}
                min={1}
                max={200}
                onChange={setBrushSize}
                showBrushCursor
              />
            </div>
          );
        })()}
      </div>

      {/* ── Filmstrip ───────────────────────────────────────────────────────── */}
      <FilmstripBar
        stripImages={stripImages}
        currentIndex={currentIndex}
        selectedIndices={selectedIndices}
        onSelectImage={handleFilmstripClick}
        stripRef={stripRef}
        tileRefs={tileRefs}
      />

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <BottomBar
        mode="loupe"
        image={image}
        currentIndex={currentIndex}
        totalImages={totalImages}
        isFit={isFit}
        displayPct={displayPct}
        goToFit={goToFit}
        goToTrueHundred={goToTrueHundred}
        handleZoomPreset={handleZoomPreset}
        showZoomDropdown={showZoomDropdown}
        setShowZoomDropdown={setShowZoomDropdown}
        zoomDropdownRef={zoomDropdownRef}
        hasEdits={hasEdits}
        showOriginal={showOriginal}
        onToggleShowOriginal={() => setShowOriginal((v) => !v)}
      />
    </div>
  );
};

export default LoupeView;