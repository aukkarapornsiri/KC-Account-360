import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { getUserAccess, hasPermission } from "@/app/api/access";
import { getObject } from "@/lib/local-storage";

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
  const object = await getObject(document.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const safeName = document.name.replaceAll('"', "");
  return new Response(object, { headers: { "content-type": document.contentType, "content-length": String(object.byteLength), "content-disposition": `attachment; filename="${safeName}"`, "cache-control": "private, no-store" } });
}
