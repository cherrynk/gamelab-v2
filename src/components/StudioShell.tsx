"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatResult } from "@/core/patcher";
import { summarizeSpec } from "@/core/planner";
import { cloneSpec, currentSpec, type BrickStamp } from "@/core/spec";
import BrickEditor from "@/components/BrickEditor";
import { uid } from "@/core/ids";
import { useProject } from "@/core/useProjects";
import {
  appendMessages,
  publishProject,
  pushVersion,
  restoreVersion,
  saveProject,
} from "@/core/store";
import { capabilitySummary } from "@/core/capabilities";
import type { CapabilityJob } from "@/core/capabilityTypes";
import { getTemplate } from "@/core/templates";
import GameCanvas from "@/runtime/GameCanvas";

export default function StudioShell({ id }: { id: string }) {
  const router = useRouter();
  const project = useProject(id);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draftBricks, setDraftBricks] = useState<BrickStamp[] | null>(null);
  const [jobs, setJobs] = useState<CapabilityJob[]>([]);
  const sending = useRef(false);

  const refreshJobs = () => {
    void fetch("/api/capabilities")
      .then((response) => response.json())
      .then((data: { jobs?: CapabilityJob[] }) => setJobs(data.jobs ?? []))
      .catch(() => undefined);
  };

  useEffect(() => {
    refreshJobs();
  }, []);

  const spec = useMemo(() => (project ? currentSpec(project) : null), [project]);

  if (!project || !spec) {
    return (
      <main className="flex min-h-full items-center justify-center text-muted">
        找不到这局游戏。
        <Link href="/" className="ml-2 text-accent-2">
          回首页
        </Link>
      </main>
    );
  }

  const template = getTemplate(spec.gameType);

  const send = () => {
    const text = draft.trim();
    if (!text || sending.current) return;
    sending.current = true;
    setBusy(true);
    void (async () => {
      let result: ChatResult;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 180000);
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spec, message: text }),
          signal: controller.signal,
        });
        result = (await response.json()) as ChatResult;
        if (!result?.reply) throw new Error("empty");
      } catch (error) {
        const timeout = error instanceof DOMException && error.name === "AbortError";
        result = {
          spec,
          patches: [],
          reply: timeout
            ? "这次等太久了，改代码还没跑完。再说一次，或看左侧「新玩法」是不是还在改代码中。"
            : "这次没改成功。再说一次你想改的玩法，武器和掉落也可以直接说。",
        };
      } finally {
        window.clearTimeout(timer);
      }
      try {
        const next = appendMessages(project, [
          { id: uid("msg"), role: "user", text, at: Date.now() },
          { id: uid("msg"), role: "assistant", text: result.reply, at: Date.now() },
        ]);
        if (result.patches?.length) {
          pushVersion(next, result.spec, result.patches[0]?.note ?? "对话修改");
        }
        setDraft("");
        setRunning(!result.spec.extras?.editingBricks);
        refreshJobs();
      } finally {
        sending.current = false;
        setBusy(false);
      }
    })();
  };

  return (
    <div className="relative flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            GameAI
          </Link>
          <span className="text-sm text-muted">/</span>
          <h1 className="text-sm font-medium">{spec.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((value) => !value)}
            className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent"
          >
            版本
          </button>
          <button
            type="button"
            onClick={() => saveProject(project)}
            className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => {
              const next = publishProject(project);
              router.push(`/play/${next.id}`);
            }}
            className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent"
          >
            发布
          </button>
          <button
            type="button"
            onClick={() => setRunning((value) => !value)}
            className="rounded-full bg-accent px-3 py-1.5 text-sm text-white"
          >
            {running ? "暂停" : "▶ Run"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="hidden overflow-auto border-r border-line p-4 lg:block">
          <p className="mb-3 text-xs tracking-wide text-muted">GAME</p>
          <Tree label="🎮 Template" detail={`${template.emoji} ${template.title}`} />
          <Tree label="✅ 能改" detail={capabilitySummary(spec.gameType)} />
          {jobs.length ? (
            <Tree
              label="🤖 新玩法"
              detail={jobs
                .slice(0, 3)
                .map((job) => {
                  const label =
                    job.status === "learned" || job.status === "shipped"
                      ? "已加上"
                      : job.status === "implementing"
                        ? "改代码中"
                        : job.status === "blocked"
                          ? "记下"
                          : "失败";
                  return `${label}：${job.message.slice(0, 18)}`;
                })
                .join(" · ")}
            />
          ) : null}
          <Tree
            label="🧍 Player"
            detail={spec.systems.health ? `${spec.player.name} · HP ${spec.player.health}` : spec.player.name}
          />
          {template.objects.some((item) => ["Enemy", "Hazard", "Brick"].includes(item)) ? (
            <Tree
              label="👾 Enemy"
              detail={spec.enemies.map((item) => item.name).join(" / ") || "障碍"}
            />
          ) : null}
          {spec.levels.length > 1 ? (
            <Tree
              label="🗺 Levels"
              detail={`${spec.levels.length} 关${spec.levels.some((level) => level.custom) ? " · 含自定义" : ""}`}
            />
          ) : null}
          {spec.gameType === "paddle_ball" && spec.levels.length > 1 ? (
            <Tree label="🧱 Bricks" detail="后关多彩 / 多血 / 钢板" />
          ) : null}
          {spec.gameType === "paddle_ball" &&
          (spec.extras?.widePaddleDrop || spec.extras?.slowBallDrop || spec.extras?.clearBricksDrop || spec.extras?.brickDrops) ? (
            <Tree
              label="🎁 Drops"
              detail={
                spec.extras?.dualPaddleDrop
                  ? "挡板变长 / 球速变慢 / 全消 / 双挡板"
                  : spec.extras?.clearBricksDrop
                    ? "挡板变长 / 球速变慢 / 全消"
                    : "挡板变长 / 球速变慢"
              }
            />
          ) : null}
          {spec.systems.coins ? <Tree label="🪙 Items" detail="可收集" /> : null}
          {spec.gameType === "shooter" && spec.combat?.chassis ? (
            <Tree
              label="🚗 Chassis"
              detail={spec.combat.chassis === "tank" ? "坦克" : spec.combat.chassis === "soldier" ? "特种兵" : "飞机"}
            />
          ) : null}
          {spec.gameType === "shooter" && spec.combat?.weapon ? (
            <Tree label="🔫 Weapon" detail={spec.combat.weapon.name} />
          ) : null}
          {spec.gameType === "shooter" && spec.combat?.drops?.length ? (
            <Tree label="🎁 Drops" detail={spec.combat.drops.map((item) => item.name).join(" / ")} />
          ) : null}
          {spec.boss ? <Tree label="⚔ Boss" detail={`${spec.boss.name} · HP ${spec.boss.health}`} /> : null}
          <Tree label="🏪 Systems" detail={template.objects.join(" · ")} />
          {spec.systems.shop ? <Tree label="🛒 Shop" detail="过关回血" /> : null}
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden p-4">
          {spec.gameType === "paddle_ball" && spec.extras?.editingBricks ? (
            <BrickEditor
              title={spec.levels.findLast((level) => level.custom)?.name ?? "自定义关卡"}
              bricks={draftBricks ?? spec.levels.findLast((level) => level.custom)?.bricks ?? []}
              onChange={setDraftBricks}
              onDone={() => {
                const next = cloneSpec(spec);
                const index = next.levels.findLastIndex((level) => Boolean(level.custom));
                if (index >= 0) {
                  next.levels[index] = {
                    ...next.levels[index],
                    custom: true,
                    bricks: draftBricks ?? next.levels[index].bricks ?? [],
                  };
                }
                next.extras = { ...next.extras, editingBricks: false, previewLevel: index + 1 };
                pushVersion(project, next, "完成砖块编辑");
                setDraftBricks(null);
                setRunning(true);
              }}
            />
          ) : (
            <>
              <GameCanvas spec={spec} running={running} />
              {spec.gameType === "paddle_ball" && spec.levels.some((level) => level.custom) ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = cloneSpec(spec);
                    next.extras = { ...next.extras, editingBricks: true };
                    pushVersion(project, next, "打开砖块编辑");
                    setRunning(false);
                  }}
                  className="mt-3 self-start rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent"
                >
                  编辑自定义关卡砖块
                </button>
              ) : null}
            </>
          )}
          <p className="mt-3 text-sm text-muted">{template.howTo}</p>
        </section>

        <aside className="relative z-20 flex min-h-0 flex-col border-l border-line bg-background">
          <div className="border-b border-line px-4 py-3 text-sm font-medium">AI Chat</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
            {project.messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "text-foreground" : "text-muted"}>
                <p className="mb-1 text-xs tracking-wide text-accent-2">
                  {message.role === "user" ? "You" : "AI"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
              </div>
            ))}
          </div>
          <div className="relative z-20 border-t border-line bg-background p-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={3}
              placeholder={`改这局「${template.title}」，比如${template.chatHints}`}
              className="mb-2 w-full rounded-2xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || busy}
              className="w-full rounded-full bg-accent py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "正在实现，请稍等…" : "应用修改"}
            </button>
          </div>
        </aside>
      </div>

      {historyOpen ? (
        <div className="absolute inset-x-0 top-14 z-10 mx-auto max-w-lg rounded-3xl border border-line bg-card p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Version History</p>
            <button type="button" onClick={() => setHistoryOpen(false)} className="text-sm text-muted">
              关闭
            </button>
          </div>
          <ul className="space-y-2">
            {project.versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between text-sm">
                <span className={version.id === project.currentVersionId ? "text-accent-2" : ""}>
                  {version.label}
                </span>
                {version.id === project.currentVersionId ? (
                  <span className="text-muted">当前</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => restoreVersion(project, version.id)}
                    className="text-accent-2"
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">
            当前版本要点：{summarizeSpec(spec).join(" · ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Tree({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="mb-4">
      <p className="text-sm">{label}</p>
      <p className="text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}
