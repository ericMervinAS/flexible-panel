import * as ort from 'onnxruntime-web';

// ── MI-GAN inpainting (pipeline v2) ──────────────────────────────────────────
// Picsart-AI-Research MI-GAN, ICCV 2023. The "pipeline" export handles
// resize/pad/blend internally, so it accepts a full-resolution image + mask and
// returns a full-resolution composited result.
//
//   image  : uint8 [1, 3, H, W]  RGB
//   mask   : uint8 [1, 1, H, W]  0 = region to inpaint (remove), 255 = keep
//   result : uint8 [1, 3, H, W]  RGB, inpainted region blended over the original
//
// Mask polarity (0 = remove) was verified empirically against the model.

export const INPAINT_MODEL_URL = '/api/models/inpaint';

// Cap the longest side fed to the model. The GAN runs at 512 internally; a
// larger canvas only improves the untouched surround while costing memory.
const MAX_SIDE = 2048;

type ImageInput = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

function srcDims(src: ImageInput): { w: number; h: number } {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

export class InpaintingService {
  private session: ort.InferenceSession | null = null;

  get isReady(): boolean { return this.session !== null; }

  async loadModel(
    url = INPAINT_MODEL_URL,
    onStatus?: (msg: string) => void,
  ): Promise<void> {
    if (this.session) return;
    onStatus?.('Fetching inpainting model…');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching inpainting model`);
    const buf = await resp.arrayBuffer();
    onStatus?.(`Compiling inpainting model (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB)…`);
    this.session = await ort.InferenceSession.create(buf, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    onStatus?.('Inpainting model ready');
  }

  /**
   * Remove the masked region from `image` and return the inpainted result.
   *
   * @param image      Source photo.
   * @param maskCanvas Overlay canvas whose *painted* (non-transparent) pixels
   *                   mark the object to remove. Any size — it is scaled to the
   *                   working resolution.
   * @returns A canvas holding the inpainted image at the working resolution.
   */
  async inpaint(image: ImageInput, maskCanvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    if (!this.session) throw new Error('Inpainting model not loaded');

    const { w: srcW, h: srcH } = srcDims(image);
    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
    const W = Math.max(1, Math.round(srcW * scale));
    const H = Math.max(1, Math.round(srcH * scale));

    // ── image → uint8 CHW RGB ──
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = W; imgCanvas.height = H;
    const ictx = imgCanvas.getContext('2d', { willReadFrequently: true })!;
    ictx.drawImage(image, 0, 0, W, H);
    const rgba = ictx.getImageData(0, 0, W, H).data;

    const n = W * H;
    const imgData = new Uint8Array(3 * n);
    for (let i = 0; i < n; i++) {
      imgData[0 * n + i] = rgba[i * 4];     // R
      imgData[1 * n + i] = rgba[i * 4 + 1]; // G
      imgData[2 * n + i] = rgba[i * 4 + 2]; // B
    }

    // ── mask → uint8 [1,1,H,W]: painted (alpha>0) → 0 (remove), else 255 (keep) ──
    const mCanvas = document.createElement('canvas');
    mCanvas.width = W; mCanvas.height = H;
    const mctx = mCanvas.getContext('2d', { willReadFrequently: true })!;
    mctx.drawImage(maskCanvas, 0, 0, W, H);
    const mAlpha = mctx.getImageData(0, 0, W, H).data;
    const maskData = new Uint8Array(n);
    for (let i = 0; i < n; i++) maskData[i] = mAlpha[i * 4 + 3] > 0 ? 0 : 255;

    // ── run ──
    const imageTensor = new ort.Tensor('uint8', imgData, [1, 3, H, W]);
    const maskTensor = new ort.Tensor('uint8', maskData, [1, 1, H, W]);
    const out = await this.session.run({ image: imageTensor, mask: maskTensor });
    const result = out[this.session.outputNames[0]];
    const [, , outH, outW] = result.dims as number[];
    const rout = result.data as Uint8Array;

    // ── uint8 CHW RGB → canvas ──
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW; outCanvas.height = outH;
    const octx = outCanvas.getContext('2d')!;
    const outImg = octx.createImageData(outW, outH);
    const m = outW * outH;
    for (let i = 0; i < m; i++) {
      outImg.data[i * 4]     = rout[0 * m + i];
      outImg.data[i * 4 + 1] = rout[1 * m + i];
      outImg.data[i * 4 + 2] = rout[2 * m + i];
      outImg.data[i * 4 + 3] = 255;
    }
    octx.putImageData(outImg, 0, 0);
    return outCanvas;
  }
}

// Single shared instance so the ~27MB MI-GAN model compiles once and is reused
// by both the loupe editor and the grid-level batch action.
export const sharedInpainter = new InpaintingService();
