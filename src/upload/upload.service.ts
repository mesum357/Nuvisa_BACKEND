import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Env } from "../shared/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

    this.s3 = new S3Client({
      region: region || "us-east-1",
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
      },
      forcePathStyle: true,
    } as any);
  }

  async uploadBuffer(filename: string, buffer: Buffer, contentType?: string) {
    try {
      const key = `${Date.now()}-${uuidv4()}-${filename}`;

      const cmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      });

      await this.s3.send(cmd);

      // Construct public URL — Hetzner S3 is compatible with S3 URL pattern
      const endpoint = Env.HETZNER_S3_ENDPOINT.replace(/\/$/, "");
      // If endpoint contains protocol and host, build URL appropriately
      let url = "";
      if (endpoint.startsWith("http")) {
        url = `${endpoint}/${this.bucket}/${encodeURIComponent(key)}`;
      } else {
        url = `https://${this.bucket}.${endpoint}/${encodeURIComponent(key)}`;
      }

      return url;
    } catch (e) {
      throw new InternalServerErrorException("Upload failed");
    }
  }
}
