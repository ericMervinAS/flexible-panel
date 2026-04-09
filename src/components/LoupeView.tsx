import { useRef, useEffect, useState } from "react";
import { Star, Flag, Info, Eye, RotateCcw, Columns2, Keyboard, ChevronDown } from "lucide-react";
import type { ImageData, ColorTag } from "./ImageGrid";
import BrushToolbar from "./BrushToolbar";

const colorTagBg: Record<ColorTag, string> = {
  green: "#15803d",
  yellow: "#a16207",
  red: "#b91c1c",
  none: "transparent",
};

const filmstripPillBg: Record<ColorTag, string> = {
  green: "#1f6a46",
  yellow: "#a16207",
  red: "#ac3131",
  none: "#303030",
};

// Preset zoom levels expressed as percentages of true image size
const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 400];

interface LoupeViewProps {
  image: ImageData;
  images: ImageData[];
  currentIndex: number;
  totalImages: number;
  onSelectImage: (index: number) => void;
  isPatchActive?: boolean;
  onHasStrokesChange?: (has: boolean) => void;
  clearCanvasSignal?: number;
  autoRemoveAfterStroke?: boolean;
  isExternallyRemoving?: boolean;
}

const LoupeView = ({
  image,
  images,
  currentIndex,
  totalImages,
  onSelectImage,
  isPatchActive = false,
  onHasStrokesChange,
  clearCanvasSignal = 0,
  autoRemoveAfterStroke = false,
  isExternallyRemoving = false,
}: LoupeViewProps) => {
  const stripRef      = useRef<HTMLDivElement>(null);
  const tileRefs      = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const imgRef        = useRef<HTMLImageElement>(null);
  const zoomDropdownRef = useRef<HTMLDivElement>(null);

  // ── Zoom / pan ───────────────────────────────────────────────────────────────
  // Refs hold the live values (safe inside event listeners).
  // State drives re-renders.
  const zoomRef = useRef(1);
  const panRef  = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });

  // CSS zoom factor that corresponds to 1 image-pixel = 1 screen-pixel.
  // Computed after the image loads; null until then.
  const trueHundredZoomRef = useRef<number | null>(null);

  // Last non-fit zoom state, for spacebar toggle.
  const prevZoomStateRef = useRef<{ zoom: number; pan: { x: number; y: number } } | null>(null);

  // ── Pan-drag state ───────────────────────────────────────────────────────────
  const isPanningRef  = useRef(false);
  const panStartRef   = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // ── Zoom dropdown ────────────────────────────────────────────────────────────
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);

  // ── Shift key — enables grab-to-pan while in patch mode ──────────────────────
  const isShiftHeldRef = useRef(false);
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  // ── Rendered image bounds in canvas space — used to constrain drawing ────────
  const imageBoundsRef = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);

  // ── Brush cursor (raw container coords) ─────────────────────────────────────
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(null);

  // ── Drawing refs ─────────────────────────────────────────────────────────────
  const isDrawingRef           = useRef(false);
  const lastPosRef             = useRef<{ x: number; y: number } | null>(null);
  const hasStrokesRef          = useRef(false);
  const committedHasStrokesRef = useRef(false);
  const committedSnapshotRef   = useRef<globalThis.ImageData | null>(null);
  const currentStrokeRef       = useRef<{ x: number; y: number }[]>([]);
  const autoRemoveTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isAutoRemoving, setIsAutoRemoving] = useState(false);

  // ── Brush size (controlled by BrushToolbar) ──────────────────────────────────
  const [brushSize, setBrushSize] = useState(50);

  // Prop refs — keep global listeners free from stale closures
  const autoRemoveAfterStrokeRef = useRef(autoRemoveAfterStroke);
  autoRemoveAfterStrokeRef.current = autoRemoveAfterStroke;
  const onHasStrokesChangeRef = useRef(onHasStrokesChange);
  onHasStrokesChangeRef.current = onHasStrokesChange;

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  const applyZoomAndPan = (newZoom: number, newPan: { x: number; y: number }) => {
    zoomRef.current = newZoom;
    panRef.current  = newPan;
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
    const img       = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cW = container.clientWidth, cH = container.clientHeight;
    const nW = img.naturalWidth,      nH = img.naturalHeight;
    if (!nW || !nH) return;
    // At CSS zoom=1 the image fills the container via object-contain
    const renderedW = (cW / cH) >= (nW / nH) ? cH * (nW / nH) : cW;
    trueHundredZoomRef.current = nW / renderedW;
  };

  // Compute the image's rendered bounds in canvas space (px).
  // The canvas is the same size as the container; the image is object-contain centered.
  const computeImageBounds = () => {
    const img       = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const cW = container.clientWidth,  cH = container.clientHeight;
    const nW = img.naturalWidth,       nH = img.naturalHeight;
    if (!nW || !nH) return;
    const renderedW = (cW / cH) >= (nW / nH) ? cH * (nW / nH) : cW;
    const renderedH = (cW / cH) >= (nW / nH) ? cH : cW * (nH / nW);
    imageBoundsRef.current = {
      left:   (cW - renderedW) / 2,
      top:    (cH - renderedH) / 2,
      right:  (cW + renderedW) / 2,
      bottom: (cH + renderedH) / 2,
    };
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

  // ── Auto-remove timer ────────────────────────────────────────────────────────
  const clearAutoRemove = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current          = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current   = null;
    onHasStrokesChangeRef.current?.(false);
    setIsAutoRemoving(false);
    autoRemoveTimerRef.current = null;
  };

  const startAutoRemoveTimer = () => {
    if (autoRemoveTimerRef.current) clearTimeout(autoRemoveTimerRef.current);
    setIsAutoRemoving(true);
    autoRemoveTimerRef.current = setTimeout(clearAutoRemove, 2000);
  };

  // ── Filmstrip auto-scroll ────────────────────────────────────────────────────
  useEffect(() => {
    const strip = stripRef.current;
    const tile  = tileRefs.current[currentIndex];
    if (!strip || !tile) return;
    strip.scrollTo({
      left: tile.offsetLeft - strip.offsetWidth / 2 + tile.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [currentIndex]);

  // ── Shift key tracking — enables grab-to-pan in patch mode ─────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") { isShiftHeldRef.current = true;  setIsShiftHeld(true);  }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") { isShiftHeldRef.current = false; setIsShiftHeld(false); }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup",   onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup",   onUp);
    };
  }, []);

  // ── Keyboard navigation + spacebar zoom toggle ───────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  onSelectImage(Math.max(0, currentIndex - 1));
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
  }, [currentIndex, totalImages, onSelectImage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep canvas pixel dimensions in sync with container ─────────────────────
  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sync = () => {
      const tmp = document.createElement("canvas");
      tmp.width  = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext("2d")?.drawImage(canvas, 0, 0);
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      canvas.getContext("2d")?.drawImage(tmp, 0, 0);
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
    // Reset zoom / pan / true-100 / image bounds (recomputed on image load)
    zoomRef.current            = 1;
    panRef.current             = { x: 0, y: 0 };
    trueHundredZoomRef.current = null;
    prevZoomStateRef.current   = null;
    imageBoundsRef.current     = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current          = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current   = null;
    onHasStrokesChange?.(false);
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wheel zoom (passive:false so we can preventDefault) ─────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor  = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.max(0.5, Math.min(4, zoomRef.current * factor));
      const rect    = container.getBoundingClientRect();
      const cx      = e.clientX - rect.left - rect.width  / 2;
      const cy      = e.clientY - rect.top  - rect.height / 2;
      const newPan  = {
        x: cx - (cx - panRef.current.x) * newZoom / zoomRef.current,
        y: cy - (cy - panRef.current.y) * newZoom / zoomRef.current,
      };
      // Save pre-zoom state for spacebar toggle before each wheel change
      if (zoomRef.current === 1 && panRef.current.x === 0 && panRef.current.y === 0) {
        prevZoomStateRef.current = { zoom: zoomRef.current, pan: { ...panRef.current } };
      }
      zoomRef.current = newZoom;
      panRef.current  = newPan;
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
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokesRef.current          = false;
    committedHasStrokesRef.current = false;
    committedSnapshotRef.current   = null;
    onHasStrokesChange?.(false);
  }, [clearCanvasSignal]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const stop = (e: MouseEvent) => {
      // Stop panning
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
        // If this was a click (no drag), treat as no-op
        void e;
      }
      // Stop drawing
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      const ctx    = canvas?.getContext("2d");
      if (ctx && canvas) {
        committedSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      currentStrokeRef.current = [];
      isDrawingRef.current     = false;
      lastPosRef.current       = null;
    };

    const checkBounds = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const outside =
        e.clientX < rect.left  || e.clientX > rect.right ||
        e.clientY < rect.top   || e.clientY > rect.bottom;
      if (!outside) return;

      setBrushPos(null);
      if (autoRemoveAfterStrokeRef.current) {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext("2d");
        if (ctx && canvas && committedSnapshotRef.current) {
          ctx.putImageData(committedSnapshotRef.current, 0, 0);
        }
        if (!committedHasStrokesRef.current) {
          hasStrokesRef.current = false;
          onHasStrokesChangeRef.current?.(false);
        }
        currentStrokeRef.current = [];
        isDrawingRef.current     = false;
        lastPosRef.current       = null;
      } else {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext("2d");
        if (ctx && canvas) {
          committedSnapshotRef.current   = ctx.getImageData(0, 0, canvas.width, canvas.height);
          committedHasStrokesRef.current = true;
        }
        currentStrokeRef.current = [];
        isDrawingRef.current     = false;
        lastPosRef.current       = null;
      }
    };

    window.addEventListener("mouseup",   stop);
    window.addEventListener("mousemove", checkBounds);
    return () => {
      window.removeEventListener("mouseup",   stop);
      window.removeEventListener("mousemove", checkBounds);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drawing ──────────────────────────────────────────────────────────────────
  const redrawCurrentStroke = () => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const points = currentStrokeRef.current;
    if (points.length === 0) return;

    if (committedSnapshotRef.current) {
      ctx.putImageData(committedSnapshotRef.current, 0, 0);
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgb(59, 130, 246)";
    ctx.lineWidth   = brushSize;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // Maps a React mouse event in container space → canvas pixel space
  const posFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cW   = rect.width, cH = rect.height;
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    const z    = zoomRef.current, p = panRef.current;
    return {
      x: (cx - cW / 2 - p.x) / z + cW / 2,
      y: (cy - cH / 2 - p.y) / z + cH / 2,
    };
  };

  const commitStroke = () => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (ctx && canvas) {
      committedSnapshotRef.current   = ctx.getImageData(0, 0, canvas.width, canvas.height);
      committedHasStrokesRef.current = true;
    }
    currentStrokeRef.current = [];
    isDrawingRef.current     = false;
    lastPosRef.current       = null;
  };

  const discardStroke = () => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (ctx && canvas && committedSnapshotRef.current) {
      ctx.putImageData(committedSnapshotRef.current, 0, 0);
    }
    if (!committedHasStrokesRef.current) {
      hasStrokesRef.current = false;
      onHasStrokesChange?.(false);
    }
    currentStrokeRef.current = [];
    isDrawingRef.current     = false;
    lastPosRef.current       = null;
  };

  // ── Mouse handlers ───────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Pan: either not in patch mode, or Shift held in patch mode
    if (!isPatchActive || e.shiftKey) {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX:   panRef.current.x,
        panY:   panRef.current.y,
      };
      return;
    }

    // Drawing mode — only start if cursor is over the image
    const canvasPos = posFromEvent(e);
    if (!isInsideImage(canvasPos)) return;

    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if (autoRemoveTimerRef.current) {
      clearTimeout(autoRemoveTimerRef.current);
      autoRemoveTimerRef.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasStrokesRef.current          = false;
      committedHasStrokesRef.current = false;
      committedSnapshotRef.current   = null;
      onHasStrokesChangeRef.current?.(false);
      setIsAutoRemoving(false);
    }

    committedSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    currentStrokeRef.current     = [canvasPos];
    isDrawingRef.current         = true;
    lastPosRef.current           = canvasPos;
    redrawCurrentStroke();

    if (!hasStrokesRef.current) {
      hasStrokesRef.current = true;
      onHasStrokesChange?.(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle pan drag
    if (isPanningRef.current) {
      const dx     = e.clientX - panStartRef.current.mouseX;
      const dy     = e.clientY - panStartRef.current.mouseY;
      const newPan = {
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      };
      panRef.current = newPan;
      setPan(newPan);
      return;
    }

    const rect      = e.currentTarget.getBoundingClientRect();
    const rawPos    = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const canvasPos = posFromEvent(e);
    const inside    = isInsideImage(canvasPos);

    // Show brush cursor only when over the image and not in shift-pan mode
    if (isPatchActive && !isShiftHeldRef.current) {
      setBrushPos(inside ? rawPos : null);
    } else {
      setBrushPos(null);
    }

    if (isPatchActive && isDrawingRef.current) {
      if (!inside) {
        // Cursor exited the image — commit the stroke and stop
        commitStroke();
        if (autoRemoveAfterStrokeRef.current) startAutoRemoveTimer();
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
    if (autoRemoveAfterStrokeRef.current) startAutoRemoveTimer();
  };

  const handleMouseLeave = () => {
    setBrushPos(null);
    // Keep panning across boundary (global mouseup stops it)
    if (isPanningRef.current) return;
    if (isDrawingRef.current) {
      autoRemoveAfterStrokeRef.current ? discardStroke() : commitStroke();
    }
  };

  // ── Cursor class ─────────────────────────────────────────────────────────────
  const cursorClass = isPatchActive && !isShiftHeld
    ? "cursor-none"
    : isPanning
      ? "cursor-grabbing"
      : "cursor-grab";

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
      >
        {/* Zoom + pan wrapper — image and canvas scale together */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform:       `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <img
            ref={imgRef}
            src={image.src}
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
        </div>

        {/* Brush cursor ring — container space, sized to match visual brush */}
        {isPatchActive && brushPos && (
          <div
            className="absolute pointer-events-none rounded-full border border-white/80"
            style={{
              left:      brushPos.x,
              top:       brushPos.y,
              width:     brushSize * zoom,
              height:    brushSize * zoom,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
            }}
          />
        )}

        {/* Canvas removal loader */}
        {(isAutoRemoving || isExternallyRemoving) && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 pointer-events-none">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#ababab] border-t-transparent animate-spin shrink-0" />
            <span className="text-[12px] text-[#e2e2e2]">Removing…</span>
          </div>
        )}

        {/* ── Brush toolbar ────────────────────────────────────────────────── */}
        {isPatchActive && <BrushToolbar onBrushSizeChange={setBrushSize} />}
      </div>

      {/* ── Filmstrip ───────────────────────────────────────────────────────── */}
      <div className="bg-[#1c1c1c] shrink-0">
        <div
          ref={stripRef}
          className="flex gap-1 h-[87px] items-center px-2 py-1 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((img, i) => (
            <div
              key={i}
              ref={(el) => { tileRefs.current[i] = el; }}
              className="flex flex-col gap-1 items-center shrink-0 cursor-pointer"
              onClick={() => onSelectImage(i)}
            >
              <div
                className={`rounded-md p-[3px] transition-colors ${
                  i === currentIndex
                    ? "border-2 border-white"
                    : "border border-[#303030] hover:border-[#5e5e5e]"
                }`}
              >
                <div className="w-[96px] h-[64px] overflow-hidden rounded-[2px]">
                  <img
                    src={img.src}
                    alt={img.filename}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              </div>
              <div
                className="h-1 w-6 rounded-full shrink-0"
                style={{ backgroundColor: filmstripPillBg[img.colorTag] }}
              />
            </div>
          ))}
        </div>
        <div className="h-3 px-2 flex items-center">
          <div className="h-1 w-14 bg-[#777] rounded-full" />
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between h-10 pl-2 pr-4 bg-[#1c1c1c] border-t border-background shrink-0">
        <div className="flex items-center gap-3 w-[220px]">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[13px] text-[#e2e2e2] font-normal truncate">{image.filename}</span>
            <Info className="w-4 h-4 text-[#777] shrink-0" />
          </div>
          <div className="w-px h-4 bg-[#303030] shrink-0" />
          <div className="flex items-center gap-1 text-[#ababab] shrink-0">
            <Eye className="w-4 h-4" />
            <span className="text-[12px] font-medium whitespace-nowrap">
              {currentIndex + 1} / {totalImages}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div
            className="flex items-center gap-[2px] px-2 py-1 rounded-md shrink-0"
            style={{ backgroundColor: image.colorTag !== "none" ? colorTagBg[image.colorTag] : "#303030" }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={12} fill={i < image.stars ? "white" : "rgba(255,255,255,0.3)"} strokeWidth={0} />
            ))}
          </div>
          <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
            <Flag size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-[220px] justify-end">
          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
              <RotateCcw size={16} />
            </button>
            <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
              <Columns2 size={16} />
            </button>
          </div>
          <div className="w-px h-4 bg-[#303030]" />

          {/* ── Zoom controls ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5">
            {/* Fit button */}
            <button
              onClick={goToFit}
              className={`text-[12px] font-medium transition-colors ${
                isFit ? "text-[#e2e2e2]" : "text-[#555] hover:text-[#ababab]"
              }`}
            >
              Fit
            </button>

            {/* Zoom picker: current % + preset dropdown */}
            <div className="relative flex items-center gap-0.5" ref={zoomDropdownRef}>
              <button
                onClick={goToTrueHundred}
                title="Jump to 100% (actual pixels)"
                className={`text-[12px] font-medium transition-colors ${
                  !isFit ? "text-[#e2e2e2]" : "text-[#777] hover:text-[#ababab]"
                }`}
              >
                {displayPct()}%
              </button>
              <button
                onClick={() => setShowZoomDropdown((v) => !v)}
                className="text-[#555] hover:text-[#ababab] transition-colors flex items-center"
              >
                <ChevronDown size={12} />
              </button>

              {/* Preset dropdown */}
              {showZoomDropdown && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#242424] border border-[#303030] rounded-[6px] py-1 z-50 min-w-[100px] shadow-lg">
                  <button
                    onClick={() => { handleZoomPreset("fit"); setShowZoomDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${
                      isFit ? "text-[#e2e2e2]" : "text-[#ababab] hover:text-[#e2e2e2]"
                    }`}
                  >
                    Fit
                  </button>
                  {ZOOM_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => { handleZoomPreset(pct); setShowZoomDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors hover:bg-[#303030] ${
                        !isFit && displayPct() === pct ? "text-[#e2e2e2]" : "text-[#ababab] hover:text-[#e2e2e2]"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-px h-4 bg-[#303030]" />
          <button className="flex items-center justify-center w-5 h-5 text-[#777] hover:text-[#ababab] transition-colors">
            <Keyboard size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LoupeView;
