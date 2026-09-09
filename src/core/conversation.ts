import { applyStructuredPatches } from "./applyPatch";
import { implementCapability, looksLikePlayChange } from "./capabilityAgent";
import { unsupportedReply } from "./capabilities";
import { llmConfig, parseModelJson } from "./llm";
import { applyChat, scopePatches, type ChatResult } from "./patcher";
import { getTemplate, llmPlaybook } from "./templates";
import type { GamePatch, GameSpec } from "./spec";

export async function converse(spec: GameSpec, message: string): Promise<ChatResult> {
  const local = applyChat(spec, message);
  // 本地已经改到运行时，或已经回答了问题。空补丁才让模型按能力目录试一次。
  if (local.handled || local.patches.length) return local;
  if (looksLikePlayChange(message)) {
    return implementCapability(spec, message, local);
  }
  const llm = llmConfig();
  if (!llm) return local;

  const template = getTemplate(spec.gameType);
  const compact = {
    title: spec.title,
    gameType: spec.gameType,
    template: template.title,
    difficulty: spec.difficulty,
    style: spec.style.id,
    player: spec.player,
    levels: spec.levels,
    enemies: spec.enemies,
    boss: spec.boss,
    systems: spec.systems,
    rules: spec.rules,
    world: spec.world,
    combat: spec.combat,
    extras: spec.extras,
  };

  const prompt = `你是 Game Lab 的 Conversation Agent。用户在改一局已经生成的游戏。
补丁不是备忘录：预览会按新 spec 立刻重开，运行时会读这些字段并改玩法。
只做增量补丁，不要重写整局，不要写代码。只写当前模板会读的路径。

${llmPlaybook(spec.gameType)}

只写当前模板能力目录里的 target。目录没有的玩法不要编字段，patches 为空并说明做不到。
不要问「是否要我执行这些改动」。提问则 patches 为空。只有联机、真 3D、生成音频文件做不到。
只输出 JSON：{"reply":"中文回复","patches":[{"operation":"update","target":"title","value":"新名字","note":"改标题"}]}

当前游戏：${JSON.stringify(compact)}
用户说：${message}`;

  try {
    const response = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: "只输出合法 JSON，不要 markdown。" },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      return {
        ...local,
        reply: unsupportedReply(spec.gameType, template.title),
      };
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ...local, reply: unsupportedReply(spec.gameType, template.title) };
    const parsed = parseModelJson<{ reply?: string; patches?: GamePatch[] }>(content);
    const patches = Array.isArray(parsed.patches) ? parsed.patches : [];
    const scoped = scopePatches(spec, patches);
    if (!scoped.length) {
      return {
        ...local,
        reply: parsed.reply?.trim() || unsupportedReply(spec.gameType, template.title),
      };
    }
    const next = applyStructuredPatches(spec, scoped);
    return {
      spec: next,
      patches: scoped,
      reply: parsed.reply?.trim() || local.reply,
    };
  } catch {
    return local;
  }
}
