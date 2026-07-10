const MODEL_URLS: Record<string, string | undefined> = {
  retinaface:  process.env.MODEL_URL_RETINAFACE,
  arcface:     process.env.MODEL_URL_ARCFACE,
  genderage:   process.env.MODEL_URL_GENDERAGE,
  distraction: process.env.MODEL_URL_DISTRACTION,
  inpaint:     process.env.MODEL_URL_INPAINT,
};

// Redirect rather than proxy — model files (esp. ArcFace at ~13MB) exceed
// Vercel's serverless response body limit (4.5MB Hobby / 50MB Pro) and
// would also waste function memory and execution time. HuggingFace serves
// these public models with permissive CORS, so the browser can fetch directly.
export default function handler(req: any, res: any) {
  const name = (req.query.name as string) ?? "";
  const url = MODEL_URLS[name];

  if (!url || !/^https?:\/\//.test(url)) { res.status(404).end(); return; }

  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.redirect(307, url);
}
