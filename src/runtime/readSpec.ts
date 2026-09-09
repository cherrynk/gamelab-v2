import type Phaser from "phaser";
import { learnedCapabilities } from "@/core/learnedCapabilities";
import type { PaddleEffectId } from "@/core/capabilityTypes";
import {
  defaultCombat,
  normalizeSpec,
  resolveChassis,
  type CombatSpec,
  type GameSpec,
  type ShooterChassis,
  type WeaponSpec,
} from "@/core/spec";

export function readSpec(scene: Phaser.Scene): GameSpec {
  return normalizeSpec(scene.registry.get("spec") as GameSpec);
}

export function speedMul(scene: Phaser.Scene) {
  return readSpec(scene).rules.enemySpeedMul || 1;
}

export function readCombat(scene: Phaser.Scene): CombatSpec {
  const spec = readSpec(scene);
  return spec.combat ?? defaultCombat(spec.gameType);
}

export function readChassis(spec: GameSpec): ShooterChassis {
  return resolveChassis(spec.combat?.chassis ?? String(spec.extras?.chassis ?? spec.extras?.shooterMode ?? "plane"));
}

function asChance(value: unknown) {
  if (typeof value === "boolean") return value ? 0.35 : 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? Math.min(1, n / 100) : Math.min(1, n);
}

export function extraChance(spec: GameSpec, keys: string[]) {
  const extras = spec.extras ?? {};
  for (const key of keys) {
    if (extras[key] !== undefined) return asChance(extras[key]);
  }
  for (const [key, value] of Object.entries(extras)) {
    if (keys.some((item) => key.toLowerCase().includes(item.toLowerCase()))) {
      return asChance(value);
    }
  }
  return 0;
}

