import type { GamePatch, GameType } from "./spec";
import { learnedCapabilities } from "./learnedCapabilities";

export type Capability = {
  id: string;
  label: string;
  say: string;
  targets: string[];
  example?: Pick<GamePatch, "operation" | "target" | "value" | "note">;
};

export type TemplateCatalog = {
  gameType: GameType;
  /** 为 true 时，模型和本地都只能写目录里的 target */
  strict: boolean;
  capabilities: Capability[];
};

const SHARED: Capability[] = [
  {
    id: "title",
    label: "游戏名",
    say: "改名叫霓虹弹球",
    targets: ["title"],
    example: { operation: "update", target: "title", value: "霓虹弹球", note: "改标题" },
  },
  {
    id: "style",
    label: "画面风格",
    say: "换成像素风格",
    targets: ["style"],
    example: { operation: "update", target: "style", value: "pixel_art", note: "视觉风格改为像素" },
  },
  {
    id: "difficulty",
    label: "难度",
    say: "再难一点",
    targets: ["difficulty", "rules.enemySpeedMul", "rules.enemyDamageMul"],
    example: { operation: "update", target: "difficulty", value: "hard", note: "难度上调" },
  },
  {
    id: "levels",
    label: "增减关卡",
    say: "再加一关",
    targets: ["levels"],
    example: { operation: "add", target: "levels", note: "新增一关" },
  },
];

const PADDLE: Capability[] = [
  {
    id: "customBricks",
    label: "自己摆砖",
    say: "增加自定义关卡",
    targets: ["levels", "extras.editingBricks", "extras.previewLevel"],
    example: { operation: "update", target: "extras.editingBricks", value: true, note: "打开砖块编辑" },
  },
  {
    id: "wideDrop",
    label: "挡板变长",
    say: "打碎砖块掉落挡板变长",
    targets: ["extras.widePaddleDrop", "extras.powerupDuration", "extras.brickDrops"],
    example: { operation: "update", target: "extras.widePaddleDrop", value: 0.22, note: "打碎砖块掉落挡板变长" },
  },
  {
    id: "slowDrop",
    label: "球变慢",
    say: "打碎砖块掉落球速变慢",
    targets: ["extras.slowBallDrop", "extras.powerupDuration", "extras.brickDrops"],
    example: { operation: "update", target: "extras.slowBallDrop", value: 0.22, note: "打碎砖块掉落球速变慢" },
  },
  {
    id: "clearDrop",
    label: "清场",
    say: "掉落奖励让砖块全消",
    targets: ["extras.clearBricksDrop", "extras.brickDrops"],
    example: { operation: "update", target: "extras.clearBricksDrop", value: 0.16, note: "打碎砖块掉落清场奖励" },
  },
  {
    id: "dualDrop",
    label: "双挡板",
    say: "增加双挡板奖励",
    targets: ["extras.dualPaddleDrop", "extras.powerupDuration", "extras.brickDrops"],
    example: { operation: "update", target: "extras.dualPaddleDrop", value: 0.18, note: "打碎砖块掉落双挡板" },
  },
  {
    id: "pierceDrop",
    label: "破钢",
    say: "掉落奖励可以打碎钢板",
    targets: ["extras.steelBreakDrop", "extras.powerupDuration", "extras.brickDrops"],
    example: { operation: "update", target: "extras.steelBreakDrop", value: 0.18, note: "打碎砖块掉落破钢奖励" },
  },
  {
    id: "fancyBricks",
    label: "彩色多血钢板",
    say: "第二关砖块要打几下，再加打不碎的",
    targets: [
      "extras.coloredBricks",
      "extras.multiHitBricks",
      "extras.randomBrickLayout",
      "extras.unbreakableBricks",
      "extras.brickMaxHp",
      "extras.unbreakableChance",
      "extras.fancyBricksFromLevel",
    ],
    example: { operation: "update", target: "extras.coloredBricks", value: true, note: "后关彩色砖块" },
  },
  {
    id: "multiball",
    label: "多球",
    say: "打掉砖块有概率多一个球",
    targets: ["extras.multiballChance", "extras.maxBalls"],
    example: { operation: "update", target: "extras.multiballChance", value: 0.35, note: "打掉砖块有概率多一个球" },
  },
  {
    id: "speed",
    label: "球速节奏",
    say: "球再慢一点",
    targets: ["rules.enemySpeedMul"],
    example: { operation: "update", target: "rules.enemySpeedMul", value: 0.8, note: "速度放慢" },
  },
];

