import {
  ObjectStorage,
  ObjectStoragePutInput,
} from "../../src/modules/application/repositories/object-storage";

export class FakeObjectStorage extends ObjectStorage {
  public readonly puts: ObjectStoragePutInput[] = [];
  public readonly deletes: string[] = [];

  async putObject(input: ObjectStoragePutInput): Promise<void> {
    this.puts.push(input);
  }

  async deleteObject(key: string): Promise<void> {
    this.deletes.push(key);
  }
}
