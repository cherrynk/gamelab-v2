import { uid } from "./ids";
import {
  SHOOTER_CHASSIS_LABEL,
  defaultCombat,
  resolveChassis,
  type Difficulty,
  type EnemySpec,
  type GameSpec,
  type GameType,
  type LevelSpec,
  type PlayerKind,
  type ShooterChassis,
  type StyleId,
  type WorldTheme,
} from "./spec";
import { getStyle } from "./styles";
import { getTemplate } from "./templates";

export type CreateInput = {
  prompt: string;
  gameType: GameType;
  styleId: StyleId;
  difficulty: Difficulty;
};

const PLAYER_ALIASES: Array<[RegExp, PlayerKind, string]> = [
  [/机器人|robot|机甲/i, "robot", "机器人"],
  [/法师|mage|巫师|魔法/i, "mage", "法师"],
  [/弓|archer|射手/i, "archer", "弓箭手"],
  [/史莱姆|slime/i, "slime", "史莱姆"],
  [/骑士|knight|勇士|冒险者/i, "knight", "小骑士"],
];

const THEME_ALIASES: Array<[RegExp, WorldTheme]> = [
  [/城堡|castle/i, "castle"],
  [/地牢|地下城|dungeon|洞穴/i, "dungeon"],
  [/城市|都市|city|赛博/i, "city"],
  [/太空|宇宙|space/i, "space"],
  [/森林|forest|丛林/i, "forest"],
];

const DIFFICULTY_RULES: Record<
  Difficulty,
  { enemySpeedMul: number; enemyDamageMul: number; playerHealthMul: number }
> = {
  easy: { enemySpeedMul: 0.8, enemyDamageMul: 0.7, playerHealthMul: 1.3 },
  medium: { enemySpeedMul: 1, enemyDamageMul: 1, playerHealthMul: 1 },
  hard: { enemySpeedMul: 1.25, enemyDamageMul: 1.4, playerHealthMul: 0.8 },
};

function pickPlayer(prompt: string): { kind: PlayerKind; name: string } {
  for (const [pattern, kind, name] of PLAYER_ALIASES) {
    if (pattern.test(prompt)) return { kind, name };
  }
  return { kind: "knight", name: "主角" };
}

function pickTheme(prompt: string, styleId: StyleId): WorldTheme {
  for (const [pattern, theme] of THEME_ALIASES) {
    if (pattern.test(prompt)) return theme;
  }
  if (styleId === "cyberpunk") return "city";
  if (styleId === "dark_fantasy") return "dungeon";
  return "forest";
}

function pickLevelCount(prompt: string) {
  const match = prompt.match(/(\d+)\s*(个)?\s*(关|关卡|levels?|waves?)/i);
  if (match) return Math.min(6, Math.max(1, Number(match[1])));
  if (/两关|两波/.test(prompt)) return 2;
  if (/三关|三波/.test(prompt)) return 3;
  if (/四关|四波/.test(prompt)) return 4;
  return 3;
}

function wants(prompt: string, yes: RegExp, no?: RegExp) {
  if (no?.test(prompt)) return false;
  return yes.test(prompt);
}

function enemyRoster(theme: WorldTheme, gameType: GameType): EnemySpec[] {
  if (gameType === "tower") {
    return [
      { id: "creep", name: theme === "city" ? "无人机" : "小怪", speed: 70, damage: 8, health: 24 },
      { id: "runner", name: "快跑者", speed: 110, damage: 6, health: 16 },
    ];
  }
  if (theme === "forest") {
    return [
      { id: "slime", name: "史莱姆", speed: 40, damage: 10, health: 20 },
      { id: "goblin", name: "哥布林", speed: 55, damage: 14, health: 28 },
    ];
  }
  if (theme === "castle") {
    return [
      { id: "guard", name: "守卫", speed: 45, damage: 12, health: 30 },
      { id: "bat", name: "蝙蝠", speed: 70, damage: 8, health: 16 },
    ];
  }
  if (theme === "city") {
    return [
      { id: "drone", name: "无人机", speed: 60, damage: 12, health: 22 },
      { id: "thug", name: "暴徒", speed: 50, damage: 16, health: 32 },
    ];
  }
  if (theme === "space") {
    return [
      { id: "alien", name: "外星虫", speed: 58, damage: 12, health: 24 },
    ];
  }
  return [
    { id: "skeleton", name: "骷髅", speed: 42, damage: 14, health: 26 },
    { id: "ghost", name: "幽灵", speed: 64, damage: 10, health: 18 },
  ];
}

function pickChassis(prompt: string): ShooterChassis {
  return resolveChassis(prompt);
}

