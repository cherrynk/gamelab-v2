import type { LearnedCapability } from "./capabilityTypes";

export const learnedCapabilities: LearnedCapability[] = [
  {
    "id": "learn_mi61ojez",
    "gameType": "paddle_ball",
    "label": "挡板变短",
    "say": "掉落让挡板变短",
    "extrasKey": "narrowPaddleDrop",
    "kind": "drop",
    "effect": "narrow",
    "giftLabel": "短",
    "chance": 0.16,
    "nlu": [
      "变短",
      "缩短"
    ],
    "toast": "挡板变短了！",
    "color": 16724740,
    "createdAt": 1788928550583,
    "sourceMessage": "增加掉落奖励，接到后挡板变短"
  },
  {
    "id": "learn_hnr2aade",
    "gameType": "paddle_ball",
    "label": "穿透",
    "say": "掉落让球穿透砖块",
    "extrasKey": "pierceDrop",
    "kind": "drop",
    "effect": "pierce",
    "giftLabel": "穿",
    "chance": 0.14,
    "nlu": [
      "穿透",
      "打穿",
      "穿过"
    ],
    "toast": "球可以穿透砖块了！",
    "color": 16744192,
    "createdAt": 1788931377677,
    "sourceMessage": "增加掉落奖励 可以球可以穿透打碎路径上的砖块"
  }
];
