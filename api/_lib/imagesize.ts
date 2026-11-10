// Reads an image's pixel dimensions from its header bytes (JPEG/PNG) to get the
// true media aspect ratio — Meta's preview iframe reports a fixed height that
// crops non-16:9 creatives, so we compute the real card height ourselves.

function parseJpeg(buf: Buffer): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF15 carry dimensions (skip DHT/DAC/DRI/RST/SOS markers).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function parseImage(buf: Buffer): { w: number; h: number } | null {
  if (buf.length >= 24 && buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) return parseJpeg(buf);
  return null;
}

/** Media aspect ratio (width / height), or null if it can't be determined. */
export async function fetchImageAspect(url: string | null | undefined): Promise<number | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const dims = parseImage(buf);
    if (!dims || dims.w <= 0 || dims.h <= 0) return null;
    return dims.w / dims.h;
  } catch {
    return null;
  }
}