export function extraCount(spec: GameSpec, keys: string[], fallback: number) {
  const extras = spec.extras ?? {};
  for (const key of keys) {
    const n = Number(extras[key]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return fallback;
}

export function multiballChance(spec: GameSpec) {
  return extraChance(spec, [
    "multiballChance",
    "extraBallChance",
    "splitBallChance",
    "brickBallChance",
    "multiball",
    "extraBall",
  ]);
}

export function maxBalls(spec: GameSpec) {
  return extraCount(spec, ["maxBalls", "ballLimit", "maxExtraBalls"], 6);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function flagIn(bags: Record<string, unknown>[], keys: string[]) {
  for (const bag of bags) {
    for (const key of keys) {
      if (bag[key] !== undefined) return asChance(bag[key]) > 0 || bag[key] === true;
    }
  }
  return null;
}

function numIn(bags: Record<string, unknown>[], keys: string[]) {
  for (const bag of bags) {
    for (const key of keys) {
      const n = Number(bag[key]);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return null;
}

export function paddlePowerups(spec: GameSpec) {
  const extras = spec.extras ?? {};
  const listed = Array.isArray(extras.brickDrops) ? extras.brickDrops : [];
  const chanceFor = (kinds: string[], keys: string[]) => {
    const fromKeys = extraChance(spec, keys);
    if (fromKeys > 0) return fromKeys;
    for (const item of listed) {
      const row = asRecord(item);
      if (!row) continue;
      const kind = String(row.kind ?? row.id ?? row.name ?? "").toLowerCase();
      if (kinds.some((name) => kind.includes(name))) {
        const n = Number(row.chance);
        return Number.isFinite(n) && n > 0 ? (n > 1 ? Math.min(1, n / 100) : n) : 0.2;
      }
    }
    return 0;
  };
  return {
    wideChance: chanceFor(["wide", "paddle", "long", "长"], ["widePaddleDrop", "longPaddleDrop", "paddleWide", "widePaddle"]),
    slowChance: chanceFor(["slow", "speed", "慢"], ["slowBallDrop", "ballSlowDrop", "slowBall"]),
    clearChance: chanceFor(["clear", "bomb", "laser", "wipe", "清"], ["clearBricksDrop", "clearAllDrop", "bombDrop", "wipeDrop"]),
    dualChance: chanceFor(["dual", "double", "twin", "双"], ["dualPaddleDrop", "doublePaddleDrop", "twinPaddle"]),
    pierceChance: chanceFor(["pierce", "drill", "steel", "破钢"], ["steelBreakDrop", "pierceDrop", "breakSteelDrop"]),
    duration: extraCount(spec, ["powerupDuration", "dropDuration", "buffDuration"], 8000),
  };
}

export type PaddleDrop = {
  effect: PaddleEffectId;
  chance: number;
  label: string;
  color: number;
  toast: string;
};

const EFFECT_META: Record<PaddleEffectId, { label: string; color: number; toast: string }> = {
  wide: { label: "长", color: 0x7c5cff, toast: "挡板变长了！" },
  slow: { label: "慢", color: 0x3ee0c5, toast: "球变慢了！" },
  clear: { label: "清", color: 0xff6b9d, toast: "砖块全没了！" },
  multiball: { label: "多", color: 0xffd166, toast: "多了一个球！" },
  narrow: { label: "短", color: 0x8b95a8, toast: "挡板变短了！" },
  score: { label: "分", color: 0xff8a5b, toast: "额外得分！" },
  haste: { label: "快", color: 0x6be0ff, toast: "球变快了！" },
  dual: { label: "双", color: 0xc9a0ff, toast: "第二块挡板来了！" },
  pierce: { label: "钢", color: 0xe8edf7, toast: "现在能打碎钢板了！" },
};

export function paddleDropTable(spec: GameSpec): PaddleDrop[] {
  const power = paddlePowerups(spec);
  const builtIn: PaddleDrop[] = [
    { effect: "wide", chance: power.wideChance, ...EFFECT_META.wide },
    { effect: "slow", chance: power.slowChance, ...EFFECT_META.slow },
    { effect: "clear", chance: power.clearChance, ...EFFECT_META.clear },
    { effect: "dual", chance: power.dualChance, ...EFFECT_META.dual },
    { effect: "pierce", chance: power.pierceChance, ...EFFECT_META.pierce },
  ];
  const learned = learnedCapabilities
    .filter((item) => item.gameType === spec.gameType && item.kind === "drop")
    .map((item) => ({
      effect: item.effect,
      chance: extraChance(spec, [item.extrasKey]) || item.chance,
      label: item.giftLabel || EFFECT_META[item.effect].label,
      color: item.color || EFFECT_META[item.effect].color,
      toast: item.toast || EFFECT_META[item.effect].toast,
    }));
  return [...builtIn, ...learned].filter((item) => item.chance > 0);
}

export function paddleBrickRules(spec: GameSpec, levelIndex: number) {
  const extras = spec.extras ?? {};
  const bags = [
    extras,
    asRecord(extras.paddle),
    asRecord(extras.paddleBricks),
    asRecord(extras.bricks),
    asRecord(extras.brick),
    asRecord(spec.levels[levelIndex]),
  ].filter((item): item is Record<string, unknown> => Boolean(item));

  const fromLevel = Math.max(1, Math.round(numIn(bags, ["fancyBricksFromLevel", "brickFromLevel", "fromLevel"]) ?? 2));
  const fancy = levelIndex + 1 >= fromLevel;
  const colored = flagIn(bags, ["coloredBricks", "colorBricks", "multiColorBricks", "brickColors"]) ?? fancy;
  const multiHit = flagIn(bags, ["multiHitBricks", "brickHp", "brickHits", "brickMaxHp"]) ?? fancy;
  const randomLayout = flagIn(bags, ["randomBrickLayout", "randomLayout", "randomBricks"]) ?? fancy;
  const unbreakable = flagIn(bags, ["unbreakableBricks", "steelBricks", "indestructibleBricks"]) ?? fancy;
  const maxHp = Math.round(numIn(bags, ["brickMaxHp", "brickHp", "maxBrickHp"]) ?? (levelIndex >= 2 ? 3 : fancy ? 2 : 1));
  const unbreakableChance =
    numIn(bags, ["unbreakableChance", "steelChance", "indestructibleChance"]) ??
    (unbreakable ? (levelIndex >= 2 ? 0.16 : fancy ? 0.1 : 0) : 0);

  return {
    colored,
    multiHit,
    randomLayout,
    unbreakable,
    maxHp: Math.max(1, Math.min(4, maxHp)),
    unbreakableChance: unbreakable ? Math.min(0.28, unbreakableChance > 1 ? unbreakableChance / 100 : unbreakableChance) : 0,
    fromLevel,
  };
}

export function bulletColor(bullet: WeaponSpec["bullet"]) {
  const colors: Record<WeaponSpec["bullet"], number> = {
    single: 0xffd166,
    triple: 0xff6b9d,
    spread: 0x7cff6b,
    laser: 0x6be0ff,
    homing: 0xc9a0ff,
    burst: 0xffaa44,
  };
  return colors[bullet] ?? 0xffd166;
}
