import { planGame, summarizeSpec, type CreateInput } from "@/core/planner";

export async function POST(request: Request) {
  const body = (await request.json()) as CreateInput;
  const spec = planGame(body);
  return Response.json({ spec, summary: summarizeSpec(spec) });
}
