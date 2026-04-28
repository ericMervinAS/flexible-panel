import * as ort from 'onnxruntime-web';

// Configure ORT once — point to locally served WASM files (see vite.config.ts middleware)
if (typeof window !== 'undefined') {
  ort.env.wasm.wasmPaths = '/ort/';
  // numThreads=1 avoids SharedArrayBuffer requirement in most browsers
  ort.env.wasm.numThreads = 1;
}

// ── Detection config (matches amd/retinaface MobileNet0.25, INT8) ─────────────
const INPUT_H = 608;
const INPUT_W = 640;
const STEPS = [8, 16, 32];
const MIN_SIZES = [[16, 32], [64, 128], [256, 512]];
const VARIANCES: [number, number] = [0.1, 0.2];

// ── Recognition config (ArcFace MobileFaceNet, immich-app/buffalo_s) ──────────
const ARCFACE_SIZE = 112;
// Canonical 5-point template — left-eye, right-eye, nose, left-mouth, right-mouth
const ARCFACE_TEMPLATE: [number, number][] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

export const RETINA_MODEL_URL    = '/api/models/retinaface';
export const ARCFACE_MODEL_URL   = '/api/models/arcface';
// InsightFace genderage.onnx (1.3MB) — bundled as a static asset
export const GENDERAGE_MODEL_URL = '/models/genderage.onnx';
const GENDERAGE_SIZE = 96;

// ── Subject category ──────────────────────────────────────────────────────────

export type SubjectCategory = 'Masculine' | 'Feminine' | 'Elderly' | 'Child';

/**
 * Maps gender+age to one of the four UI chip categories.
 *   Child     — age < 13 (any gender)
 *   Elderly   — age >= 60 (any gender)
 *   Masculine — male, age 13-59 (or male when age unknown)
 *   Feminine  — female, age 13-59 (or female when age unknown)
 */
export function getSubjectCategory(
  gender?: 'Female' | 'Male',
  age?: number,
): SubjectCategory | undefined {
  if (age !== undefined) {
    if (age < 13) return 'Child';
    if (age >= 60) return 'Elderly';
  }
  if (gender === 'Male') return 'Masculine';
  if (gender === 'Female') return 'Feminine';
  return undefined;
}

// ── Public types ───────────────────────────────────────────────────────────────

export interface Detection {
  x1: number; y1: number; x2: number; y2: number;
  score: number;
  landmarks: [number, number][] | null;
}

export interface FaceRecord {
  imageIndex: number;
  detection: Detection;
  cropDataUrl: string;
  embedding: Float32Array | null;
  gender?: 'Female' | 'Male';
  age?: number;
}

export interface FaceCluster {
  id: number;
  keyFaceDataUrl: string; // crop from the highest-score detection in this cluster
  photoCount: number;
  appearances: Array<{ imageIndex: number; score: number }>;
  gender?: 'Female' | 'Male';
  age?: number;
  category?: SubjectCategory;
}

// ── Anchor generation ──────────────────────────────────────────────────────────
function generateAnchors(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let lvl = 0; lvl < STEPS.length; lvl++) {
    const step = STEPS[lvl];
    const sizes = MIN_SIZES[lvl];
    const fh = Math.ceil(INPUT_H / step);
    const fw = Math.ceil(INPUT_W / step);
    for (let i = 0; i < fh; i++) {
      for (let j = 0; j < fw; j++) {
        for (const minSize of sizes) {
          out.push([
            ((j + 0.5) * step) / INPUT_W,
            ((i + 0.5) * step) / INPUT_H,
            minSize / INPUT_W,
            minSize / INPUT_H,
          ]);
        }
      }
    }
  }
  return out;
}

function decodeBoxes(
  loc: Float32Array,
  anchors: [number, number, number, number][],
): [number, number, number, number][] {
  const [v0, v1] = VARIANCES;
  return anchors.map((a, i) => {
    const cx = a[0] + loc[i * 4] * v0 * a[2];
    const cy = a[1] + loc[i * 4 + 1] * v0 * a[3];
    const w = a[2] * Math.exp(loc[i * 4 + 2] * v1);
    const h = a[3] * Math.exp(loc[i * 4 + 3] * v1);
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  });
}

