export type ImageKind = { mime: string; ext: string };

const TYPE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
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

function isGenericClipboardName(name: string): boolean {
  return !name || /^image\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

export function imageUploadName(file: File, mime = file.type): string {
  const ext = TYPE_EXT[mime] || (mime.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
  const raw = (file.name || "").replace(/\\/g, "/").split("/").pop() || "";
  if (!isGenericClipboardName(raw)) {
    return `${raw.replace(/\.[^.]+$/, "") || "image"}.${ext}`;
  }
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `paste-${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}.${ext}`;
}
