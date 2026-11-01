import "server-only";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500; style: "normal" };

const memo = new Map<string, Promise<ArrayBuffer>>();

/** A TTF from Google Fonts (a non-browser user agent gets TrueType, which OG rendering needs). */
function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const id = `${family}:${weight}`;
  const cached = memo.get(id);
  if (cached) return cached;
  const task = (async (): Promise<ArrayBuffer> => {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReverieOG/1.0)" },
    }).then((r) => r.text());
    const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url) throw new Error(`No TrueType source for ${family}`);
    return fetch(url).then((r) => r.arrayBuffer());
  })();
  memo.set(id, task);
  task.catch(() => memo.delete(id));
  return task;
}

export async function ogFonts(): Promise<Font[]> {
  const [serif, sans, sansMedium] = await Promise.all([
    googleFont("Instrument Serif", 400),
    googleFont("Instrument Sans", 400),
    googleFont("Instrument Sans", 500),
  ]);
  return [
    { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
    { name: "Instrument Sans", data: sans, weight: 400, style: "normal" },
    { name: "Instrument Sans", data: sansMedium, weight: 500, style: "normal" },
  ];
}
