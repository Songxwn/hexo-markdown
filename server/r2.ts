import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { extname } from "node:path";
import { nanoid } from "nanoid";
import { emitLog } from "./activity-log";
import type { AppConfig } from "./types";

function createClient(cfg: AppConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${cfg.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.r2AccessKeyId,
      secretAccessKey: cfg.r2SecretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

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

function safeBaseName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "image";
  const cleaned = base.replace(/[^\w.\u4e00-\u9fff-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "image";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export async function uploadToR2(
  cfg: AppConfig,
  file: { buffer: Buffer; originalname: string; mimetype: string },
): Promise<{ url: string; key: string }> {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ext = MIME_EXT[file.mimetype] || extname(file.originalname) || ".png";
  const base = safeBaseName(file.originalname).replace(/\.[^.]+$/, "") || "image";
  const prefix = (cfg.r2KeyPrefix || "hexo").replace(/^\/+|\/+$/g, "");
  const key = `${prefix}/${y}/${m}/${d}/${nanoid(10)}-${base}${ext}`;
  const size = formatBytes(file.buffer.length);

  emitLog("sys", `[R2] 上传 ${file.originalname || "image"}（${size}）`);
  emitLog("sys", `[R2] ${cfg.r2Bucket}/${key}`);

  try {
    const client = createClient(cfg);
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.r2Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitLog("err", `[R2] 失败 ${message}`);
    throw error;
  }

  const url = `${cfg.r2PublicUrl}/${key}`;
  emitLog("sys", `[R2] 完成 ${url}`);
  return { url, key };
}
