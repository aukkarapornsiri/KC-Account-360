import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { getUserAccess, hasPermission } from "@/app/api/access";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const access = await getUserAccess(user.email);
  if (!hasPermission(access, "read")) return new Response("Forbidden", { status: 403 });
  const { id } = await context.params;
  const db = getDb();
  const [document] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!document) return new Response("Not found", { status: 404 });
  const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!bucket) return new Response("Storage unavailable", { status: 503 });
  const object = await bucket.get(document.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const safeName = document.name.replaceAll('"', "");
  return new Response(object.body, { headers: { "content-type": document.contentType, "content-length": String(document.size), "content-disposition": `attachment; filename="${safeName}"`, "cache-control": "private, no-store" } });
}
