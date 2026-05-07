import { Injectable } from "@nestjs/common";

export type ObjectStoragePutInput = {
  key: string;
  buffer: Buffer;
  contentType: string;
};

@Injectable()
export abstract class ObjectStorage {
  abstract putObject(input: ObjectStoragePutInput): Promise<void>;
}