function titleFrom(playerName: string, theme: WorldTheme, gameType: GameType, chassis?: ShooterChassis) {
  const template = getTemplate(gameType);
  const themeLabel: Record<WorldTheme, string> = {
    forest: "森林",
    castle: "城堡",
    dungeon: "地牢",
    city: "霓虹城",
    space: "星海",
  };
  if (gameType === "shooter") {
    return `${themeLabel[theme]}${SHOOTER_CHASSIS_LABEL[chassis ?? "plane"]}射击`;
  }
  if (template.defaultLevels <= 1 && !template.defaultBoss) {
    return `${themeLabel[theme]}${template.title}`;
  }
  return `${playerName}的${themeLabel[theme]}${template.title}`;
}

export function planGame(input: CreateInput): GameSpec {
  const prompt = input.prompt.trim();
  const template = getTemplate(input.gameType);
  const player = pickPlayer(prompt);
  const theme = pickTheme(prompt, input.styleId);
  const mentionedLevels = /(\d+)\s*(个)?\s*(关|关卡|levels?|waves?)|两关|两波|三关|三波|四关|四波/i.test(prompt);
  const wantsMoreLevels = template.defaultLevels <= 1 && /关卡|多关|几关/.test(prompt);
  const levelCount = mentionedLevels ? pickLevelCount(prompt) : wantsMoreLevels ? 3 : template.defaultLevels;
  const coins =
    wants(prompt, /金币|硬币|coin|treasure|宝藏|星星/i) ||
    (template.defaultCoins && !wants(prompt, /不要金币|不要星星|no coin/i));
  const shop = wants(prompt, /商店|shop|购买|买/i);
  const includeBoss = !/不要\s*boss|无 boss|no boss/i.test(prompt) &&
    (/boss|Boss|首领|魔王/.test(prompt) || template.defaultBoss);
  const rules = DIFFICULTY_RULES[input.difficulty];
  const enemies = enemyRoster(theme, input.gameType);
  const chassis = input.gameType === "shooter" ? pickChassis(prompt) : undefined;

  const levels: LevelSpec[] = Array.from({ length: levelCount }, (_, index) => {
    const last = index === levelCount - 1;
    return {
      id: `level_${index + 1}`,
      name: last && includeBoss ? `第 ${index + 1} 关 · Boss` : `第 ${index + 1} 关`,
      theme,
      width: 900 + index * 220,
      enemyCount: 3 + index * 2,
      coinCount: coins ? 6 + index * 2 : 0,
      hasBoss: Boolean(includeBoss && last),
    };
  });

  return {
    id: uid("game"),
    title: titleFrom(player.name, theme, input.gameType, chassis),
    prompt,
    gameType: input.gameType,
    difficulty: input.difficulty,
    style: getStyle(input.styleId),
    camera: template.camera,
    player: {
      name: player.name,
      kind: player.kind,
      health: Math.round(100 * rules.playerHealthMul),
      speed: input.gameType === "rpg" ? 160 : 220,
      jump: 420,
    },
    levels,
    enemies,
    boss: includeBoss
      ? {
          name: theme === "forest" ? "森林守护者" : theme === "city" ? "核心主机" : "关底 Boss",
          health: 180 + levelCount * 40,
          damage: 18,
          phases: input.difficulty === "hard" ? 2 : 1,
          speed: 50,
        }
      : null,
    systems: {
      coins,
      shop,
      health: template.defaultHealth,
      checkpoint: input.gameType === "platformer",
    },
    rules: {
      ...rules,
      coinValue: 1,
    },
    world: { theme },
    combat: {
      ...defaultCombat(input.gameType),
      ...(chassis ? { chassis } : {}),
    },
    extras: {},
  };
}

export function summarizeSpec(spec: GameSpec) {
  const template = getTemplate(spec.gameType);
  return [
    `模板：${template.title}`,
    spec.levels.length > 1 ? `${spec.levels.length} 个关卡` : null,
    spec.systems.coins ? "收集系统" : null,
    spec.boss ? "Boss 战" : null,
    spec.systems.health ? "生命值系统" : null,
    spec.systems.shop ? "商店" : null,
    spec.gameType === "shooter" && spec.combat?.drops?.length
      ? `掉落 ${spec.combat.drops.map((item) => item.name).join("/")}`
      : null,
    spec.gameType === "shooter" && spec.combat?.chassis ? `载具：${SHOOTER_CHASSIS_LABEL[spec.combat.chassis]}` : null,
    spec.gameType === "shooter" && spec.combat?.weapon ? `武器：${spec.combat.weapon.name}` : null,
    spec.gameType === "paddle_ball" && spec.levels.length > 1 ? "后关多彩多血砖和钢板" : null,
    spec.gameType === "paddle_ball" && spec.levels.some((level) => level.custom) ? "自定义摆砖关卡" : null,
    `难度：${spec.difficulty}`,
    `风格：${spec.style.id}`,
  ].filter(Boolean) as string[];
}

export function firstReply(spec: GameSpec) {
  const summary = summarizeSpec(spec);
  return `游戏已经生成完成\n${summary.map((item) => `- ${item}`).join("\n")}\n\n接下来可以直接玩。想改就用平常说话，比如换风格、改名字、调难度，也可以问「这个游戏怎么玩」。`;
}
