import { converse } from "@/core/conversation";
import type { GameSpec } from "@/core/spec";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json()) as { spec: GameSpec; message: string };
  if (!body?.spec || !body.message) {
    return Response.json({ error: "缺少 spec 或 message" }, { status: 400 });
  }
  return Response.json(await converse(body.spec, body.message));
}
