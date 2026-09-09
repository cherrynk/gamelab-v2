"use client";

import { useMemo, useState } from "react";
import {
  PADDLE_BRICK_H,
  PADDLE_BRICK_W,
  PADDLE_COLS,
  PADDLE_GAP_X,
  PADDLE_GAP_Y,
  PADDLE_GAME_H,
  PADDLE_GAME_W,
  PADDLE_ORIGIN_X,
  PADDLE_ORIGIN_Y,
  PADDLE_ROWS,
  stampKey,
} from "@/core/paddleGrid";
import type { BrickStamp } from "@/core/spec";

type Tool = "hp1" | "hp2" | "hp3" | "steel" | "erase";

const TOOLS: Array<{ id: Tool; label: string; color: string }> = [
  { id: "hp1", label: "1 下", color: "#3ee0c5" },
  { id: "hp2", label: "2 下", color: "#ffd166" },
  { id: "hp3", label: "3 下", color: "#ff6b9d" },
  { id: "steel", label: "钢板", color: "#8b95a8" },
  { id: "erase", label: "擦除", color: "#3a4060" },
];

function stampFromTool(col: number, row: number, tool: Tool): BrickStamp | null {
  if (tool === "erase") return null;
  if (tool === "steel") return { col, row, steel: true };
  return { col, row, hp: tool === "hp3" ? 3 : tool === "hp2" ? 2 : 1 };
}

function cellColor(stamp?: BrickStamp) {
  if (!stamp) return "transparent";
  if (stamp.steel) return "#8b95a8";
  if (stamp.hp === 3) return "#ff6b9d";
  if (stamp.hp === 2) return "#ffd166";
  return "#3ee0c5";
}

export default function BrickEditor({
  title,
  bricks,
  onChange,
  onDone,
}: {
  title: string;
  bricks: BrickStamp[];
  onChange: (next: BrickStamp[]) => void;
  onDone: () => void;
}) {
  const [tool, setTool] = useState<Tool>("hp1");
  const map = useMemo(() => {
    const next = new Map<string, BrickStamp>();
    bricks.forEach((item) => next.set(stampKey(item.col, item.row), item));
    return next;
  }, [bricks]);

  const paint = (col: number, row: number) => {
    const next = new Map(map);
    const made = stampFromTool(col, row, tool);
    if (made) next.set(stampKey(col, row), made);
    else next.delete(stampKey(col, row));
    onChange([...next.values()]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title} · 点格子摆砖</p>
        <button type="button" onClick={onDone} className="rounded-full bg-accent px-3 py-1.5 text-sm text-white">
          完成编辑
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTool(item.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              tool === item.id ? "border-accent text-foreground" : "border-line text-muted"
            }`}
            style={{ boxShadow: tool === item.id ? `inset 0 0 0 2px ${item.color}` : undefined }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black">
        {Array.from({ length: PADDLE_ROWS }, (_, row) =>
          Array.from({ length: PADDLE_COLS }, (_, col) => {
            const stamp = map.get(stampKey(col, row));
            const left = ((PADDLE_ORIGIN_X + col * PADDLE_GAP_X - PADDLE_BRICK_W / 2) / PADDLE_GAME_W) * 100;
            const top = ((PADDLE_ORIGIN_Y + row * PADDLE_GAP_Y - PADDLE_BRICK_H / 2) / PADDLE_GAME_H) * 100;
            const width = (PADDLE_BRICK_W / PADDLE_GAME_W) * 100;
            const height = (PADDLE_BRICK_H / PADDLE_GAME_H) * 100;
            return (
              <button
                key={stampKey(col, row)}
                type="button"
                onClick={() => paint(col, row)}
                className="absolute rounded-sm border border-white/15"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  background: cellColor(stamp),
                }}
              >
                {stamp?.steel ? "×" : stamp?.hp && stamp.hp > 1 ? stamp.hp : ""}
              </button>
            );
          }),
        )}
      </div>
      <p className="text-xs leading-5 text-muted">
        青色打 1 下，金色 2 下，粉色 3 下，灰色钢板打不碎。先摆出形状，再点完成编辑去玩。
      </p>
    </div>
  );
}
