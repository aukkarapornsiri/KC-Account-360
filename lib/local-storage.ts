import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

function storageRoot() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data");
}

function resolveKey(objectKey: string) {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(objectKey)) throw new Error("Invalid storage key");
  const root = storageRoot();
  const target = path.resolve(root, objectKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage key");
  return target;
}

export async function putObject(objectKey: string, value: File | Uint8Array) {
  const target = resolveKey(objectKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  const bytes = value instanceof File ? new Uint8Array(await value.arrayBuffer()) : value;
  await writeFile(target, bytes, { mode: 0o640 });
}

export async function getObject(objectKey: string) {
  try {
    return await readFile(resolveKey(objectKey));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteObject(objectKey: string) {
  await rm(resolveKey(objectKey), { force: true });
}
