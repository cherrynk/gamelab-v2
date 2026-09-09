import { readFile, writeFile } from "fs/promises";
import path from "path";
import { llmConfig, parseModelJson } from "./llm";
import type { GamePatch, GameSpec } from "./spec";
import { getTemplate } from "./templates";

const ALLOWED = new Set([
  "src/runtime/scenes/paddleBall.ts",
  "src/runtime/readSpec.ts",
  "src/core/capabilities.ts",
  "src/core/patcher.ts",
  "src/core/learnedCapabilities.ts",
  "src/core/capabilityTypes.ts",
]);

export type CodeAgentResult = {
  ok: boolean;
  label?: string;
  extrasKey?: string;
  reply?: string;
  patches?: GamePatch[];
  error?: string;
};

type EditPlan = {
  label?: string;
  extrasKey?: string;
  reply?: string;
  patches?: GamePatch[];
  edits?: Array<{ path?: string; old_string?: string; new_string?: string }>;
};

async function applyEdits(edits: NonNullable<EditPlan["edits"]>) {
  for (const edit of edits) {
    const rel = String(edit.path ?? "").replace(/^\.\//, "");
    if (!ALLOWED.has(rel) || !edit.old_string || !edit.new_string) {
      throw new Error(`不允许改 ${rel || "未知文件"}`);
    }
    const abs = path.join(process.cwd(), rel);
    const current = await readFile(abs, "utf8");
    if (!current.includes(edit.old_string)) {
      throw new Error(`找不到要替换的代码：${rel}`);
    }
    await writeFile(abs, current.replace(edit.old_string, edit.new_string), "utf8");
  }
}

async function runFallbackCoder(spec: GameSpec, message: string): Promise<CodeAgentResult> {
  const llm = llmConfig();
  if (!llm) return { ok: false, error: "没有可用的改代码模型" };
  const template = getTemplate(spec.gameType);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.15,
        messages: [
          { role: "system", content: "只输出合法 JSON，不要 markdown。" },
          {
            role: "user",
            content: `你是 Game Lab 的改代码 Agent。当前模板「${template.title}」。
用户说：${message}
只输出 JSON。用 search/replace 改文件，old_string 必须在原文件里唯一出现。
只能改：${[...ALLOWED].join(", ")}
JSON：{"label":"名称","extrasKey":"camelCase","reply":"中文","patches":[{"operation":"update","target":"extras.xxx","value":true,"note":"说明"}],"edits":[{"path":"src/core/patcher.ts","old_string":"...","new_string":"..."}]}
做不到就：{"label":"","extrasKey":"","reply":"","patches":[],"edits":[]}`,
          },
        ],
      }),
    });
    if (!response.ok) return { ok: false, error: "改代码模型没接上" };
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "改代码模型空回复" };
    const plan = parseModelJson<EditPlan>(content);
    await applyEdits(plan.edits ?? []);
    const patches = Array.isArray(plan.patches) ? plan.patches : [];
    if (!patches.length) return { ok: false, error: "改代码没有产出补丁" };
    return {
      ok: true,
      label: plan.label,
      extrasKey: plan.extrasKey,
      reply: plan.reply,
      patches,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "改代码超时" };
    }
    return { ok: false, error: error instanceof Error ? error.message : "改代码失败" };
  } finally {
    clearTimeout(timer);
  }
}

export async function runCodeAgent(spec: GameSpec, message: string): Promise<CodeAgentResult> {
  // 不在 Next 进程里 import @cursor/sdk：会把 Turbopack 卡死，聊天等到超时。
  return runFallbackCoder(spec, message);
}