function decodeLandmarks(
  landm: Float32Array,
  anchors: [number, number, number, number][],
): [number, number][][] {
  const v0 = VARIANCES[0];
  return anchors.map((a, i) =>
    Array.from({ length: 5 }, (_, k): [number, number] => [
      a[0] + landm[i * 10 + k * 2] * v0 * a[2],
      a[1] + landm[i * 10 + k * 2 + 1] * v0 * a[3],
    ]),
  );
}

function iou(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const inter =
    Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return inter / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter + 1e-12);
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

// ── Image preprocessing ────────────────────────────────────────────────────────

function preprocessDetect(img: HTMLImageElement): { tensor: ort.Tensor; scale: number } {
  const scale = Math.min(INPUT_W / img.naturalWidth, INPUT_H / img.naturalHeight);
  const newW = Math.round(img.naturalWidth * scale);
  const newH = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = INPUT_W;
  canvas.height = INPUT_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, INPUT_W, INPUT_H);
  ctx.drawImage(img, 0, 0, newW, newH);

  const data = ctx.getImageData(0, 0, INPUT_W, INPUT_H).data;
  const arr = new Float32Array(INPUT_H * INPUT_W * 3);
  for (let i = 0, n = INPUT_H * INPUT_W; i < n; i++) {
    arr[i * 3]     = data[i * 4 + 2] - 104; // B
    arr[i * 3 + 1] = data[i * 4 + 1] - 117; // G
    arr[i * 3 + 2] = data[i * 4]     - 123; // R
  }
  return { tensor: new ort.Tensor('float32', arr, [1, INPUT_H, INPUT_W, 3]), scale };
}

function cropFace(img: HTMLImageElement, det: Detection, size = 96): string {
  const cx = (det.x1 + det.x2) / 2;
  const cy = (det.y1 + det.y2) / 2;
  const half = (Math.max(det.x2 - det.x1, det.y2 - det.y1) / 2) * 1.2;
  const sx = Math.max(0, cx - half);
  const sy = Math.max(0, cy - half);
  const sw = Math.min(img.naturalWidth - sx, half * 2);
  const sh = Math.min(img.naturalHeight - sy, half * 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}


// ── Face alignment ─────────────────────────────────────────────────────────────

function similarityTransform(
  src: [number, number][],
  dst: [number, number][],
): { a: number; b: number; tx: number; ty: number } {
  const n = src.length;
  let sxm = 0, sym = 0, dxm = 0, dym = 0;
  for (let i = 0; i < n; i++) { sxm += src[i][0]; sym += src[i][1]; dxm += dst[i][0]; dym += dst[i][1]; }
  sxm /= n; sym /= n; dxm /= n; dym /= n;
  let na = 0, nb = 0, denom = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - sxm, sy = src[i][1] - sym;
    const dx = dst[i][0] - dxm, dy = dst[i][1] - dym;
    na += sx * dx + sy * dy; nb += sx * dy - sy * dx; denom += sx * sx + sy * sy;
  }
  const a = na / denom, b = nb / denom;
  return { a, b, tx: dxm - (a * sxm - b * sym), ty: dym - (b * sxm + a * sym) };
}

function alignFaceToTemplate(
  img: HTMLImageElement,
  landmarks: [number, number][],
  template: [number, number][],
  size: number,
): HTMLCanvasElement {
  const { a, b, tx, ty } = similarityTransform(landmarks, template);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.setTransform(a, b, -b, a, tx, ty);
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}

function alignFace(img: HTMLImageElement, landmarks: [number, number][]): HTMLCanvasElement {
  return alignFaceToTemplate(img, landmarks, ARCFACE_TEMPLATE, ARCFACE_SIZE);
}