const PADDLE_EXTRAS = new Set(
  PADDLE.flatMap((item) => item.targets).filter((target) => target.startsWith("extras.")),
);

function learnedAsCapabilities(gameType: GameType): Capability[] {
  return learnedCapabilities
    .filter((item) => item.gameType === gameType)
    .map((item) => ({
      id: item.id,
      label: item.label,
      say: item.say,
      targets: [`extras.${item.extrasKey}`],
      example: {
        operation: "update",
        target: `extras.${item.extrasKey}`,
        value: item.chance,
        note: item.label,
      },
    }));
}

export function catalogFor(gameType: GameType): TemplateCatalog {
  if (gameType === "paddle_ball") {
    return { gameType, strict: true, capabilities: [...SHARED, ...PADDLE, ...learnedAsCapabilities(gameType)] };
  }
  return { gameType, strict: false, capabilities: [...SHARED, ...learnedAsCapabilities(gameType)] };
}

export function capabilitySummary(gameType: GameType) {
  const extra = catalogFor(gameType).capabilities.filter((item) => !SHARED.some((shared) => shared.id === item.id));
  const labels = extra.length ? extra.map((item) => item.label) : SHARED.map((item) => item.label);
  return labels.join(" · ");
}

export function catalogSayList(gameType: GameType) {
  return catalogFor(gameType)
    .capabilities.filter((item) => item.id !== "title")
    .map((item) => `「${item.say}」`)
    .slice(0, 6)
    .join("、");
}

export function availableReply(gameType: GameType, templateTitle: string) {
  return `「${templateTitle}」现在能改：${capabilitySummary(gameType)}。可以说${catalogSayList(gameType)}。`;
}

export function unsupportedReply(gameType: GameType, templateTitle: string) {
  return `「${templateTitle}」现在还没有这个玩法。能改的是：${capabilitySummary(gameType)}。可以说${catalogSayList(gameType)}。`;
}

export function isPaddleOnlyTarget(target: string) {
  const extras = [
    ...PADDLE_EXTRAS,
    ...learnedAsCapabilities("paddle_ball").flatMap((item) => item.targets),
  ];
  return extras.some((allowed) => target === allowed || target.startsWith(`${allowed}.`));
}

export function isAllowedTarget(gameType: GameType, target: string) {
  const catalog = catalogFor(gameType);
  if (!catalog.strict) return true;
  return catalog.capabilities.some((item) =>
    item.targets.some((allowed) => target === allowed || target.startsWith(`${allowed}.`)),
  );
}

export function catalogPlaybook(gameType: GameType, templateTitle: string) {
  const catalog = catalogFor(gameType);
  const lines = catalog.capabilities.map((item) => {
    const example = item.example ? ` 例：${JSON.stringify(item.example)}` : "";
    return `- ${item.label}（${item.targets.join("、")}）：可以说「${item.say}」。${example}`;
  });
  return `当前工作室打开的模板是「${templateTitle}」，gameType=${gameType}。
只改这一局这个模板，不要根据用户用词去猜成别的游戏。
用户说「掉落」就按本模板的掉落改，不要写成其他模板的武器或子弹。
只能写下面目录里的 target。目录没有的玩法不要编新字段，patches 为空，reply 说明做不到并列出能改的。
提问则 patches 为空并回答问题。联机、真 3D、生成音频文件做不到。

能改：
${lines.join("\n")}
${gameType === "paddle_ball" ? "不要写 combat.weapon / combat.drops / combat.chassis，弹球没有机炮和怪物子弹。" : ""}`;
}
