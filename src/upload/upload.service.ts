import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Env } from "../shared/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

function isPlaceholderS3Value(value: string | undefined): boolean {
  if (!value || !String(value).trim()) return true;
  const v = String(value).toLowerCase();
  return (
    v.includes("your-bucket") ||
    v.includes("your-region") ||
    v.includes("your-hetzner") ||
    v.includes("changeme") ||
    v === "undefined"
  );
}

function isS3Configured(): boolean {
  return (
    !isPlaceholderS3Value(Env.HETZNER_S3_BUCKET_NAME) &&
    !isPlaceholderS3Value(Env.HETZNER_S3_ACCESS_KEY) &&
    !isPlaceholderS3Value(Env.HETZNER_S3_SECRET_KEY) &&
    !isPlaceholderS3Value(Env.HETZNER_S3_ENDPOINT)
  );
}

@Injectable()
export class UploadService {
  private s3: S3Client | null = null;
  private bucket = "";
  private readonly useLocalStorage: boolean;
  private readonly localUploadDir: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.useLocalStorage = !isS3Configured();
    this.localUploadDir = path.join(process.cwd(), "public", "uploads");
    const port = Env.PORT || "4000";
    this.publicBaseUrl = (
      process.env.BACKEND_PUBLIC_URL ||
      process.env.API_PUBLIC_URL ||
      `http://localhost:${port}`
    ).replace(/\/$/, "");

    if (this.useLocalStorage) {
      if (!fs.existsSync(this.localUploadDir)) {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      }
      console.warn(
        "[UploadService] Hetzner S3 is not configured (placeholder or missing env). " +
          "Using local storage at public/uploads/. Set HETZNER_S3_* in .env for production uploads."
      );
      return;
    }

    const endpoint = Env.HETZNER_S3_ENDPOINT;
    const region = Env.HETZNER_S3_REGION;
    const accessKeyId = Env.HETZNER_S3_ACCESS_KEY;
    const secretAccessKey = Env.HETZNER_S3_SECRET_KEY;
    this.bucket = Env.HETZNER_S3_BUCKET_NAME || "";

    this.s3 = new S3Client({
      region: region || "us-east-1",
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
      forcePathStyle: true,
    } as any);
  }

  async uploadBuffer(filename: string, buffer: Buffer, contentType?: string) {
    if (this.useLocalStorage) {
      return this.uploadBufferLocal(filename, buffer);
    }

    try {
      const key = `${Date.now()}-${uuidv4()}-${filename}`;

      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read" as const,
        ...(Buffer.isBuffer(buffer) ? { ContentLength: buffer.length } : {}),
      };

      const cmd = new PutObjectCommand(params);
      await this.s3!.send(cmd);

      const rawEndpoint = (Env.HETZNER_S3_ENDPOINT || "").replace(/\/$/, "");
      let url = "";

      if (!rawEndpoint) {
        url = `https://${this.bucket}.s3.${Env.HETZNER_S3_REGION || "us-east-1"}.amazonaws.com/${encodeURIComponent(key)}`;
      } else if (/^https?:\/\//i.test(rawEndpoint)) {
        url = `${rawEndpoint}/${this.bucket}/${encodeURIComponent(key)}`;
      } else {
        url = `https://${this.bucket}.${rawEndpoint}/${encodeURIComponent(key)}`;
      }

      return url;
    } catch (e) {
      console.error("UploadService.uploadBuffer error:", {
        name: e?.name,
        message: e?.message,
        code: e?.code || e?.Code,
        metadata: e?.$metadata,
      });

      const msg = e?.message || String(e);
      throw new InternalServerErrorException(
        `Upload failed: ${e?.name || "Error"}: ${msg}`
      );
    }
  }

  private async uploadBufferLocal(filename: string, buffer: Buffer) {
    try {
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${Date.now()}-${uuidv4()}-${safeName || "file"}`;
      const filePath = path.join(this.localUploadDir, key);
      await fs.promises.writeFile(filePath, buffer);
      return `${this.publicBaseUrl}/uploads/${encodeURIComponent(key)}`;
    } catch (e) {
      console.error("UploadService.uploadBufferLocal error:", e);
      throw new InternalServerErrorException(
        `Local upload failed: ${e?.message || String(e)}`
      );
    }
  }

  async deleteFile(fileUrl: string) {
    if (this.useLocalStorage) {
      return this.deleteFileLocal(fileUrl);
    }

    try {
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        throw new Error("Invalid file URL: unable to extract key");
      }

      const cmd = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3!.send(cmd);

      return { success: true, message: "File deleted successfully" };
    } catch (e) {
      console.error("UploadService.deleteFile error:", {
        name: e?.name,
        message: e?.message,
        code: e?.code || e?.Code,
        metadata: e?.$metadata,
      });

      const msg = e?.message || String(e);
      throw new InternalServerErrorException(
        `Delete failed: ${e?.name || "Error"}: ${msg}`
      );
    }
  }

  private async deleteFileLocal(fileUrl: string) {
    try {
      const key = this.extractLocalKey(fileUrl);
      if (!key) {
        throw new Error("Invalid local file URL");
      }
      const filePath = path.join(this.localUploadDir, key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return { success: true, message: "File deleted successfully" };
    } catch (e) {
      throw new InternalServerErrorException(
        `Local delete failed: ${e?.message || String(e)}`
      );
    }
  }

  private extractLocalKey(fileUrl: string): string | null {
    try {
      const parsed = new URL(fileUrl);
      const prefix = "/uploads/";
      if (!parsed.pathname.startsWith(prefix)) return null;
      return decodeURIComponent(parsed.pathname.slice(prefix.length));
    } catch {
      const marker = "/uploads/";
      const idx = fileUrl.indexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(fileUrl.slice(idx + marker.length));
    }
  }

  private extractKeyFromUrl(fileUrl: string): string | null {
    const localKey = this.extractLocalKey(fileUrl);
    if (localKey) return localKey;

    try {
      const rawEndpoint = (Env.HETZNER_S3_ENDPOINT || "").replace(/\/$/, "");

      if (!rawEndpoint) {
        const match = fileUrl.match(
          /https:\/\/[^.]+\.s3\.[^.]+\.amazonaws\.com\/(.+)/
        );
        return match ? decodeURIComponent(match[1]) : null;
      }

      let baseUrl = "";
      if (/^https?:\/\//i.test(rawEndpoint)) {
        baseUrl = `${rawEndpoint}/${this.bucket}/`;
      } else {
        baseUrl = `https://${this.bucket}.${rawEndpoint}/`;
      }

      if (fileUrl.startsWith(baseUrl)) {
        return decodeURIComponent(fileUrl.substring(baseUrl.length));
      }

      return null;
    } catch (error) {
      console.error("Error extracting key from URL:", error);
      return null;
    }
  }
}
