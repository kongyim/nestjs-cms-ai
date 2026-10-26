import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "./config";
export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
@Injectable()
export class LocalStorage implements FileStorage {
  private path(key: string) {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid storage key");
    return resolve(config.STORAGE_PATH, key);
  }
  async put(key: string, data: Buffer) {
    await mkdir(resolve(config.STORAGE_PATH), { recursive: true });
    await writeFile(this.path(key), data, { flag: "wx", mode: 0o600 });
  }
  get(key: string) {
    return readFile(this.path(key));
  }
  async remove(key: string) {
    try {
      await unlink(this.path(key));
    } catch (e) {
      if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
    }
  }
}
