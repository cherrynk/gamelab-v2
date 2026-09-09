import { catalogPlaybook } from "./capabilities";
import type { GameType } from "./spec";

export type TemplateMeta = {
  id: GameType;
  title: string;
  emoji: string;
  blurb: string;
  howTo: string;
  camera: "side-scroll" | "top-down" | "fixed";
  objects: string[];
  samplePrompt: string;
  chatHints: string;
  defaultLevels: number;
  defaultBoss: boolean;
  defaultCoins: boolean;
  defaultHealth: boolean;
  styleHint?: "pixel_art" | "cartoon" | "anime" | "dark_fantasy" | "cyberpunk";
};

export const gameTemplates: TemplateMeta[] = [
  {
    id: "shooter",
    title: "射击",
    emoji: "🚀",
    blurb: "飞机、特种兵或坦克推进射击，小怪还击，每关一个 Boss。",
    howTo: "移动指针躲避，点一下或按住开火。可改成特种兵或坦克。清完一波打 Boss。",
    camera: "fixed",
    objects: ["Ship", "Enemy", "Boss", "Bullet", "Level"],
    samplePrompt: "做一个特种兵射击游戏，也可以换成坦克或飞机，三关，小怪会还击，每关打一个 Boss。",
    chatHints: "「把第一关变得简单一点」或「Boss 更难一点」",
    defaultLevels: 3,
    defaultBoss: true,
    defaultCoins: false,
    defaultHealth: true,
    styleHint: "cyberpunk",
  },
  {
    id: "paddle_ball",
    title: "弹球",
    emoji: "🏓",
    blurb: "挡板弹球消砖块。",
    howTo: "移动鼠标控制挡板，点击开始。可以说「增加自定义关卡」自己摆砖。打碎砖块会掉奖励，接到后挡板变长、球变慢，或所有砖块消失。第2关起：彩色砖要打多次，灰砖打不碎。",
    camera: "fixed",
    objects: ["Paddle", "Ball", "Brick", "Score"],
    samplePrompt: "做一个弹球消砖块游戏，鼠标控制挡板，打掉所有砖块。",
    chatHints: "「增加自定义关卡」或「掉落奖励让砖块全消」",
    defaultLevels: 1,
    defaultBoss: false,
    defaultCoins: false,
    defaultHealth: false,
  },
  {
    id: "platformer",
    title: "横版跳跃",
    emoji: "🏃",
    blurb: "侧视镜头，跳跃、平台、金币和 Boss。",
    howTo: "方向键 / WASD 移动，上或空格跳跃。从上方踩敌人。",
    camera: "side-scroll",
    objects: ["Player", "Enemy", "Platform", "Collectible", "Level", "Boss", "Health"],
    samplePrompt: "帮我做一个小骑士在森林里冒险的游戏，要有 3 个关卡，可以收集金币，最后打一个 Boss。",
    chatHints: "「把第一关变得简单一点」或「把主角换成机器人」",
    defaultLevels: 3,
    defaultBoss: true,
    defaultCoins: true,
    defaultHealth: true,
  },
  {
    id: "rpg",
    title: "俯视 RPG",
    emoji: "🗺️",
    blurb: "从上往下走路、捡物、遇敌，最后进 Boss 房间。",
    howTo: "WASD 或方向键移动。撞敌人互伤，走进色块出门或击败 Boss。",
    camera: "top-down",
    objects: ["Player", "Enemy", "NPC", "Item", "Level", "Boss", "Health"],
    samplePrompt: "做一个像素风俯视冒险：在城堡里找金币，避开守卫，第三关打 Boss。",
    chatHints: "「把第一关变得简单一点」或「把主角换成机器人」",
    defaultLevels: 3,
    defaultBoss: true,
    defaultCoins: true,
    defaultHealth: true,
    styleHint: "dark_fantasy",
  },
  {
    id: "tower",
    title: "塔防",
    emoji: "🏰",
    blurb: "沿路线放塔，挡住一波波敌人，最后一波是 Boss。",
    howTo: "点空地点炮塔。敌人沿路走，守住基地。",
    camera: "fixed",
    objects: ["Tower", "Enemy", "Path", "Wave", "Coin", "Boss"],
    samplePrompt: "做一个赛博朋克塔防，三条波次，点地图放炮塔，最后一波出 Boss。",
    chatHints: "「把第一关变得简单一点」或「敌人慢一点」",
    defaultLevels: 3,
    defaultBoss: true,
    defaultCoins: true,
    defaultHealth: true,
    styleHint: "cyberpunk",
  },
  {
    id: "star_catcher",
    title: "接星星",
    emoji: "⭐",
    blurb: "点击下落的星星得分。",
    howTo: "用鼠标或手指点星星。漏掉的会从底部消失。",
    camera: "fixed",
    objects: ["Star", "Score"],
    samplePrompt: "做一个接星星小游戏，星星从天上掉下来，点到就得分。",
    chatHints: "「再慢一点」或「换成像素风格」",
    defaultLevels: 1,
    defaultBoss: false,
    defaultCoins: true,
    defaultHealth: false,
    styleHint: "cyberpunk",
  },
  {
    id: "runner",
    title: "跑酷",
    emoji: "🏃‍♂️",
    blurb: "点击起跳越过障碍。",
    howTo: "点一下或按空格跳跃。撞到障碍后点一下重开。",
    camera: "side-scroll",
    objects: ["Player", "Hazard", "Score"],
    samplePrompt: "做一个跑酷游戏，点击跳跃躲开障碍，跑得越远越快。",
    chatHints: "「障碍慢一点」或「把主角换成机器人」",
    defaultLevels: 1,
    defaultBoss: false,
    defaultCoins: false,
    defaultHealth: true,
    styleHint: "pixel_art",
  },
  {
    id: "memory",
    title: "记忆翻牌",
    emoji: "🃏",
    blurb: "翻开两张相同的牌即可消除。",
    howTo: "点牌翻开。两张一样就留下，不一样会盖回去。全对即胜。",
    camera: "fixed",
    objects: ["Card", "Score"],
    samplePrompt: "做一个记忆翻牌游戏，八对牌，翻开两张相同的就能消掉。",
    chatHints: "「换成像素风格」或「换成卡通风格」",
    defaultLevels: 1,
    defaultBoss: false,
    defaultCoins: false,
    defaultHealth: false,
    styleHint: "cartoon",
  },
  {
    id: "merge",
    title: "合成",
    emoji: "🔢",
    blurb: "滑动合成相同数字，迷你 2048。",
    howTo: "滑动或用方向键。相同数字撞到一起会合成为两倍。",
    camera: "fixed",
    objects: ["Tile", "Score"],
    samplePrompt: "做一个 2048 合成游戏，滑动合并相同数字。",
    chatHints: "「换成赛博朋克风格」或「换成像素风格」",
    defaultLevels: 1,
    defaultBoss: false,
    defaultCoins: false,
    defaultHealth: false,
  },
  {
    id: "dodge",
    title: "躲避",
    emoji: "💥",
    blurb: "跟着指针躲开四面飞来的弹体。",
    howTo: "移动指针控制角色。被碰到就结束，点一下重开。",
    camera: "fixed",
    objects: ["Player", "Hazard", "Score"],
    samplePrompt: "做一个躲避游戏，跟着指针躲开从四面飞来的弹体。",
    chatHints: "「再慢一点」或「把主角换成机器人」",
    defaultLevels: 1,
    defaultBoss: false,
    defaultCoins: false,
    defaultHealth: true,
    styleHint: "cyberpunk",
  },
  {
    id: "tile_lab",
    title: "砖图",
    emoji: "🧱",
    blurb: "在 Tiled 地图里走路捡星星。",
    howTo: "方向键或 WASD 移动，也可按住画面拖去。墙和水挡住去路。捡完星星走进门口就过关。",
    camera: "top-down",
    objects: ["Player", "Tilemap", "Star", "Exit"],
    samplePrompt: "做一个砖图探险：在地图里走路捡星星，捡完走到门口过关。",
    chatHints: "「走快一点」或「换成赛博朋克风格」",
    defaultLevels: 1,
    defaultBoss: false,
    defaultCoins: true,
    defaultHealth: false,
    styleHint: "pixel_art",
  },
];

