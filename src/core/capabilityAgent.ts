import { applyStructuredPatches } from "./applyPatch";
import { catalogFor, capabilitySummary, isAllowedTarget, unsupportedReply } from "./capabilities";
import { recordPlayRequest, updateCapabilityJob } from "./capabilityJobs";
import { runCodeAgent } from "./codeAgent";
import { PADDLE_EFFECTS, type LearnedCapability, type PaddleEffectId } from "./capabilityTypes";
import { persistLearned } from "./learnStore";
import { llmConfig, parseModelJson } from "./llm";
import type { ChatResult } from "./patcher";
import { scopePatches } from "./patcher";
import type { GamePatch, GameSpec } from "./spec";
import { getTemplate } from "./templates";
import { uid } from "./ids";

export function looksLikePlayChange(text: string) {
  if (/怎么玩|如何玩|能改什么|可以改什么|有哪些玩法|叫什么|几关|多少关|什么风格/.test(text)) return false;
  return /加|增|改|换|要|做成|变成|去掉|不要|再来|掉落|奖励|玩法|技能|道具/.test(text);
}

type AgentPlan = {
  mode?: "patch" | "learn" | "blocked";
  reply?: string;
  patches?: GamePatch[];
  capability?: Partial<LearnedCapability>;
};

function extrasKeyOk(key: string) {
  return /^[A-Za-z][A-Za-z0-9]{2,40}$/.test(key);
}

export async function implementCapability(spec: GameSpec, message: string, fallback: ChatResult): Promise<ChatResult> {
  const template = getTemplate(spec.gameType);
  const llm = llmConfig();
  if (!llm || spec.gameType !== "paddle_ball") {
    await recordPlayRequest(spec.gameType, spec.id, message, "blocked", "当前模板还不能自动学新玩法");
    return { ...fallback, reply: unsupportedReply(spec.gameType, template.title) };
  }

  const catalog = catalogFor(spec.gameType);
  const prompt = `你是 Game Lab 的能力 Agent。用户在改「${template.title}」。
目录里没有的玩法，不要编场景不认识的字段。只能做三件事之一：
- patch：其实是现有能力，写 patches
- learn：新的打砖掉落，但效果必须是已有原语之一
- blocked：需要全新运行时（双挡板、爆炸连锁、重力、联机、真3D、射击武器、追踪砖等）

现有能力：${catalog.capabilities.map((item) => `${item.label}(${item.targets.join(",")})`).join("；")}
可用原语：wide挡板变长、slow球变慢、clear全消、multiball多一个球、narrow挡板变短、score加分、haste球变快、dual双挡板、pierce打碎钢板

只输出 JSON：
{"mode":"learn","reply":"中文","patches":[],"capability":{"label":"挡板变短","say":"掉落让挡板变短","extrasKey":"narrowPaddleDrop","effect":"narrow","giftLabel":"短","chance":0.16,"nlu":["变短","缩短"],"toast":"挡板变短了！","color":9145768}}

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
        temperature: 0.2,
        messages: [
          { role: "system", content: "只输出合法 JSON，不要 markdown。" },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      await recordPlayRequest(spec.gameType, spec.id, message, "failed", "模型没接上");
      return { ...fallback, reply: unsupportedReply(spec.gameType, template.title) };
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty");
    const plan = parseModelJson<AgentPlan>(content);
    return applyPlan(spec, message, fallback, plan);
  } catch {
    await recordPlayRequest(spec.gameType, spec.id, message, "failed", "解析失败");
    return { ...fallback, reply: unsupportedReply(spec.gameType, template.title) };
  }
}

async function applyPlan(spec: GameSpec, message: string, fallback: ChatResult, plan: AgentPlan): Promise<ChatResult> {
  const mode = plan.mode ?? "blocked";

  if (mode === "patch") {
    const scoped = scopePatches(spec, Array.isArray(plan.patches) ? plan.patches : []).filter((item) =>
      isAllowedTarget(spec.gameType, item.target),
    );
    if (!scoped.length) {
      return shipByCodeAgent(spec, message, fallback, plan.reply || "对不上现有能力，改代码 Agent 开工");
    }
    return {
      spec: applyStructuredPatches(spec, scoped),
      patches: scoped,
      reply: plan.reply?.trim() || "预览已按现有能力改了。",
      handled: true,
    };
  }

  if (mode === "learn") {
    const effect = String(plan.capability?.effect ?? "") as PaddleEffectId;
    const extrasKey = String(plan.capability?.extrasKey ?? "");
    if (!PADDLE_EFFECTS.includes(effect) || !extrasKeyOk(extrasKey)) {
      return shipByCodeAgent(spec, message, fallback, "效果不在原语里，改代码 Agent 开工");
    }
    const learned: LearnedCapability = {
      id: uid("learn"),
      gameType: spec.gameType,
      label: String(plan.capability?.label || "新掉落").slice(0, 16),
      say: String(plan.capability?.say || message).slice(0, 32),
      extrasKey,
      kind: "drop",
      effect,
      giftLabel: String(plan.capability?.giftLabel || "奖").slice(0, 2),
      chance: Math.min(0.4, Math.max(0.08, Number(plan.capability?.chance) || 0.16)),
      nlu: (plan.capability?.nlu ?? []).map((item) => String(item).slice(0, 12)).filter(Boolean).slice(0, 8),
      toast: String(plan.capability?.toast || "接到奖励了！").slice(0, 20),
      color: Number(plan.capability?.color) || 0xff8a5b,
      createdAt: Date.now(),
      sourceMessage: message,
    };
    await persistLearned(learned);
    const patches: GamePatch[] = [
      { operation: "update", target: `extras.${extrasKey}`, value: learned.chance, note: `新玩法：${learned.label}` },
    ];
    await recordPlayRequest(spec.gameType, spec.id, message, "learned", learned.label, learned.id);
    return {
      spec: applyStructuredPatches(spec, patches),
      patches,
      reply:
        plan.reply?.trim() ||
        `目录里没有这个，我已经加上了：打碎砖块会掉「${learned.giftLabel}」，接到后${learned.label}。`,
      handled: true,
    };
  }

  return shipByCodeAgent(spec, message, fallback, plan.reply || "需要新运行时，改代码 Agent 开工");
}

async function shipByCodeAgent(spec: GameSpec, message: string, fallback: ChatResult, note: string): Promise<ChatResult> {
  const template = getTemplate(spec.gameType);
  const job = await recordPlayRequest(spec.gameType, spec.id, message, "implementing", note);
  const coded = await runCodeAgent(spec, message);
  if (coded.ok && coded.patches?.length) {
    const patches = coded.patches.map((item) => ({
      operation: item.operation ?? "update",
      target: item.target,
      value: item.value,
      note: item.note ?? coded.label ?? "新玩法",
    })) as GamePatch[];
    await updateCapabilityJob(job.id, {
      status: "shipped",
      note: coded.label || "已自动改代码",
      result: { reply: coded.reply || "", extrasKey: coded.extrasKey, patches },
    });
    return {
      spec: applyStructuredPatches(spec, patches),
      patches,
      reply: coded.reply?.trim() || `已经自动加上「${coded.label || "新玩法"}」，预览会重开。`,
      handled: true,
      jobId: job.id,
    };
  }
  await updateCapabilityJob(job.id, { status: "failed", note: coded.error || "自动改代码没做成" });
  return {
    ...fallback,
    jobId: job.id,
    reply: `自动改代码这次没做成：${coded.error || "未知原因"}。「${template.title}」能改的是：${capabilitySummary(spec.gameType)}。`,
  };
}
