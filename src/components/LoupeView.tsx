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

interface LoupeViewProps {
  image: ImageData;
  images: ImageData[];
  filteredImages?: Array<ImageData & { originalIndex: number }>;
  currentIndex: number;
  totalImages: number;
  onSelectImage: (index: number) => void;
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
  /** Apply brush strokes + selected boxes to an image (shared store). */
  onInpaint?: (index: number, dets: DistractionDetection[], brushMask: HTMLCanvasElement | null, brushId?: string) => void;
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
  /** True while one or more objects are selected in the patch panel — object
   *  selection and brush drawing are mutually exclusive removal methods, so
   *  this locks out brush strokes until the selection is cleared. */
  disableBrush?: boolean;
}

const LoupeView = ({
  image,
  images,
  filteredImages,
  currentIndex,
  totalImages,
  onSelectImage,
  onGoToGrid,
  isPatchActive = false,
  onHasStrokesChange,
  clearCanvasSignal = 0,
  inpaintSignal = 0,
  pendingInpaintDetections = [],
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
  disableBrush = false,
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
  // Cursor position in canvas (pre-transform) space, for proximity reveal.
  const [dotHoverPos, setDotHoverPos] = useState<{ x: number; y: number } | null>(null);
  // True while a brush stroke is actively being drawn (hides dots).
  const [isBrushing, setIsBrushing] = useState(false);
  const dotMenuRef = useRef<HTMLDivElement>(null);

  // Patched result for this image comes from the shared store (via props).
  const displaySrc = patchedSrc ?? image.src;
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
  const onInpaintRef = useRef(onInpaint);
  onInpaintRef.current = onInpaint;
  const onResetImageAllRef = useRef(onResetImageAll);
  onResetImageAllRef.current = onResetImageAll;

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
    hasStrokesRef.current = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChangeRef.current?.(false);
    setIsAutoRemoving(false);
    setShowStrokeHint(false);
    setMaskBBox(null);
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
    const dets = pendingInpaintDetectionsRef.current ?? [];
    if (!brush && !dets.length) { clearAutoRemove(); return; }

    // Clear the live brush layer now that it's captured.
    const canvas = canvasRef.current, maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    hasStrokesRef.current = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChangeRef.current?.(false);
    setShowStrokeHint(false);
    setMaskBBox(null);
    setIsAutoRemoving(false);
    autoRemoveTimerRef.current = null;

    // Seed a brush removal dot at the stroke's location (actual mask preserved as
    // a data URL for the reveal overlay).
    let brushId: string | undefined;
    if (brush) {
      const bbox = maskBBoxNatural(brush);
      if (bbox) {
        brushId = `brush:${brushSeqRef.current++}`;
        const dataUrl = brush.toDataURL("image/png");
        const id = brushId;
        setRemovalsByImage((prev) => {
          const list = prev[idx] ?? [];
          return {
            ...prev,
            [idx]: [...list, {
              id, kind: "brush",
              nx1: bbox.x1 / nW, ny1: bbox.y1 / nH, nx2: bbox.x2 / nW, ny2: bbox.y2 / nH,
              dataUrl, dx: 0, dy: 0,
            }],
          };
        });
      }
    }

    onInpaintRef.current?.(idx, dets, brush, brushId);
  };

  const startAutoRemoveTimer = () => {
    if (autoRemoveTimerRef.current) clearTimeout(autoRemoveTimerRef.current);
    setIsAutoRemoving(true);
    autoRemoveTimerRef.current = setTimeout(() => {
      autoRemoveTimerRef.current = null;
      void performInpaint();
    }, 2000);
  };

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
        return;
      }
      if (e.key === "ArrowLeft") onSelectImage(Math.max(0, currentIndex - 1));
      if (e.key === "ArrowRight") onSelectImage(Math.min(totalImages - 1, currentIndex + 1));

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
        hasStrokesRef.current = false;
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
    hasStrokesRef.current = false;
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

    setRemovalsByImage((prev) => {
      const existing = prev[currentIndex] ?? [];
      const objMasks = existing.filter((m) => m.kind === "object");
      const brushMasks = existing.filter((m) => m.kind === "brush");

      const nextObj: RemovalMask[] = [];
      const wantedIds = new Set<string>();
      for (const det of removedDetections) {
        const label = MODEL_TO_UI[det.label] ?? det.label;
        const id = `obj:${label}:${det.x1}:${det.y1}`;
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
  }, [removedDetections, currentIndex, imageBounds]);

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

  // ── Clear canvas on demand (e.g. after patch removal) ────────────────────────
  useEffect(() => {
    if (!clearCanvasSignal) return;
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    maskCanvas?.getContext("2d")?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    hasStrokesRef.current = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current = null;
    onHasStrokesChange?.(false);
    setShowStrokeHint(false);
    setMaskBBox(null);
  }, [clearCanvasSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inpaint on demand (right-panel "Remove Object" for brush strokes) ────────
  useEffect(() => {
    if (!inpaintSignal) return;
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
        hasStrokesRef.current = false;
        committedHasStrokesRef.current = false;
        onHasStrokesChangeRef.current?.(false);
        setShowStrokeHint(false);
        return;
      }
      if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current) {
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
      if (autoRemoveAfterStrokeRef.current) {
        restoreMask();
        if (!committedHasStrokesRef.current) {
          hasStrokesRef.current = false;
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
      hasStrokesRef.current = false;
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
    // starts if the cursor is over the image.
    if (disableBrush) return;
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
      hasStrokesRef.current = false;
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
      hasStrokesRef.current = true;
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
    // except in shift-pan mode or while brushing is locked out by a selection.
    if (isPatchActive && !isShiftHeldRef.current && !disableBrush) {
      setBrushPos(rawPos);
    } else {
      setBrushPos(null);
    }

    if (isPatchActive && isDrawingRef.current) {
      if (!inside) {
        // Cursor exited the image — commit the stroke and stop
        commitStroke();
        if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current) startAutoRemoveTimer();
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
      hasStrokesRef.current = false;
      committedHasStrokesRef.current = false;
      onHasStrokesChange?.(false);
      return;
    }
    if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current) {
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
      if (brushModeRef.current === "add" && autoRemoveAfterStrokeRef.current) {
        discardStroke();
      } else {
        commitStroke();
        if (!updateMaskBBox()) {
          hasStrokesRef.current = false;
          committedHasStrokesRef.current = false;
          onHasStrokesChange?.(false);
          return;
        }
        setShowStrokeHint(true);
      }
    }
  };

  // ── Cursor class ─────────────────────────────────────────────────────────────
  const cursorClass = isPatchActive && !isShiftHeld
    ? (disableBrush ? "cursor-not-allowed" : "cursor-none")
    : isPanning
      ? "cursor-grabbing"
      : "cursor-grab";

  // Removal masks for the current image + whether the dot layer should render.
  const dotMasks = removalsByImage[currentIndex] ?? [];
  const dotsVisible =
    isPatchActive && !!imageBounds && dotMasks.length > 0 &&
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
              {visibleHighlighted.map((det, i) => {
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

                return (
                  <g key={i}>
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill="rgba(59,130,246,0.08)"
                      stroke="#3b82f6"
                      strokeWidth={3 / zoom}
                      rx={3 / zoom}
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
                  const halfW = ((m.nx2 - m.nx1) / 2) * rW;
                  const halfH = ((m.ny2 - m.ny1) / 2) * rH;
                  const isActive = activeId === m.id;
                  const isDragging = draggingId === m.id;
                  const menuOpen = dotMenu?.id === m.id;
                  const near = dotHoverPos
                    ? Math.hypot(dotHoverPos.x - cx, dotHoverPos.y - cy) <= Math.max(halfW, halfH) + 36 / zoom
                    : false;
                  const revealed = isActive || isDragging || menuOpen || near;
                  const r = revealed ? 6.5 / zoom : 5 / zoom;
                  const dotOpacity = revealed ? 1 : 0.8;
                  const borderW = isActive ? 2 / zoom : 1 / zoom;
                  const mx = imageBounds.left + (m.nx1 + m.dx) * rW;
                  const my = imageBounds.top + (m.ny1 + m.dy) * rH;
                  const mw = (m.nx2 - m.nx1) * rW;
                  const mh = (m.ny2 - m.ny1) * rH;
                  return (
                    <g key={m.id}>
                      {revealed && m.kind === "object" && (
                        // Actual inpaint mask: the padded detection box.
                        <rect
                          x={mx} y={my} width={mw} height={mh}
                          rx={3 / zoom}
                          fill="rgba(59,130,246,0.22)"
                          stroke="#3b82f6"
                          strokeWidth={2 / zoom}
                        />
                      )}
                      {revealed && m.kind === "brush" && m.dataUrl && (
                        // Actual brush mask, drawn in place (mask canvas is full-image sized).
                        <image
                          href={m.dataUrl}
                          x={imageBounds.left + m.dx * rW}
                          y={imageBounds.top + m.dy * rH}
                          width={rW}
                          height={rH}
                          opacity={0.5}
                          preserveAspectRatio="none"
                        />
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
              onClick={() => { setActiveId(dotMenu.id); setDotMenu(null); }}
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
                Remove
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
        onSelectImage={onSelectImage}
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
      />
    </div>
  );
};

export default LoupeView;