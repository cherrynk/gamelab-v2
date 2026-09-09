"use client";

import Link from "next/link";
import { currentSpec } from "@/core/spec";
import { useProject } from "@/core/useProjects";
import GameCanvas from "@/runtime/GameCanvas";

export default function PlayView({ id }: { id: string }) {
  const project = useProject(id);

  if (!project) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted">
        这局游戏还没有发布到这台浏览器。
        <Link href="/" className="ml-2 text-accent-2">
          去创建
        </Link>
      </main>
    );
  }

  const spec = currentSpec(project);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-accent-2">Published</p>
          <h1 className="text-3xl font-semibold">{spec.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/studio/${project.id}`} className="rounded-full border border-line px-4 py-2 text-sm">
            回到工作室
          </Link>
          <Link href="/" className="rounded-full bg-accent px-4 py-2 text-sm text-white">
            Remix
          </Link>
        </div>
      </div>
      <GameCanvas spec={spec} />
    </main>
  );
}
