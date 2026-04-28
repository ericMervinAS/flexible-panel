const MODEL_URLS: Record<string, string | undefined> = {
  retinaface: process.env.MODEL_URL_RETINAFACE,
  arcface:    process.env.MODEL_URL_ARCFACE,
  genderage:  process.env.MODEL_URL_GENDERAGE,
};

export default async function handler(req: any, res: any) {
  const name = (req.query.name as string) ?? "";
  const url = MODEL_URLS[name];

  if (!url) { res.status(404).end(); return; }

  let upstream: Response;
  try {
    upstream = await fetch(url);
  } catch {
    res.status(502).end();
    return;
  }

  if (!upstream.ok) { res.status(502).end(); return; }

  const buf = await upstream.arrayBuffer();
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.end(Buffer.from(buf));
}
