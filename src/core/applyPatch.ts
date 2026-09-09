import {
  DIFFICULTIES,
  PLAYER_KINDS,
  STYLE_IDS,
  WORLD_THEMES,
  cloneSpec,
  normalizeSpec,
  resolveChassis,
  type Difficulty,
  type GamePatch,
  type BrickStamp,
  type GameSpec,
  type PlayerKind,
  type ShooterChassis,
  type StyleId,
  type WorldTheme,
} from "./spec";
import { starterCustomBricks } from "./paddleGrid";
import { getStyle } from "./styles";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setPath(spec: GameSpec, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor: Record<string, unknown> = spec as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!isRecord(next) && !Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function applyStructuredPatches(spec: GameSpec, patches: GamePatch[]): GameSpec {
  const next = normalizeSpec(cloneSpec(spec));

  for (const patch of patches) {
    const target = patch.target;
    const value = patch.value;

    if (target === "style") {
      const id = String(value) as StyleId;
      if (STYLE_IDS.includes(id)) next.style = getStyle(id);
      continue;
    }

    if (target === "difficulty" && DIFFICULTIES.includes(String(value) as Difficulty)) {
      next.difficulty = String(value) as Difficulty;
      continue;
    }

    if (target === "world.theme" && WORLD_THEMES.includes(String(value) as WorldTheme)) {
      next.world.theme = String(value) as WorldTheme;
      continue;
    }

    if (target === "player.kind" && PLAYER_KINDS.includes(String(value) as PlayerKind)) {
      next.player.kind = String(value) as PlayerKind;
      continue;
    }

    if (target === "player.name" && typeof value === "string" && value.trim()) {
      next.player.name = value.trim().slice(0, 32);
      continue;
    }

    if (target === "title" && typeof value === "string" && value.trim()) {
      next.title = value.trim().slice(0, 48);
      continue;
    }

    if (target === "player.health") {
      const n = asNumber(value);
      if (n !== null) next.player.health = clamp(Math.round(n), 1, 9999);
      continue;
    }
    if (target === "player.speed") {
      const n = asNumber(value);
      if (n !== null) next.player.speed = clamp(Math.round(n), 20, 800);
      continue;
    }
    if (target === "player.jump") {
      const n = asNumber(value);
      if (n !== null) next.player.jump = clamp(Math.round(n), 80, 900);
      continue;
    }

    if (target.startsWith("rules.")) {
      const n = asNumber(value);
      if (n !== null) setPath(next, target, n);
      continue;
    }

    if (target.startsWith("systems.") && typeof value === "boolean") {
      setPath(next, target, value);
      continue;
    }

    if (target === "boss" && value === null) {
      next.boss = null;
      next.levels.forEach((level, index) => {
        level.hasBoss = false;
        if (index === next.levels.length - 1) level.name = `第 ${index + 1} 关`;
      });
      continue;
    }

    if (target === "boss" && isRecord(value)) {
      next.boss = {
        name: typeof value.name === "string" ? value.name : next.boss?.name ?? "Boss",
        health: clamp(Math.round(asNumber(value.health) ?? next.boss?.health ?? 180), 10, 9999),
        damage: clamp(Math.round(asNumber(value.damage) ?? next.boss?.damage ?? 18), 1, 200),
        phases: clamp(Math.round(asNumber(value.phases) ?? next.boss?.phases ?? 1), 1, 3),
        speed: clamp(Math.round(asNumber(value.speed) ?? next.boss?.speed ?? 50), 10, 200),
      };
      const last = next.levels.at(-1);
      if (last) {
        last.hasBoss = true;
        last.name = `第 ${next.levels.length} 关 · Boss`;
      }
      continue;
    }

    if (target === "levels.coinCount") {
      const n = asNumber(value);
      if (n !== null) {
        next.systems.coins = true;
        next.levels.forEach((level) => {
          level.coinCount = clamp(Math.round(n), 0, 80);
        });
      }
      continue;
    }

    if (target === "levels.enemyCount") {
      const n = asNumber(value);
      if (n !== null) {
        next.levels.forEach((level) => {
          level.enemyCount = clamp(Math.round(n), 0, 80);
        });
      }
      continue;
    }

    if (patch.operation === "add" && target === "levels") {
      const index = next.levels.length;
      const extra = isRecord(value) ? value : {};
      const custom = extra.custom === true;
      const bricks = Array.isArray(extra.bricks) ? (extra.bricks as BrickStamp[]) : custom ? starterCustomBricks() : undefined;
      next.levels.push({
        id: `level_${index + 1}`,
        name: custom ? `第 ${index + 1} 关 · 自定义` : next.boss ? `第 ${index + 1} 关 · Boss` : `第 ${index + 1} 关`,
        theme: next.world.theme,
        width: 900 + index * 220,
        enemyCount: 3 + index * 2,
        coinCount: next.systems.coins ? 6 + index * 2 : 0,
        hasBoss: Boolean(next.boss) && !custom,
        custom,
        bricks,
      });
      if (next.levels[index - 1] && next.boss) next.levels[index - 1].hasBoss = false;
      continue;
    }

    if (patch.operation === "remove" && target === "levels" && next.levels.length > 1) {
      next.levels.pop();
      continue;
    }

    if (target === "extras" && isRecord(value)) {
      next.extras = { ...next.extras, ...value };
      continue;
    }

    if (target === "combat.chassis") {
      next.combat = next.combat ?? normalizeSpec(next).combat;
      if (next.combat) next.combat.chassis = resolveChassis(String(value)) as ShooterChassis;
      continue;
    }

    if (target.startsWith("extras.") || target.startsWith("combat.") || target === "combat") {
      setPath(next, target, value);
      if (target === "combat" && isRecord(value) && value.chassis) {
        next.combat = next.combat ?? normalizeSpec(next).combat;
        if (next.combat) next.combat.chassis = resolveChassis(String(value.chassis));
      }
      continue;
    }

    setPath(next, target, value);
  }

  return next;
}
