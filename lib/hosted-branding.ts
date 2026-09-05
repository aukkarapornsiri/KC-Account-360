import "server-only";

const LOGO_SETTING = "brand_logo_key";

type HostedEnv = {
  DB: {
    prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> } };
    batch(statements: unknown[]): Promise<unknown>;
  };
  BUCKET: {
    get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
    put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
};

export function usesHostedPreviewStorage() {
  return process.env.KC_PREVIEW_MODE === "true";
}

async function hostedEnv() {
  const runtime = await import("cloudflare:workers");
  return runtime.env as unknown as HostedEnv;
}

export async function getHostedLogoKey() {
  const env = await hostedEnv();
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(LOGO_SETTING).first<{ value: string }>();
  return row?.value || "";
}

export async function getHostedLogo(key: string) {
  return (await hostedEnv()).BUCKET.get(key);
}

export async function saveHostedLogo(file: File, objectKey: string, actorEmail: string) {
  const env = await hostedEnv();
  const previousKey = await getHostedLogoKey();
  await env.BUCKET.put(objectKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(LOGO_SETTING, objectKey, actorEmail, now),
      env.DB.prepare("INSERT INTO audit_logs (record_id, action, actor_email, details, created_at) VALUES (?, ?, ?, ?, ?)").bind(null, "UPDATE_BRAND_LOGO", actorEmail, `Uploaded ${file.name}`, now),
    ]);
  } catch (error) {
    await env.BUCKET.delete(objectKey);
    throw error;
  }
  if (previousKey && previousKey !== objectKey) await env.BUCKET.delete(previousKey);
}

export async function resetHostedLogo(actorEmail: string) {
  const env = await hostedEnv();
  const previousKey = await getHostedLogoKey();
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(LOGO_SETTING, "", actorEmail, now),
    env.DB.prepare("INSERT INTO audit_logs (record_id, action, actor_email, details, created_at) VALUES (?, ?, ?, ?, ?)").bind(null, "RESET_BRAND_LOGO", actorEmail, "Restored the standard Account 360 logo", now),
  ]);
  if (previousKey) await env.BUCKET.delete(previousKey);
}
