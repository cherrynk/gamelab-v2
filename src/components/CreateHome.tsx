"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { firstReply, planGame } from "@/core/planner";
import type { Difficulty, GameType, StyleId } from "@/core/spec";
import { createProject } from "@/core/store";
import { useProjects } from "@/core/useProjects";
import { getStyleMeta, styleCatalog } from "@/core/styles";
import { gameTemplates } from "@/core/templates";

const difficulties: Array<{ id: Difficulty; title: string }> = [
  { id: "easy", title: "简单" },
  { id: "medium", title: "中等" },
  { id: "hard", title: "困难" },
];

export default function CreateHome() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(gameTemplates[0].samplePrompt);
  const [gameType, setGameType] = useState<GameType>("shooter");
  const [styleId, setStyleId] = useState<StyleId>(gameTemplates[0].styleHint ?? "pixel_art");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const recent = useProjects();

  const steps = ["规划玩法…", "创建世界…", "创建角色…", "创建规则…", "构建游戏…"];

  const pickTemplate = (id: GameType) => {
    const item = gameTemplates.find((template) => template.id === id);
    if (!item) return;
    setGameType(item.id);
    setPrompt(item.samplePrompt);
    if (item.styleHint) setStyleId(item.styleHint);
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setStep(0);
    const spec = planGame({ prompt, gameType, styleId, difficulty });
    for (let i = 0; i < steps.length; i += 1) {
      setStep(i);
      await new Promise((resolve) => setTimeout(resolve, 280));
    }
    createProject(spec, firstReply(spec));
    router.push(`/studio/${spec.id}`);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-16">
      <p className="mb-3 text-center text-sm font-medium tracking-[0.2em] text-accent-2">GAMELAB V2</p>
      <h1 className="mb-3 text-center text-5xl font-semibold tracking-tight">GameAI</h1>
      <p className="mb-10 text-center text-lg text-muted">Describe a game. Play it in minutes.</p>

      <label className="mb-3 block text-sm text-muted">描述你想制作什么游戏</label>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={5}
        className="mb-6 w-full rounded-3xl border border-line bg-card px-5 py-4 text-base leading-7 outline-none focus:border-accent"
        placeholder="制作一个像素风 RPG…"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Field label="游戏类型">
          {gameTemplates.map((item) => (
            <Chip key={item.id} active={gameType === item.id} onClick={() => pickTemplate(item.id)}>
              {item.emoji} {item.title}
            </Chip>
          ))}
        </Field>
        <Field label="视觉风格">
          {styleCatalog.map((item) => (
            <Chip key={item.id} active={styleId === item.id} onClick={() => setStyleId(item.id)}>
              {item.emoji} {item.title}
            </Chip>
          ))}
        </Field>
        <Field label="更多设置">
          {difficulties.map((item) => (
            <Chip key={item.id} active={difficulty === item.id} onClick={() => setDifficulty(item.id)}>
              {item.title}
            </Chip>
          ))}
        </Field>
      </div>

      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || prompt.trim().length < 2}
        className="mx-auto mb-14 inline-flex rounded-full bg-accent px-8 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        ✨ 创建游戏
      </button>

      {busy ? (
        <ol className="mb-14 space-y-2 rounded-3xl border border-line bg-card p-5 text-sm">
          {steps.map((label, index) => (
            <li key={label} className={index <= step ? "text-accent-2" : "text-muted"}>
              {label} {index <= step ? "✓" : ""}
            </li>
          ))}
        </ol>
      ) : null}

      <section>
        <h2 className="mb-4 text-sm font-medium tracking-wide text-muted">Templates</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gameTemplates.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pickTemplate(item.id)}
              className={`rounded-2xl border p-4 text-left hover:border-accent ${
                gameType === item.id ? "border-accent bg-accent/10" : "border-line bg-card"
              }`}
            >
              <p className="mb-1 text-lg">
                {item.emoji} {item.title}
              </p>
              <p className="text-sm leading-6 text-muted">{item.blurb}</p>
            </button>
          ))}
        </div>
      </section>

      {recent.length ? (
        <section className="mt-12">
          <h2 className="mb-4 text-sm font-medium tracking-wide text-muted">最近的游戏</h2>
          <div className="space-y-2">
            {recent.slice(0, 5).map((project) => {
              const spec = project.versions.find((item) => item.id === project.currentVersionId)?.spec;
              const style = spec ? getStyleMeta(spec.style.id) : null;
              return (
                <Link
                  key={project.id}
                  href={`/studio/${project.id}`}
                  className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 hover:border-accent"
                >
                  <span>{spec?.title ?? "未命名游戏"}</span>
                  <span className="text-sm text-muted">{style?.title}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-accent bg-accent/20 text-foreground" : "border-line text-muted hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}
