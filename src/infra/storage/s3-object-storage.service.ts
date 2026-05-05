import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

import {
  ObjectStorage,
  ObjectStoragePutInput,
} from "../../modules/application/repositories/object-storage";
import { EnvService } from "../env/env.service";

@Injectable()
export class S3ObjectStorageService extends ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly envService: EnvService) {
    super();
    const region = this.envService.get("AWS_REGION");
    const accessKeyId = this.envService.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.envService.get("AWS_SECRET_ACCESS_KEY");
    const endpoint = this.envService.get("AWS_S3_ENDPOINT");

    this.client = new S3Client({
      region,
      ...(endpoint !== undefined ? { endpoint, forcePathStyle: true } : {}),
      ...(accessKeyId !== undefined && secretAccessKey !== undefined
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : {}),
    });
  }

  async putObject(input: ObjectStoragePutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.envService.get("AWS_S3_BUCKET"),
        Key: input.key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );
  }
}