export function getTemplate(id: GameType) {
  return gameTemplates.find((item) => item.id === id) ?? gameTemplates[0];
}

export function llmPlaybook(id: GameType) {
  const template = getTemplate(id);
  if (id === "paddle_ball") return catalogPlaybook(id, template.title);
  const shared = `当前工作室打开的模板是「${template.title}」，gameType=${template.id}。
只改这一局这个模板，不要根据用户用词去猜成别的游戏。
用户说「掉落」就按本模板的掉落改，不要写成其他模板的武器或子弹。
共用路径：title, style(pixel_art|cartoon|anime|dark_fantasy|cyberpunk), difficulty(easy|medium|hard), levels 增删
加关卡：{"operation":"add","target":"levels","note":"新增一关"}
减关卡：{"operation":"remove","target":"levels","note":"少一关"}`;

  if (id === "shooter") {
    return `${shared}
本模板可改：combat.chassis(plane|soldier|tank)、combat.weapon / combat.weapons / combat.drops / combat.dropChance、boss
子弹 bullet: single | triple | spread | laser | homing | burst
掉落 kind: weapon | heal | coin | shield | speed
改特种兵：{"operation":"update","target":"combat.chassis","value":"soldier","note":"改成特种兵射击"}
怪物掉子弹：{"operation":"update","target":"combat.drops","value":[{"id":"drop_triple","name":"三连弹","kind":"weapon","weaponId":"triple","chance":0.32,"duration":10000}],"note":"怪物死后掉落三连弹"}`;
  }

  return `${shared}
本模板可改：player.*、world.theme、systems.*、rules.*、boss（如果这个模板有 Boss）、extras.*
不要写射击武器表或弹球挡板字段，除非当前模板就是那种游戏。`;
}
