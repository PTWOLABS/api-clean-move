import { Module } from "@nestjs/common";

import { ObjectStorage } from "../../modules/application/repositories/object-storage";
import { EnvModule } from "../env/env.module";
import { S3ObjectStorageService } from "./s3-object-storage.service";

@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: ObjectStorage,
      useClass: S3ObjectStorageService,
    },
  ],
  exports: [ObjectStorage],
})
export class StorageModule {}
