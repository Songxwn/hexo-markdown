export type ImageKind = { mime: string; ext: string };

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/avif": ".avif",
};

const EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
};

function ascii(buf: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...buf.subarray(start, start + length));
}

export function sniffImageType(buffer: Uint8Array): ImageKind | null {
  if (buffer.length >= 6 && ascii(buffer, 0, 3) === "GIF" && buffer[3] === 0x38) {
    return { mime: "image/gif", ext: ".gif" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mime: "image/png", ext: ".png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  if (buffer.length >= 12 && ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 4) === "WEBP") {
    return { mime: "image/webp", ext: ".webp" };
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { mime: "image/bmp", ext: ".bmp" };
  }
  if (buffer.length >= 12 && ascii(buffer, 4, 4) === "ftyp") {
    const brand = ascii(buffer, 8, 4);
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: ".avif" };
  }
  return null;
}

function extFromName(name?: string): string {
  const base = (name || "").replace(/\\/g, "/").split("/").pop() || "";
  const match = base.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function replaceExt(name: string, ext: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "image";
  const stem = base.replace(/\.[^.]+$/, "") || "image";
  return `${stem}${ext}`;
}

export function resolveImageType(
  buffer: Uint8Array,
  mimetype?: string,
  filename?: string,
): ImageKind {
  const sniffed = sniffImageType(buffer);
  if (sniffed) return sniffed;
  const fromName = extFromName(filename);
  if (fromName && EXT_MIME[fromName]) {
    return { mime: EXT_MIME[fromName], ext: fromName === ".jpeg" ? ".jpg" : fromName };
  }
  const mime = (mimetype || "").toLowerCase();
  if (MIME_EXT[mime]) {
    return { mime: mime === "image/jpg" ? "image/jpeg" : mime, ext: MIME_EXT[mime] };
  }
  return { mime: "image/png", ext: ".png" };
}

export function applyImageType<T extends { buffer: Uint8Array; originalname: string; mimetype: string }>(
  file: T,
): T {
  const kind = resolveImageType(file.buffer, file.mimetype, file.originalname);
  return {
    ...file,
    mimetype: kind.mime,
    originalname: replaceExt(file.originalname || "image", kind.ext),
  };
}
