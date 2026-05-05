import {
  ObjectStorage,
  ObjectStoragePutInput,
} from "../../src/modules/application/repositories/object-storage";

export class FakeObjectStorage extends ObjectStorage {
  public readonly puts: ObjectStoragePutInput[] = [];

  async putObject(input: ObjectStoragePutInput): Promise<void> {
    this.puts.push(input);
  }
}