// InsightFace genderage crop: square region centred on bbox, side = max(w,h) × 1.5,
// resized to 96×96. Output tensor is NCHW float32 RGB with raw 0–255 values
// (the model was exported with mean=0, std=1 in cv2.dnn.blobFromImage).
function preprocessGenderAge(img: HTMLImageElement, det: Detection): ort.Tensor {
  const cx = (det.x1 + det.x2) / 2;
  const cy = (det.y1 + det.y2) / 2;
  const side = Math.max(det.x2 - det.x1, det.y2 - det.y1) * 1.5;
  const sx = cx - side / 2;
  const sy = cy - side / 2;

  const canvas = document.createElement('canvas');
  canvas.width = GENDERAGE_SIZE;
  canvas.height = GENDERAGE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, GENDERAGE_SIZE, GENDERAGE_SIZE);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, GENDERAGE_SIZE, GENDERAGE_SIZE);

  const data = ctx.getImageData(0, 0, GENDERAGE_SIZE, GENDERAGE_SIZE).data;
  const n = GENDERAGE_SIZE * GENDERAGE_SIZE;
  const arr = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    arr[0 * n + i] = data[i * 4];     // R
    arr[1 * n + i] = data[i * 4 + 1]; // G
    arr[2 * n + i] = data[i * 4 + 2]; // B
  }
  return new ort.Tensor('float32', arr, [1, 3, GENDERAGE_SIZE, GENDERAGE_SIZE]);
}

function preprocessArcFace(canvas112: HTMLCanvasElement): ort.Tensor {
  const ctx = canvas112.getContext('2d', { willReadFrequently: true })!;
  const data = ctx.getImageData(0, 0, ARCFACE_SIZE, ARCFACE_SIZE).data;
  const n = ARCFACE_SIZE * ARCFACE_SIZE;
  const arr = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    arr[0 * n + i] = (data[i * 4]     - 127.5) / 127.5; // R
    arr[1 * n + i] = (data[i * 4 + 1] - 127.5) / 127.5; // G
    arr[2 * n + i] = (data[i * 4 + 2] - 127.5) / 127.5; // B
  }
  return new ort.Tensor('float32', arr, [1, 3, ARCFACE_SIZE, ARCFACE_SIZE]);
}


function computeSharpness(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let sum = 0, sum2 = 0, cnt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        -gray[(y-1)*w+(x-1)] - gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)]
        - gray[y*w+(x-1)] + 8*gray[y*w+x] - gray[y*w+(x+1)]
        - gray[(y+1)*w+(x-1)] - gray[(y+1)*w+x] - gray[(y+1)*w+(x+1)];
      sum += lap; sum2 += lap * lap; cnt++;
    }
  }
  const mean = sum / cnt;
  return sum2 / cnt - mean * mean;
}

function l2normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

// ── Clustering ─────────────────────────────────────────────────────────────────

