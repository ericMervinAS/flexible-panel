import * as ort from 'onnxruntime-web';

const DET_SIZE = 320;
const CONF_THRESH = 0.03;
const NMS_THRESH = 0.48;

// ── Classes ───────────────────────────────────────────────────────────────────
// Order must match the custom YOLOv8n training label order
export const DISTRACTION_CLASSES = [
  'Exit Sign',
  'Fire Extinguisher',
  'Smoke Detector',
  'Electrical Outlet',
  'Thermostat',
  'Trash Can',
] as const;

export type DistractionClass = (typeof DISTRACTION_CLASSES)[number];

export const DISTRACTION_MODEL_URL = '/api/models/distraction';

// Classes the model can technically detect but that we don't scan for or
// surface in the UI — excluded at decode time so they never enter a
// detection map in the first place.
const EXCLUDED_CLASS_IDS = new Set<number>();

// ── Public types ───────────────────────────────────────────────────────────────

export interface DistractionDetection {
  x1: number; y1: number; x2: number; y2: number;
  score: number;
  classId: number;
  label: DistractionClass;
}

export const MODEL_TO_UI: Record<string, string> = {
  "Exit Sign": "Exit Signs",
  "Smoke Detector": "Fire Alarms",
  "Fire Extinguisher": "Fire Extinguishers",
  "Thermostat": "Thermostats",
  "Trash Can": "Trash Cans",
  "Electrical Outlet": "Electrical Outlets",
};

// ── Preprocessing ─────────────────────────────────────────────────────────────
// Letterbox to 640×640 with gray padding, output [1,3,640,640] RGB/255 NCHW

function preprocessYolo(img: HTMLImageElement): {
  tensor: ort.Tensor;
  scale: number;
  padX: number;
  padY: number;
} {
  const scale = Math.min(DET_SIZE / img.naturalWidth, DET_SIZE / img.naturalHeight);
  const newW = Math.round(img.naturalWidth * scale);
  const newH = Math.round(img.naturalHeight * scale);
  const padX = Math.floor((DET_SIZE - newW) / 2);
  const padY = Math.floor((DET_SIZE - newH) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = DET_SIZE;
  canvas.height = DET_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, DET_SIZE, DET_SIZE);
  ctx.drawImage(img, padX, padY, newW, newH);

  const data = ctx.getImageData(0, 0, DET_SIZE, DET_SIZE).data;
  const n = DET_SIZE * DET_SIZE;
  const arr = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    arr[0 * n + i] = data[i * 4] / 255;
    arr[1 * n + i] = data[i * 4 + 1] / 255;
    arr[2 * n + i] = data[i * 4 + 2] / 255;
  }
  return {
    tensor: new ort.Tensor('float32', arr, [1, 3, DET_SIZE, DET_SIZE]),
    scale,
    padX,
    padY,
  };
}

// ── NMS (reused from face detection) ─────────────────────────────────────────

function iou(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const inter =
    Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-12);
}

function nms(
  boxes: [number, number, number, number][],
  scores: number[],
  threshold: number,
): number[] {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const suppressed = new Uint8Array(boxes.length);
  const keep: number[] = [];
  for (let p = 0; p < order.length; p++) {
    const i = order[p];
    if (suppressed[i]) continue;
    keep.push(i);
    for (let q = p + 1; q < order.length; q++) {
      const j = order[q];
      if (!suppressed[j] && iou(boxes[i], boxes[j]) >= threshold) suppressed[j] = 1;
    }
  }
  return keep;
}

// ── YOLOv8 output decoding ────────────────────────────────────────────────────
// Output shape: [1, 4+numClasses, numAnchors]
// cx/cy/w/h are in letterboxed pixel space (0–640)

function decodeYoloOutput(
  raw: Float32Array,
  numClasses: number,
  numAnchors: number,
  scale: number,
  padX: number,
  padY: number,
  imgW: number,
  imgH: number,
): DistractionDetection[] {
  const boxes: [number, number, number, number][] = [];
  const scores: number[] = [];
  const classIds: number[] = [];

  for (let a = 0; a < numAnchors; a++) {
    let bestScore = 0;
    let bestClass = 0;
    for (let c = 0; c < numClasses; c++) {
      if (EXCLUDED_CLASS_IDS.has(c)) continue;
      const s = raw[(4 + c) * numAnchors + a];
      if (s > bestScore) { bestScore = s; bestClass = c; }
    }
    if (bestScore < CONF_THRESH) continue;

    const cx = raw[0 * numAnchors + a];
    const cy = raw[1 * numAnchors + a];
    const w = raw[2 * numAnchors + a];
    const h = raw[3 * numAnchors + a];

    const x1 = Math.max(0, Math.min(imgW, (cx - w / 2 - padX) / scale));
    const y1 = Math.max(0, Math.min(imgH, (cy - h / 2 - padY) / scale));
    const x2 = Math.max(0, Math.min(imgW, (cx + w / 2 - padX) / scale));
    const y2 = Math.max(0, Math.min(imgH, (cy + h / 2 - padY) / scale));

    boxes.push([x1, y1, x2, y2]);
    scores.push(bestScore);
    classIds.push(bestClass);
  }

  const keepIdx = nms(boxes, scores, NMS_THRESH);
  return keepIdx.map((i) => ({
    x1: boxes[i][0],
    y1: boxes[i][1],
    x2: boxes[i][2],
    y2: boxes[i][3],
    score: scores[i],
    classId: classIds[i],
    label: DISTRACTION_CLASSES[classIds[i]],
  }));
}

// ── Service class ─────────────────────────────────────────────────────────────

export class DistractionDetectionService {
  private session: ort.InferenceSession | null = null;

  get isReady(): boolean { return this.session !== null; }

  async loadModel(
    url = DISTRACTION_MODEL_URL,
    onStatus?: (msg: string) => void,
  ): Promise<void> {
    onStatus?.('Fetching distraction model…');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching distraction model`);
    const buf = await resp.arrayBuffer();
    onStatus?.(`Compiling distraction model (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)…`);
    this.session = await ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    onStatus?.('Distraction model ready');
  }

  async processImages(
    imageSrcs: string[],
    onStatus?: (msg: string, idx: number, total: number) => void,
  ): Promise<Map<number, DistractionDetection[]>> {
    if (!this.session) throw new Error('Model not loaded');
    const result = new Map<number, DistractionDetection[]>();

    for (let idx = 0; idx < imageSrcs.length; idx++) {
      onStatus?.(`[${idx + 1}/${imageSrcs.length}] Scanning for distractions…`, idx, imageSrcs.length);
      try {
        const img = await this.loadImg(imageSrcs[idx]);
        const { tensor, scale, padX, padY } = preprocessYolo(img);
        const out = await this.session.run({ [this.session.inputNames[0]]: tensor });
        const outTensor = out[this.session.outputNames[0]];
        const dims = outTensor.dims as number[];
        // dims = [1, 4+numClasses, numAnchors]
        const numAnchors = dims[2];
        const numClasses = dims[1] - 4;
        const raw = outTensor.data as Float32Array;
        const dets = decodeYoloOutput(raw, numClasses, numAnchors, scale, padX, padY, img.naturalWidth, img.naturalHeight);
        if (dets.length > 0) result.set(idx, dets);
      } catch (e) {
        console.error(`Distraction detection failed on image ${idx}:`, e);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return result;
  }

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  dispose(): void {
    this.session?.release();
    this.session = null;
  }
}
