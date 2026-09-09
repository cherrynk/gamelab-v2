export const GAME_TYPES = [
  "shooter",
  "paddle_ball",
  "platformer",
  "rpg",
  "tower",
  "star_catcher",
  "runner",
  "memory",
  "merge",
  "dodge",
  "tile_lab",
] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const STYLE_IDS = [
  "pixel_art",
  "cartoon",
  "anime",
  "dark_fantasy",
  "cyberpunk",
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const PLAYER_KINDS = ["knight", "robot", "mage", "archer", "slime"] as const;
export type PlayerKind = (typeof PLAYER_KINDS)[number];

export const WORLD_THEMES = ["forest", "castle", "dungeon", "city", "space"] as const;
export type WorldTheme = (typeof WORLD_THEMES)[number];

export const BULLET_KINDS = ["single", "triple", "spread", "laser", "homing", "burst"] as const;
export type BulletKind = (typeof BULLET_KINDS)[number];

export const DROP_KINDS = ["weapon", "heal", "coin", "shield", "speed"] as const;
export type DropKind = (typeof DROP_KINDS)[number];

export const SHOOTER_CHASSIS = ["plane", "soldier", "tank"] as const;
export type ShooterChassis = (typeof SHOOTER_CHASSIS)[number];

export const SHOOTER_CHASSIS_LABEL: Record<ShooterChassis, string> = {
  plane: "飞机",
  soldier: "特种兵",
  tank: "坦克",
};

export function resolveChassis(hint?: string | null): ShooterChassis {
  const raw = String(hint ?? "");
  const hits: Array<[number, ShooterChassis]> = [];
  const tankAt = raw.search(/坦克|装甲|\btank\b/i);
  const soldierAt = raw.search(/特种|步兵|士兵|特种部队|commando|\bsoldier\b/i);
  const planeAt = raw.search(/飞机|战机|飞船|战斗机|\bplane\b|\bship\b/i);
  if (tankAt >= 0) hits.push([tankAt, "tank"]);
  if (soldierAt >= 0) hits.push([soldierAt, "soldier"]);
  if (planeAt >= 0) hits.push([planeAt, "plane"]);
  hits.sort((a, b) => a[0] - b[0]);
  if (hits[0]) return hits[0][1];
  const compact = raw.trim().toLowerCase();
  if (SHOOTER_CHASSIS.includes(compact as ShooterChassis)) return compact as ShooterChassis;
  return "plane";
}

export type WeaponSpec = {
  id: string;
  name: string;
  bullet: BulletKind;
  damage: number;
  fireRate: number;
  speed: number;
  count?: number;
};

export type DropSpec = {
  id: string;
  name: string;
  kind: DropKind;
  weaponId?: string;
  chance: number;
  duration?: number;
};

export type CombatSpec = {
  chassis?: ShooterChassis;
  weapon: WeaponSpec;
  weapons: WeaponSpec[];
  drops: DropSpec[];
  dropChance: number;
};

export type StyleSpec = {
  id: StyleId;
  palette: "warm" | "cool" | "neon" | "muted" | "night";
  outline: "dark" | "light" | "none";
  lighting: "flat" | "soft" | "dramatic";
  resolution: "16px" | "32px" | "smooth";
  animation: "retro" | "smooth";
  pixelArt: boolean;
  background: string;
  colors: {
    bg: number;
    ground: number;
    player: number;
    enemy: number;
    coin: number;
    boss: number;
    accent: number;
    platform: number;
    hazard: number;
    ui: string;
    muted: string;
  };
};

export type BrickStamp = {
  col: number;
  row: number;
  hp?: number;
  steel?: boolean;
};

export type LevelSpec = {
  id: string;
  name: string;
  theme: WorldTheme;
  width: number;
  enemyCount: number;
  coinCount: number;
  hasBoss: boolean;
  custom?: boolean;
  bricks?: BrickStamp[];
};

export type EnemySpec = {
  id: string;
  name: string;
  speed: number;
  damage: number;
  health: number;
};

export type BossSpec = {
  name: string;
  health: number;
  damage: number;
  phases: number;
  speed: number;
};

export type GameSpec = {
  id: string;
  title: string;
  prompt: string;
  gameType: GameType;
  difficulty: Difficulty;
  style: StyleSpec;
  camera: "side-scroll" | "top-down" | "fixed";
  player: {
    name: string;
    kind: PlayerKind;
    health: number;
    speed: number;
    jump: number;
  };
  levels: LevelSpec[];
  enemies: EnemySpec[];
  boss: BossSpec | null;
  systems: {
    coins: boolean;
    shop: boolean;
    health: boolean;
    checkpoint: boolean;
    [key: string]: boolean;
  };
  rules: {
    enemySpeedMul: number;
    enemyDamageMul: number;
    playerHealthMul: number;
    coinValue: number;
    [key: string]: number;
  };
  world: {
    theme: WorldTheme;
  };
  combat?: CombatSpec;
  extras?: Record<string, unknown>;
};

const DEFAULT_WEAPONS: WeaponSpec[] = [
  { id: "cannon", name: "机炮", bullet: "single", damage: 1, fireRate: 200, speed: 10 },
  { id: "triple", name: "三连弹", bullet: "triple", damage: 1, fireRate: 90, speed: 13 },
  { id: "spread", name: "散弹", bullet: "spread", damage: 1, fireRate: 180, speed: 11, count: 5 },
  { id: "laser", name: "激光", bullet: "laser", damage: 2, fireRate: 80, speed: 16 },
  { id: "homing", name: "追踪弹", bullet: "homing", damage: 1, fireRate: 220, speed: 8 },
  { id: "burst", name: "点射", bullet: "burst", damage: 1, fireRate: 140, speed: 12, count: 3 },
];

export function defaultCombat(gameType: GameType): CombatSpec {
  const weapons = DEFAULT_WEAPONS.map((item) => ({ ...item }));
  const cannon = { ...weapons[0] };
  if (gameType === "shooter") {
    return {
      chassis: "plane",
      weapon: cannon,
      weapons,
      drops: [
        { id: "drop_triple", name: "三连弹", kind: "weapon", weaponId: "triple", chance: 0.22, duration: 10000 },
        { id: "drop_spread", name: "散弹", kind: "weapon", weaponId: "spread", chance: 0.18, duration: 8000 },
        { id: "drop_laser", name: "激光", kind: "weapon", weaponId: "laser", chance: 0.16, duration: 8000 },
        { id: "drop_homing", name: "追踪弹", kind: "weapon", weaponId: "homing", chance: 0.16, duration: 8000 },
        { id: "drop_burst", name: "点射", kind: "weapon", weaponId: "burst", chance: 0.16, duration: 8000 },
      ],
      dropChance: 0.55,
    };
  }
  return {
    weapon: cannon,
    weapons,
    drops: [],
    dropChance: 0,
  };
}

const WEAPON_ALIASES: Record<string, string> = {
  cannon: "cannon",
  机炮: "cannon",
  triple: "triple",
  三连弹: "triple",
  三联: "triple",
  spread: "spread",
  散弹: "spread",
  霰弹: "spread",
  laser: "laser",
  激光: "laser",
  laserbeam: "laser",
  homing: "homing",
  追踪弹: "homing",
  追踪: "homing",
  寻的: "homing",
  burst: "burst",
  点射: "burst",
  连发: "burst",
};

export function resolveWeaponId(hint?: string) {
  if (!hint) return undefined;
  const raw = hint.trim();
  const compact = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (WEAPON_ALIASES[raw]) return WEAPON_ALIASES[raw];
  if (WEAPON_ALIASES[compact]) return WEAPON_ALIASES[compact];
  for (const [key, id] of Object.entries(WEAPON_ALIASES)) {
    if (raw.includes(key) || compact.includes(key.toLowerCase())) return id;
  }
  return raw;
}

export function catalogWeapon(id: string): WeaponSpec {
  return DEFAULT_WEAPONS.find((item) => item.id === id) ?? DEFAULT_WEAPONS[0];
}

export function resolveWeapon(combat: CombatSpec | undefined, hint?: string) {
  const id = resolveWeaponId(hint);
  if (!id) return combat?.weapon ?? DEFAULT_WEAPONS[0];
  return combat?.weapons.find((item) => item.id === id) ?? catalogWeapon(id);
}

export function weaponById(combat: CombatSpec | undefined, id?: string) {
  return resolveWeapon(combat, id);
}

function sanitizeDrop(drop: DropSpec): DropSpec {
  const weaponId = resolveWeaponId(drop.weaponId) ?? resolveWeaponId(drop.name) ?? "cannon";
  const weapon = catalogWeapon(weaponId);
  return {
    id: drop.id || `drop_${weapon.id}`,
    name: drop.name || weapon.name,
    kind: drop.kind ?? "weapon",
    weaponId: weapon.id,
    chance: drop.chance > 0 ? drop.chance : 0.2,
    duration: drop.duration ?? 8000,
  };
}

export function normalizeCombat(gameType: GameType, combat?: CombatSpec): CombatSpec {
  const base = defaultCombat(gameType);
  const current = combat ?? base;
  const byId = new Map(base.weapons.map((item) => [item.id, { ...item }]));
  for (const weapon of current.weapons ?? []) {
    const id = resolveWeaponId(weapon.id) ?? weapon.id;
    byId.set(id, { ...catalogWeapon(id), ...weapon, id });
  }
  const weapons = [...byId.values()];
  const drops = (current.drops?.length ? current.drops : base.drops).map(sanitizeDrop);
  if (gameType === "shooter") {
    const have = new Set(drops.map((item) => item.weaponId));
    for (const extra of base.drops) {
      if (!have.has(extra.weaponId)) drops.push(sanitizeDrop(extra));
    }
  }
  return {
    chassis: resolveChassis(current.chassis) ?? base.chassis ?? "plane",
    weapon: resolveWeapon({ ...current, weapons }, current.weapon?.id ?? current.weapon?.name) ?? weapons[0],
    weapons,
    drops,
    dropChance: current.dropChance > 0 ? current.dropChance : base.dropChance,
  };
}

export function normalizeSpec(spec: GameSpec): GameSpec {
  const next = cloneSpec(spec);
  next.combat = normalizeCombat(next.gameType, next.combat);
  next.extras = next.extras ?? {};
  const extraChassis = next.extras.chassis ?? next.extras.shooterMode ?? next.extras.vehicle;
  if (extraChassis !== undefined && next.combat) {
    next.combat.chassis = resolveChassis(String(extraChassis));
  }
  next.systems = {
    ...next.systems,
    coins: Boolean(next.systems?.coins),
    shop: Boolean(next.systems?.shop),
    health: Boolean(next.systems?.health),
    checkpoint: Boolean(next.systems?.checkpoint),
  };
  next.rules = {
    ...next.rules,
    enemySpeedMul: next.rules?.enemySpeedMul ?? 1,
    enemyDamageMul: next.rules?.enemyDamageMul ?? 1,
    playerHealthMul: next.rules?.playerHealthMul ?? 1,
    coinValue: next.rules?.coinValue ?? 1,
  };
  return next;
}

export type GamePatch = {
  operation: "update" | "add" | "remove";
  target: string;
  field?: string;
  value?: unknown;
  note: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
};

export type GameVersion = {
  id: string;
  label: string;
  createdAt: number;
  spec: GameSpec;
};

export type GameProject = {
  id: string;
  createdAt: number;
  updatedAt: number;
  published: boolean;
  versions: GameVersion[];
  currentVersionId: string;
  messages: ChatMessage[];
};

export function currentSpec(project: GameProject): GameSpec {
  const version =
    project.versions.find((item) => item.id === project.currentVersionId) ??
    project.versions[project.versions.length - 1];
  return normalizeSpec(version.spec);
}

export function cloneSpec(spec: GameSpec): GameSpec {
  return structuredClone(spec);
}