function cosSim(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

interface RawCluster { centroid: Float32Array; members: number[] }

function clusterFaces(faces: FaceRecord[], threshold: number): RawCluster[] {
  const clusters: RawCluster[] = [];
  for (let i = 0; i < faces.length; i++) {
    const emb = faces[i].embedding;
    if (!emb) continue;
    let bestC = -1, bestSim = -Infinity;
    for (let c = 0; c < clusters.length; c++) {
      const sim = cosSim(emb, clusters[c].centroid);
      if (sim > bestSim) { bestSim = sim; bestC = c; }
    }
    if (bestC >= 0 && bestSim >= threshold) {
      const cl = clusters[bestC];
      cl.members.push(i);
      const k = cl.members.length;
      for (let d = 0; d < emb.length; d++) cl.centroid[d] = ((k-1)*cl.centroid[d]+emb[d])/k;
      cl.centroid = l2normalize(cl.centroid);
    } else {
      clusters.push({ centroid: new Float32Array(emb), members: [i] });
    }
  }
  clusters.sort((a, b) => b.members.length - a.members.length);
  return clusters;
}

function aggregateGenderAge(members: FaceRecord[]): { gender?: 'Female' | 'Male'; age?: number; category?: SubjectCategory } {
  const genders = members.map((f) => f.gender).filter((g): g is 'Female' | 'Male' => g !== undefined);
  const ages = members.map((f) => f.age).filter((a): a is number => a !== undefined);
  const gender: 'Female' | 'Male' | undefined = genders.length
    ? genders.filter((g) => g === 'Female').length > genders.length / 2 ? 'Female' : 'Male'
    : undefined;
  const age: number | undefined = ages.length
    ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
    : undefined;
  return { gender, age, category: getSubjectCategory(gender, age) };
}

// ── Main service class ─────────────────────────────────────────────────────────

export class FaceDetectionService {
  private detectSession: ort.InferenceSession | null = null;
  private arcSession: ort.InferenceSession | null = null;
  private gaSession: ort.InferenceSession | null = null;
  private anchors: [number, number, number, number][] | null = null;

  // Detection thresholds matching retinaface-eval.html defaults
  private readonly CONF_THRESH = 0.4;
  private readonly NMS_THRESH = 0.4;
  private readonly VIS_THRESH = 0.5;
  private readonly SIM_THRESH = 0.40;
  private readonly MIN_SHARPNESS = 30;

  get isDetectionReady(): boolean { return this.detectSession !== null; }
  get isRecognitionReady(): boolean { return this.arcSession !== null; }
  get isGenderAgeReady(): boolean { return this.gaSession !== null; }

  async loadDetectionModel(
    url = RETINA_MODEL_URL,
    onStatus?: (msg: string) => void,
  ): Promise<void> {
    onStatus?.('Fetching RetinaFace model…');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching RetinaFace`);
    const buf = await resp.arrayBuffer();
    onStatus?.(`Compiling RetinaFace (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)…`);
    this.detectSession = await ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    this.anchors = generateAnchors();
    onStatus?.('RetinaFace ready');
  }

  async loadRecognitionModel(
    url = ARCFACE_MODEL_URL,
    onStatus?: (msg: string) => void,
  ): Promise<void> {
    onStatus?.('Fetching ArcFace model…');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ArcFace`);
    const buf = await resp.arrayBuffer();
    onStatus?.(`Compiling ArcFace (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)…`);
    this.arcSession = await ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    onStatus?.('ArcFace ready');
  }

  async loadGenderAgeModel(
    url = GENDERAGE_MODEL_URL,
    onStatus?: (msg: string) => void,
  ): Promise<void> {
    onStatus?.('Fetching GenderAge model…');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching GenderAge`);
    const buf = await resp.arrayBuffer();
    onStatus?.(`Compiling GenderAge (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)…`);
    this.gaSession = await ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    onStatus?.('GenderAge ready');
  }

  private async runDetection(img: HTMLImageElement): Promise<Detection[]> {
    if (!this.detectSession || !this.anchors) throw new Error('Model not loaded');

    const { tensor, scale } = preprocessDetect(img);
    const out = await this.detectSession.run({ [this.detectSession.inputNames[0]]: tensor });

    const N = this.anchors.length;
    const arrays = this.detectSession.outputNames.map((n) => out[n].data as Float32Array);
    const loc   = arrays.find((a) => a.length === N * 4)!;
    const conf  = arrays.find((a) => a.length === N * 2)!;
    const landm = arrays.find((a) => a.length === N * 10) ?? null;

    if (!loc || !conf) throw new Error('Unexpected model output shapes');

    const boxes     = decodeBoxes(loc, this.anchors);
    const landmarks = landm ? decodeLandmarks(landm, this.anchors) : null;

    const keptScores: number[] = [];
    const keptBoxes:  [number, number, number, number][] = [];
    const keptLandm:  [number, number][][] = [];

    for (let i = 0; i < N; i++) {
      const s = conf[i * 2 + 1]; // face class probability
      if (s > this.CONF_THRESH) {
        keptScores.push(s);
        keptBoxes.push(boxes[i]);
        if (landmarks) keptLandm.push(landmarks[i]);
      }
    }

    const finalIdx = nms(keptBoxes, keptScores, this.NMS_THRESH);
    const sx = INPUT_W / scale, sy = INPUT_H / scale;

    return finalIdx
      .filter((i) => keptScores[i] >= this.VIS_THRESH)
      .map((i) => ({
        x1: Math.max(0, keptBoxes[i][0] * sx),
        y1: Math.max(0, keptBoxes[i][1] * sy),
        x2: Math.min(img.naturalWidth,  keptBoxes[i][2] * sx),
        y2: Math.min(img.naturalHeight, keptBoxes[i][3] * sy),
        score: keptScores[i],
        landmarks: keptLandm[i]
          ? keptLandm[i].map(([lx, ly]): [number, number] => [lx * sx, ly * sy])
          : null,
      }));
  }

  private async runFaceAnalysis(
    img: HTMLImageElement,
    det: Detection,
    landmarks: [number, number][],
  ): Promise<{ embedding: Float32Array | null; gender?: 'Female' | 'Male'; age?: number }> {
    const aligned = alignFace(img, landmarks);
    if (computeSharpness(aligned) < this.MIN_SHARPNESS) return { embedding: null };

    let embedding: Float32Array | null = null;
    if (this.arcSession) {
      const tensor = preprocessArcFace(aligned);
      const out = await this.arcSession.run({ [this.arcSession.inputNames[0]]: tensor });
      embedding = l2normalize(out[this.arcSession.outputNames[0]].data as Float32Array);
    }

    let gender: 'Female' | 'Male' | undefined;
    let age: number | undefined;
    if (this.gaSession) {
      const tensor = preprocessGenderAge(img, det);
      const out = await this.gaSession.run({ [this.gaSession.inputNames[0]]: tensor });
      const pred = out[this.gaSession.outputNames[0]].data as Float32Array;
      // pred = [female_score, male_score, age_scaled] — see InsightFace genderage
      gender = pred[1] > pred[0] ? 'Male' : 'Female';
      age = Math.round(pred[2] * 100);
    }

    return { embedding, gender, age };
  }

  async processImages(
    imageSrcs: string[],
    onStatus?: (msg: string, idx: number, total: number) => void,
  ): Promise<FaceCluster[]> {
    const faces: FaceRecord[] = [];

    for (let idx = 0; idx < imageSrcs.length; idx++) {
      onStatus?.(`[${idx + 1}/${imageSrcs.length}] Detecting faces…`, idx, imageSrcs.length);
      try {
        const img  = await this.loadImg(imageSrcs[idx]);
        const dets = await this.runDetection(img);

        for (const det of dets) {
          let embedding: Float32Array | null = null;
          let gender: 'Female' | 'Male' | undefined;
          let age: number | undefined;
          if (det.landmarks) {
            try {
              const analysis = await this.runFaceAnalysis(img, det, det.landmarks);
              embedding = analysis.embedding;
              gender = analysis.gender;
              age = analysis.age;
            } catch (e) { console.warn('face analysis failed:', e); }
          }
          faces.push({ imageIndex: idx, detection: det, cropDataUrl: cropFace(img, det), embedding, gender, age });
        }
      } catch (e) {
        console.error(`Failed on image ${idx}:`, e);
      }
      // Yield to the event loop after each image so the UI stays responsive
      await new Promise((r) => setTimeout(r, 0));
    }

    // Without ArcFace: each face is its own cluster
    if (!this.arcSession) {
      return faces.map((f, id) => ({
        id,
        keyFaceDataUrl: f.cropDataUrl,
        photoCount: 1,
        appearances: [{ imageIndex: f.imageIndex, score: f.detection.score }],
        gender: f.gender,
        age: f.age,
        category: getSubjectCategory(f.gender, f.age),
      }));
    }

    const rawClusters = clusterFaces(faces, this.SIM_THRESH);
    return rawClusters.map((cl, id) => {
      const members = cl.members.map((mi) => faces[mi]);
      // Key face = the detection with the highest RetinaFace confidence score
      const keyFace = members.reduce((best, f) =>
        f.detection.score > best.detection.score ? f : best,
      );
      const imageSet = new Set(members.map((f) => f.imageIndex));
      const { gender, age, category } = aggregateGenderAge(members);
      return {
        id,
        keyFaceDataUrl: keyFace.cropDataUrl,
        photoCount: imageSet.size,
        appearances: members.map((f) => ({ imageIndex: f.imageIndex, score: f.detection.score })),
        gender,
        age,
        category,
      };
    });
  }

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  dispose(): void {
    this.detectSession?.release();
    this.arcSession?.release();
    this.gaSession?.release();
    this.detectSession = null;
    this.arcSession = null;
    this.gaSession = null;
  }
}
