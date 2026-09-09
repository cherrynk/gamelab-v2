import Phaser from "phaser";
import type { GameSpec, PlayerKind } from "@/core/spec";

export type Body = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function overlaps(a: Body, b: Body) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

export function playerColor(spec: GameSpec) {
  const tint: Record<PlayerKind, number> = {
    knight: spec.style.colors.player,
    robot: spec.style.colors.accent,
    mage: 0xc77dff,
    archer: 0x7bb661,
    slime: spec.style.colors.enemy,
  };
  return tint[spec.player.kind];
}

export function playerSize(spec: GameSpec) {
  if (spec.player.kind === "slime") return { w: 28, h: 22 };
  if (spec.player.kind === "robot") return { w: 30, h: 40 };
  return { w: 28, h: 38 };
}

export function scaled(spec: GameSpec, base: number, kind: "speed" | "damage" | "health") {
  if (kind === "speed") return base * spec.rules.enemySpeedMul;
  if (kind === "damage") return base * spec.rules.enemyDamageMul;
  return base * spec.rules.playerHealthMul;
}

export function hudStyle(spec: GameSpec) {
  return {
    fontFamily: spec.style.pixelArt ? "monospace" : "sans-serif",
    color: spec.style.colors.ui,
  };
}

export function addActor(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  label?: string,
) {
  const body = scene.add.rectangle(x, y, w, h, color);
  if (specOutline(scene)) {
    body.setStrokeStyle(2, 0x0b0d18, 0.85);
  }
  if (label) {
    scene.add
      .text(x, y - h / 2 - 10, label, {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(20);
  }
  return body;
}

function specOutline(scene: Phaser.Scene) {
  const spec = scene.registry.get("spec") as GameSpec | undefined;
  return spec?.style.outline === "dark";
}

export function bindSpec(scene: Phaser.Scene, spec: GameSpec) {
  scene.registry.set("spec", spec);
}
