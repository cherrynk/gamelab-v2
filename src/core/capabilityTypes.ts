import type { GameType } from "./spec";

export const PADDLE_EFFECTS = ["wide", "slow", "clear", "multiball", "narrow", "score", "haste", "dual", "pierce"] as const;
export type PaddleEffectId = (typeof PADDLE_EFFECTS)[number];

export type LearnedCapability = {
  id: string;
  gameType: GameType;
  label: string;
  say: string;
  extrasKey: string;
  kind: "drop";
  effect: PaddleEffectId;
  giftLabel: string;
  chance: number;
  nlu: string[];
  toast: string;
  color: number;
  createdAt: number;
  sourceMessage: string;
};

export type CapabilityJob = {
  id: string;
  at: number;
  gameType: GameType;
  gameId: string;
  message: string;
  status: "learned" | "blocked" | "failed" | "implementing" | "shipped";
  result?: {
    reply: string;
    extrasKey?: string;
    patches?: Array<{ operation?: string; target: string; value?: unknown; note?: string }>;
  };
  note: string;
  capabilityId?: string;
};
