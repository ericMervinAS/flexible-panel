// Auto-discovers reference before/after pairs for the sample gallery, used to
// test patch-compositing (real "after" pixels + detections.csv ground truth)
// as a drop-in replacement for the live detection model + MI-GAN.
//
// To add a new test image: drop `<name>.<ext>` into src/assets/samples/, the
// matching `<name>.<any-ext>` into src/assets/samples/after/, and make sure
// detections.csv has a row whose `image` column's filename stem (extension
// ignored) matches `<name>`. No code changes needed — this file picks it up
// automatically, and re-encoding a sample to a different format (e.g. .jpg →
// .webp) doesn't break the match.
//
// Toggle this off to fall back to the normal flow (live detection model +
// MI-GAN) for these same sample images, instead of the CSV/after-image path.
export const USE_REFERENCE_SAMPLES = true;

import { DISTRACTION_CLASSES } from "@/lib/distractionDetection";
import type { DistractionDetection } from "@/lib/distractionDetection";
import detectionsCsvRaw from "@/assets/detections.csv?raw";

const beforeModules = import.meta.glob(
  "../assets/samples/*.{webp,jpg,jpeg}",
  { eager: true },
) as Record<string, { default: string }>;

const afterModules = import.meta.glob(
  "../assets/samples/after/*.{webp,jpg,jpeg}",
  { eager: true },
) as Record<string, { default: string }>;

const basename = (path: string) => path.split("/").pop() ?? path;
// Match before/after/CSV by filename stem, ignoring extension — a sample may
// get re-encoded to a different format (e.g. .jpg → .webp for file size)
// without needing to touch the CSV or the other side of the pair.
const stem = (name: string) => name.replace(/\.[^.]+$/, "");

const afterSrcByFilename = new Map<string, string>();
for (const [path, mod] of Object.entries(afterModules)) {
  afterSrcByFilename.set(stem(basename(path)), mod.default);
}

// detections.csv header: image,class_id,class_name,confidence,x1,y1,x2,y2
// The CSV's class_id ordering does NOT match DISTRACTION_CLASSES' index order
// (e.g. csv id 3 is "thermostat", but DISTRACTION_CLASSES[3] is "Electrical
// Outlet") — so map by class_name instead of trusting the numeric id.
const CSV_CLASS_NAME_TO_LABEL: Record<string, (typeof DISTRACTION_CLASSES)[number]> = {
  exit_sign: "Exit Sign",
  extinguisher: "Fire Extinguisher",
  fire_alarm: "Smoke Detector",
  thermostat: "Thermostat",
  electrical_outlet: "Electrical Outlet",
  trash_can: "Trash Can",
};

function parseDetectionsCsv(raw: string): Map<string, DistractionDetection[]> {
  const byFilename = new Map<string, DistractionDetection[]>();
  const lines = raw.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 8) continue;
    const [image, , className, confidenceStr, x1, y1, x2, y2] = cols;
    const label = CSV_CLASS_NAME_TO_LABEL[className];
    if (!label) continue;
    const det: DistractionDetection = {
      x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2),
      score: Number(confidenceStr),
      classId: DISTRACTION_CLASSES.indexOf(label),
      label,
    };
    const key = stem(image);
    const list = byFilename.get(key) ?? [];
    list.push(det);
    byFilename.set(key, list);
  }
  return byFilename;
}

const detectionsByFilename = parseDetectionsCsv(detectionsCsvRaw);

// before image src → after image src, for every before/after pair found.
export const REFERENCE_AFTER: Record<string, string> = {};
// before image src → ground-truth detections from detections.csv (may be
// absent even when an after image exists, if the CSV has no row for it yet).
export const REFERENCE_DETECTIONS: Record<string, DistractionDetection[]> = {};

for (const [path, mod] of Object.entries(beforeModules)) {
  const key = stem(basename(path));
  const afterSrc = afterSrcByFilename.get(key);
  if (!afterSrc) continue; // no matching after/ image dropped in yet
  REFERENCE_AFTER[mod.default] = afterSrc;
  const dets = detectionsByFilename.get(key);
  if (dets) REFERENCE_DETECTIONS[mod.default] = dets;
}
