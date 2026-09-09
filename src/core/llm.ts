export function llmConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const deepseek = Boolean(process.env.DEEPSEEK_API_KEY) || /deepseek/i.test(process.env.OPENAI_BASE_URL || "");
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL || (deepseek ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1")).replace(
      /\/$/,
      "",
    ),
    model: process.env.LLM_MODEL || (deepseek ? "deepseek-v4-flash" : "gpt-4o-mini"),
  };
}

export function parseModelJson<T = { reply?: string; patches?: unknown[] }>(text: string): T {
  const raw = text.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    return JSON.parse(match[0]) as T;
  }
}
