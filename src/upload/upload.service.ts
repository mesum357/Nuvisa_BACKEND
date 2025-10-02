import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Env } from "../shared/config";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class UploadService {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = Env.HETZNER_S3_ENDPOINT;
    const region = Env.HETZNER_S3_REGION;
    const accessKeyId = Env.HETZNER_S3_ACCESS_KEY;
    const secretAccessKey = Env.HETZNER_S3_SECRET_KEY;
    this.bucket = Env.HETZNER_S3_BUCKET_NAME;

    if (!this.bucket) {
      throw new Error("HETZNER_S3_BUCKET_NAME is not configured in environment");
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("HETZNER_S3_ACCESS_KEY or HETZNER_S3_SECRET_KEY is not configured in environment");
    }

    this.s3 = new S3Client({
      region: region || "us-east-1",
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      forcePathStyle: true,
    } as any);
  }

  async uploadBuffer(filename: string, buffer: Buffer, contentType?: string) {
    try {
      const key = `${Date.now()}-${uuidv4()}-${filename}`;

      const params: any = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      };

      // include ContentLength when available (helps some S3-compatible providers)
      if (Buffer.isBuffer(buffer)) {
        params.ContentLength = buffer.length;
      }

      const cmd = new PutObjectCommand(params);

      await this.s3.send(cmd);

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
      throw new InternalServerErrorException(`Upload failed: ${e?.name || "Error"}: ${msg}`);
    }
  }

  async deleteFile(fileUrl: string) {
    try {
      // Extract the key from the URL
      const key = this.extractKeyFromUrl(fileUrl);
      if (!key) {
        throw new Error("Invalid file URL: unable to extract key");
      }

      const params = {
        Bucket: this.bucket,
        Key: key,
      };

      const cmd = new DeleteObjectCommand(params);
      await this.s3.send(cmd);

      return { success: true, message: "File deleted successfully" };
    } catch (e) {
      console.error("UploadService.deleteFile error:", {
        name: e?.name,
        message: e?.message,
        code: e?.code || e?.Code,
        metadata: e?.$metadata,
      });

      const msg = e?.message || String(e);
      throw new InternalServerErrorException(`Delete failed: ${e?.name || "Error"}: ${msg}`);
    }
  }

  private extractKeyFromUrl(fileUrl: string): string | null {
    try {
      // Handle different URL formats
      const rawEndpoint = (Env.HETZNER_S3_ENDPOINT || "").replace(/\/$/, "");
      
      if (!rawEndpoint) {
        // AWS S3 URL format: https://bucket.s3.region.amazonaws.com/key
        const match = fileUrl.match(/https:\/\/[^.]+\.s3\.[^.]+\.amazonaws\.com\/(.+)/);
        return match ? decodeURIComponent(match[1]) : null;
      } else {
        // Custom endpoint URL formats
        let baseUrl = "";
        if (/^https?:\/\//i.test(rawEndpoint)) {
          baseUrl = `${rawEndpoint}/${this.bucket}/`;
        } else {
          baseUrl = `https://${this.bucket}.${rawEndpoint}/`;
        }
        
        if (fileUrl.startsWith(baseUrl)) {
          return decodeURIComponent(fileUrl.substring(baseUrl.length));
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting key from URL:", error);
      return null;
    }
  }
}
