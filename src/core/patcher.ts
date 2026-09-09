import { applyStructuredPatches } from "./applyPatch";
import { availableReply, isAllowedTarget, isPaddleOnlyTarget, unsupportedReply } from "./capabilities";
import { learnedCapabilities } from "./learnedCapabilities";
import { starterCustomBricks } from "./paddleGrid";
import { getTemplate } from "./templates";
import { getStyleMeta } from "./styles";
import {
  SHOOTER_CHASSIS_LABEL,
  STYLE_IDS,
  WORLD_THEMES,
  defaultCombat,
  resolveChassis,
  type DropSpec,
  type GamePatch,
  type GameSpec,
  type PlayerKind,
  type StyleId,
  type WorldTheme,
} from "./spec";

export type ChatResult = {
  spec: GameSpec;
  patches: GamePatch[];
  reply: string;
  /** 本地已经答完（提问或已改），不要再问模型 */
  handled?: boolean;
  jobId?: string;
};

function patch(target: string, value: unknown, note: string, operation: GamePatch["operation"] = "update"): GamePatch {
  return { operation, target, value, note };
}

function numberIn(text: string) {
  const match = text.match(/(-?\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function percentIn(text: string) {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) / 100 : null;
}

function extractTitle(text: string) {
  const match = text.match(
    /(?:改名叫|把名字改成|名字改成|标题改成|游戏名改成|叫做|叫成)\s*[「"']?(.+?)[」"']?(?=$|[，,。；;！!？?\n]|背景|风格|主角|然后|并且|再[换改]|换成|难度|血量)/,
  );
  const title = match?.[1]?.trim();
  return title || null;
}

function answerQuestion(spec: GameSpec, text: string) {
  const template = getTemplate(spec.gameType);
  if (/怎么玩|如何玩|玩法|操作|怎么操作/.test(text)) {
    return `${template.title}的玩法：${template.howTo}`;
  }
  if (/什么风格|现在.*风格|画面风格/.test(text)) {
    return `当前风格是${getStyleMeta(spec.style.id).title}。也可以换成像素、卡通、动漫、黑暗奇幻或赛博朋克。`;
  }
  if (/几关|多少关|关卡数/.test(text)) {
    return `现在有 ${spec.levels.length} 关。`;
  }
  if (/叫什么|名字|标题/.test(text) && !/改|换|叫成|改成/.test(text)) {
    return `这局游戏叫「${spec.title}」，主角是${spec.player.name}。`;
  }
  if (/能不能|可以.*吗|支持/.test(text) && /联机|多人|3d/i.test(text)) {
    if (/联机|多人/.test(text)) return "现在还不能做联机。玩法、武器、掉落、难度和画面都可以改。";
    if (/3d/i.test(text)) return "第一版只做 2D 浏览器游戏。";
  }
  if (/能改什么|可以改什么|有哪些玩法|能做什么|支持什么/.test(text)) {
    return availableReply(spec.gameType, template.title);
  }
  return null;
}

const WEAPON_ALIASES: Array<[RegExp, string, string]> = [
  [/三连|三联/, "triple", "三连弹"],
  [/散弹|霰弹|扇形/, "spread", "散弹"],
  [/激光/, "laser", "激光"],
  [/追踪|寻的|跟踪/, "homing", "追踪弹"],
  [/连发|点射|burst/, "burst", "点射"],
  [/机炮|单发|普通子弹/, "cannon", "机炮"],
];

function combatPatches(spec: GameSpec, text: string): GamePatch[] {
  if (spec.gameType !== "shooter") return [];
  if (!/子弹|弹药|弹种|掉落|三连|散弹|激光|追踪弹|武器|掉宝/.test(text)) return [];
  const catalog = defaultCombat(spec.gameType);
  const wanted = WEAPON_ALIASES.filter(([pattern]) => pattern.test(text));
  const kinds = wanted.length ? wanted : WEAPON_ALIASES.slice(0, 4);
  const drops: DropSpec[] = kinds
    .filter(([, id]) => id !== "cannon")
    .map(([, id, name], index) => ({
      id: `drop_${id}`,
      name,
      kind: "weapon",
      weaponId: id,
      chance: Number((0.34 - index * 0.06).toFixed(2)),
      duration: 9000,
    }));

  if (/多种|几种|不同|各种/.test(text) || wanted.length >= 2 || /怪物|敌人|死后|掉落|掉宝/.test(text)) {
    const nextWeapon = wanted[0]
      ? catalog.weapons.find((item) => item.id === wanted[0][1]) ?? catalog.weapon
      : catalog.weapon;
    return [
      patch("combat.weapons", catalog.weapons, "写入武器表"),
      patch("combat.weapon", nextWeapon, `默认武器：${nextWeapon.name}`),
      patch("combat.drops", drops, "怪物死后掉落多种子弹"),
      patch("combat.dropChance", 0.55, "提高掉落率"),
    ];
  }

  if (wanted.length === 1) {
    const weapon = catalog.weapons.find((item) => item.id === wanted[0][1]) ?? catalog.weapon;
    return [patch("combat.weapon", weapon, `默认子弹改为${weapon.name}`)];
  }
  return [];
}

function inferPatches(spec: GameSpec, text: string): GamePatch[] {
  const patches: GamePatch[] = [];
  const n = numberIn(text);
  const pct = percentIn(text);

  const styleHit = STYLE_IDS.find((id) => {
    const labels: Record<StyleId, RegExp> = {
      pixel_art: /像素/,
      cartoon: /卡通|可爱/,
      anime: /动漫|二次元/,
      dark_fantasy: /黑暗奇幻|暗黑|恐怖|阴暗/,
      cyberpunk: /赛博|霓虹|科技|未来/,
    };
    return labels[id].test(text);
  });
  if (styleHit && styleHit !== spec.style.id && /换|改|变成|改成|要|用/.test(text)) {
    patches.push(patch("style", styleHit, `视觉风格改为${styleHit}`));
  }

  const themeHit = WORLD_THEMES.find((id) => {
    const labels: Record<WorldTheme, RegExp> = {
      forest: /森林|丛林/,
      castle: /城堡/,
      dungeon: /地牢|地下城|洞穴/,
      city: /城市|都市|霓虹城/,
      space: /太空|宇宙|星海/,
    };
    return labels[id].test(text);
  });
  if (themeHit && /换|改|变成|背景|场景|地图|世界/.test(text)) {
    patches.push(patch("world.theme", themeHit, `场景改到${themeHit}`));
  }

  const kindHit = (
    [
      [/机器人|robot|机甲/i, "robot", "机器人"],
      [/骑士|knight/i, "knight", "小骑士"],
      [/法师|mage|巫师/i, "mage", "法师"],
      [/弓|archer|射手/i, "archer", "弓箭手"],
      [/史莱姆|slime/i, "slime", "史莱姆"],
    ] as Array<[RegExp, PlayerKind, string]>
  ).find(([pattern]) => pattern.test(text));
  if (kindHit && /换|改|变成|主角|角色/.test(text)) {
    patches.push(patch("player.kind", kindHit[1], `主角换成${kindHit[2]}`));
    patches.push(patch("player.name", kindHit[2], `主角名称：${kindHit[2]}`));
  }

  if (
    spec.gameType === "shooter" &&
    /特种兵|士兵|步兵|特种部队|坦克|装甲|飞机|战机|飞船/.test(text) &&
    /换|改|变成|改成|做成|要|用/.test(text)
  ) {
    const chassis = resolveChassis(text);
    const label = SHOOTER_CHASSIS_LABEL[chassis];
    patches.push(patch("combat.chassis", chassis, `改成${label}射击`));
    patches.push(patch("player.name", label, `主角名称：${label}`));
  }

  const title = extractTitle(text);
  if (title) {
    patches.push(patch("title", title, `标题改为「${title}」`));
  }

  if (/简单|容易|太难|降低难度|更好过|轻松/.test(text)) {
    patches.push(patch("rules.enemySpeedMul", Number((spec.rules.enemySpeedMul * 0.8).toFixed(2)), "节奏变慢"));
    patches.push(patch("rules.enemyDamageMul", Number((spec.rules.enemyDamageMul * 0.8).toFixed(2)), "伤害降低"));
    patches.push(patch("player.health", Math.round(spec.player.health * 1.25), "生命提高"));
    patches.push(patch("difficulty", spec.difficulty === "hard" ? "medium" : "easy", "难度下调"));
  } else if (/更难|难一点|加强|太简单|太无聊|没意思|更好玩/.test(text)) {
    patches.push(patch("rules.enemySpeedMul", Number((spec.rules.enemySpeedMul * 1.2).toFixed(2)), "节奏加快"));
    patches.push(patch("rules.enemyDamageMul", Number((spec.rules.enemyDamageMul * 1.2).toFixed(2)), "伤害提高"));
    patches.push(patch("difficulty", spec.difficulty === "easy" ? "medium" : "hard", "难度上调"));
  }

  const powerupTalk = spec.gameType === "paddle_ball" && /掉落|奖励|礼物|挡板|滑板|变长/.test(text);
  if (/慢|减速|太快/.test(text) && !/简单|容易/.test(text) && !powerupTalk) {
    const mul = pct ? 1 - pct : 0.8;
    patches.push(patch("rules.enemySpeedMul", Number((spec.rules.enemySpeedMul * mul).toFixed(2)), "速度放慢"));
  }
  if (/快|加速|太慢/.test(text) && !/更难|难一点/.test(text) && !powerupTalk) {
    const mul = pct ? 1 + pct : 1.2;
    patches.push(patch("rules.enemySpeedMul", Number((spec.rules.enemySpeedMul * mul).toFixed(2)), "速度加快"));
    patches.push(patch("player.speed", Math.round(spec.player.speed * 1.12), "移动更快"));
  }

  const template = getTemplate(spec.gameType);
  const canJump = spec.gameType === "platformer" || spec.gameType === "runner";
  if (canJump && /跳/.test(text) && /高|大/.test(text)) {
    patches.push(patch("player.jump", Math.round(spec.player.jump * 1.2), "跳得更高"));
  }
  if (canJump && /跳/.test(text) && /低|矮|小/.test(text)) {
    patches.push(patch("player.jump", Math.round(spec.player.jump * 0.85), "跳得低一些"));
  }

  if (template.defaultHealth) {
    if ((/血|生命|hp/i.test(text) || /耐打|更肉/.test(text)) && n !== null && n >= 1 && n <= 999) {
      patches.push(patch("player.health", n, `生命改为 ${n}`));
    } else if (/血|生命|耐打/.test(text) && /加|多|提高/.test(text)) {
      patches.push(patch("player.health", Math.round(spec.player.health * 1.3), "生命提高"));
    }
  }

  if (template.defaultCoins) {
    if ((/金币|星星|收集/.test(text) && /多|加/.test(text)) || /更多金币|更多星星/.test(text)) {
      const count = n ?? Math.max(8, (spec.levels[0]?.coinCount ?? 6) + 4);
      patches.push(patch("levels.coinCount", count, "收集物变多"));
      patches.push(patch("systems.coins", true, "打开收集"));
    }
    if (/金币|星星|收集/.test(text) && /少|减/.test(text)) {
      const count = n ?? Math.max(2, (spec.levels[0]?.coinCount ?? 6) - 3);
      patches.push(patch("levels.coinCount", count, "收集物变少"));
    }
  }

  if (template.objects.includes("Enemy") || template.objects.includes("Hazard")) {
    if (/敌人|怪物|障碍/.test(text) && /多|加/.test(text)) {
      patches.push(patch("levels.enemyCount", (spec.levels[0]?.enemyCount ?? 3) + (n ?? 2), "敌人变多"));
    }
    if (/敌人|怪物|障碍/.test(text) && /少|减|不要/.test(text)) {
      patches.push(patch("levels.enemyCount", Math.max(0, (spec.levels[0]?.enemyCount ?? 3) - (n ?? 2)), "敌人变少"));
    }
  }

  const customLevelTalk =
    spec.gameType === "paddle_ball" && /自定义|自己.*(摆|编|放)|编辑.*砖|砖.*位置|摆砖|关卡编辑/.test(text);

  if (/少一关|减少一关|去掉一关/.test(text)) {
    patches.push(patch("levels", null, "少一关", "remove"));
  } else if ((/只要|改成|做成|总共|一共|共/.test(text) || /改成\s*\d+\s*关/.test(text)) && n !== null && /关/.test(text) && n >= 1 && n <= 6) {
    const delta = n - spec.levels.length;
    if (delta > 0) {
      for (let i = 0; i < delta; i += 1) patches.push(patch("levels", null, "新增一关", "add"));
    }
    if (delta < 0) {
      for (let i = 0; i < -delta; i += 1) patches.push(patch("levels", null, "少一关", "remove"));
    }
  } else if (!customLevelTalk && /加一关|再加一关|增加一关|多一关|再来一关/.test(text)) {
    patches.push(patch("levels", null, "新增一关", "add"));
  } else if (!customLevelTalk && /增加关卡|加关卡|多几关|加.*关/.test(text)) {
    const addCount = n !== null && n >= 1 && n <= 5 ? n : Math.max(1, 3 - spec.levels.length);
    for (let i = 0; i < addCount; i += 1) patches.push(patch("levels", null, "新增一关", "add"));
  }

  if (template.defaultCoins || spec.gameType === "platformer" || spec.gameType === "rpg") {
    if (/商店/.test(text) && !/不要|去掉|关闭/.test(text)) {
      patches.push(patch("systems.shop", true, "打开商店"));
    }
    if (/商店/.test(text) && /不要|去掉|关闭/.test(text)) {
      patches.push(patch("systems.shop", false, "关闭商店"));
    }
  }

  if (template.defaultBoss && /boss|首领|魔王/i.test(text) && /不要|去掉|删除/.test(text)) {
    patches.push(patch("boss", null, "去掉 Boss"));
  } else if (template.defaultBoss && /boss|首领|魔王/i.test(text) && (/加|要|增加|来一个/.test(text) || /血|难|强/.test(text))) {
    const base = spec.boss ?? {
      name: "关底 Boss",
      health: 200,
      damage: 18,
      phases: 1,
      speed: 50,
    };
    if (/血|hp/i.test(text) && n !== null) base.health = n;
    if (/难|强|加倍|翻倍/.test(text)) {
      base.health = Math.round(base.health * (/加倍|翻倍/.test(text) ? 2 : 1.4));
      base.damage = Math.round(base.damage * 1.2);
    }
    patches.push(patch("boss", base, "调整 Boss"));
  }

  if (/中等|普通难度/.test(text)) patches.push(patch("difficulty", "medium", "难度改为中等"));
  if (/困难模式|最高难度/.test(text)) patches.push(patch("difficulty", "hard", "难度改为困难"));
  if (/简单模式/.test(text)) patches.push(patch("difficulty", "easy", "难度改为简单"));

  patches.push(...combatPatches(spec, text));
  patches.push(...extraRulePatches(spec, text));

  return patches;
}

function extraRulePatches(spec: GameSpec, text: string): GamePatch[] {
  if (spec.gameType !== "paddle_ball") return [];
  const learnedHit = learnedCapabilities.find((item) => {
    if (item.gameType !== spec.gameType) return false;
    const words = [item.label, item.say, item.giftLabel, ...item.nlu].filter(Boolean);
    return words.some((word) => word.length >= 1 && text.includes(word));
  });
  if (learnedHit && /加|要|增|掉落|奖励|礼物/.test(text)) {
    return [patch(`extras.${learnedHit.extrasKey}`, learnedHit.chance, learnedHit.label)];
  }
  if (/自定义|自己.*(摆|编|放)|编辑.*砖|砖.*位置|摆砖|关卡编辑/.test(text)) {
    const patches: GamePatch[] = [];
    const hasCustom = spec.levels.some((level) => level.custom);
    if (/增加|新增|再加|加一/.test(text) || !hasCustom) {
      patches.push(patch("levels", { custom: true, bricks: starterCustomBricks() }, "新增自定义关卡", "add"));
    }
    patches.push(patch("extras.editingBricks", true, "打开砖块编辑"));
    return patches;
  }
  if (/掉落|奖励|礼物/.test(text) && /打碎钢板|打钢板|破钢|钢板.*碎|碎.*钢板|可以打碎.*钢/.test(text)) {
    return [patch("extras.steelBreakDrop", 0.18, "打碎砖块掉落破钢奖励")];
  }
  if (/多一个|再来一个|多颗|分裂|分身|多球|multiball/i.test(text)) {
    const raw = percentIn(text) ?? numberIn(text);
    const chance = raw === null ? 0.35 : raw > 1 ? raw / 100 : raw;
    return [
      patch("extras.multiballChance", Number(chance.toFixed(2)), "打掉砖块有概率多一个球"),
      patch("extras.maxBalls", 6, "场上最多 6 个球"),
    ];
  }
  if (
    /颜色|彩色|多彩|几下|打\s*\d+\s*下|多次|多下|打不碎|钢板|钢砖|随机|摆放/.test(text) &&
    !(/掉落|奖励|礼物/.test(text) && /打碎|破钢/.test(text))
  ) {
    const patches: GamePatch[] = [
      patch("extras.coloredBricks", true, "后关彩色砖块"),
      patch("extras.multiHitBricks", true, "后关砖块要打多次"),
      patch("extras.randomBrickLayout", true, "后关砖块随机摆放"),
      patch("extras.unbreakableBricks", true, "后关混入打不碎的砖"),
      patch("extras.brickMaxHp", 3, "最硬的砖要打 3 下"),
      patch("extras.unbreakableChance", 0.14, "少量钢板砖"),
      patch("extras.fancyBricksFromLevel", 2, "从第二关开始变难"),
    ];
    if (/第二关|第三关|第\s*[2-3二三]\s*关/.test(text)) {
      for (let i = spec.levels.length; i < 3; i += 1) patches.unshift(patch("levels", null, "新增一关", "add"));
    }
    return patches;
  }
  if (/双挡|双板|第二.*挡|两块挡|两个挡/.test(text) && /掉落|奖励|礼物|加|要|增/.test(text)) {
    return [patch("extras.dualPaddleDrop", 0.18, "打碎砖块掉落双挡板")];
  }
  const dropTalk = /掉落|奖励|礼物|变长|加长|球速/.test(text);
  const clearTalk = /消失|清空|全消|全清|清屏|清场|所有砖|全部砖|炸弹/.test(text);
  const wideSlowTalk = /变长|加长|长板|挡板变长|滑板变长|球速|变慢|慢球/.test(text);
  if (dropTalk && (clearTalk || wideSlowTalk)) {
    const patches: GamePatch[] = [];
    if (clearTalk) {
      patches.push(patch("extras.clearBricksDrop", 0.16, "打碎砖块掉落清场奖励"));
    }
    if (wideSlowTalk || !clearTalk) {
      if (!clearTalk || /长|挡板|滑板/.test(text)) {
        patches.push(patch("extras.widePaddleDrop", 0.22, "打碎砖块掉落挡板变长"));
      }
      if (!clearTalk || /慢|球速/.test(text)) {
        patches.push(patch("extras.slowBallDrop", 0.22, "打碎砖块掉落球速变慢"));
      }
      if (!clearTalk) {
        patches.push(patch("extras.powerupDuration", 8000, "奖励持续 8 秒"));
      }
    }
    return patches;
  }
  return [];
}

function fallbackReply(spec: GameSpec) {
  const template = getTemplate(spec.gameType);
  return unsupportedReply(spec.gameType, template.title);
}

export function applyChat(spec: GameSpec, message: string): ChatResult {
  const text = message.trim();
  if (!text) {
    return { spec, patches: [], reply: "你想改这局游戏的哪一点？", handled: true };
  }

  const answered = answerQuestion(spec, text);
  if (answered) return { spec, patches: [], reply: answered, handled: true };

  const patches = scopePatches(spec, inferPatches(spec, text));
  if (!patches.length) {
    return { spec, patches: [], reply: fallbackReply(spec) };
  }

  const next = applyStructuredPatches(spec, patches);
  return {
    spec: next,
    patches,
    reply: replyFor(patches),
    handled: true,
  };
}

export function scopePatches(spec: GameSpec, patches: GamePatch[]) {
  return patches.filter((item) => {
    const target = item.target;
    if (spec.gameType === "paddle_ball" && target.startsWith("combat.")) return false;
    if (spec.gameType !== "shooter" && target.startsWith("combat.")) return false;
    if (spec.gameType !== "paddle_ball" && isPaddleOnlyTarget(target)) return false;
    if (!isAllowedTarget(spec.gameType, target)) return false;
    return true;
  });
}

function replyFor(patches: GamePatch[]) {
  if (patches.some((item) => item.target === "extras.editingBricks" || (item.target === "levels" && item.note.includes("自定义")))) {
    return "已加上自定义关卡。中间出现砖块编辑器：点格子摆砖，可选 1/2/3 下或钢板。摆好后点「完成编辑」就能玩这一关。";
  }
  if (patches.some((item) => /steelBreakDrop/i.test(item.target))) {
    return "预览已改：打碎砖块会掉破钢奖励，接到后一段时间内可以打碎钢板。";
  }
  if (patches.some((item) => /dualPaddleDrop/i.test(item.target))) {
    return "预览已改：打碎砖块会掉双挡板奖励，接到后场上出现第二块挡板。";
  }
  const clearDrop = patches.some((item) => /clearBricksDrop/i.test(item.target));
  const paddleDrop = patches.some((item) => /widePaddleDrop|slowBallDrop|powerupDuration|brickDrops/i.test(item.target));
  if (clearDrop && paddleDrop) {
    return "预览已改：打碎砖块会掉奖励，接到后挡板变长、球变慢，或所有砖块消失。";
  }
  if (clearDrop) {
    return "预览已改：打碎砖块会掉清场奖励，接到后所有砖块消失。";
  }
  if (paddleDrop) {
    return "预览已改：打碎砖块会掉奖励，接到后挡板变长或球速变慢。";
  }
  const brick = patches.some((item) => /brick|unbreakable|fancyBricks|coloredBricks|randomBrick/i.test(item.target));
  if (brick) {
    const added = patches.filter((item) => item.target === "levels" && item.operation === "add").length;
    return `预览已改：后关彩色砖要打多次，摆放更随机，并混入打不碎的钢板。${added ? `同时加了 ${added} 关。` : ""}`.trim();
  }
  return patches.map((item) => item.note).join("\n") || "已按你的要求改了预览。";
}
