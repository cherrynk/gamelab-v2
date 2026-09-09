import type { Scene } from "phaser";
import type { GameSpec, GameType } from "@/core/spec";
import { DodgeScene } from "./scenes/dodge";
import { MemoryScene } from "./scenes/memory";
import { MergeScene } from "./scenes/merge";
import { PaddleBallScene } from "./scenes/paddleBall";
import { PlatformerScene } from "./scenes/platformer";
import { RpgScene } from "./scenes/rpg";
import { RunnerScene } from "./scenes/runner";
import { ShooterScene } from "./scenes/shooter";
import { StarCatcherScene } from "./scenes/starCatcher";
import { TileLabScene } from "./scenes/tileLab";
import { TowerScene } from "./scenes/tower";

const scenes: Record<GameType, new () => Scene> = {
  platformer: PlatformerScene,
  rpg: RpgScene,
  tower: TowerScene,
  star_catcher: StarCatcherScene,
  paddle_ball: PaddleBallScene,
  runner: RunnerScene,
  shooter: ShooterScene,
  memory: MemoryScene,
  merge: MergeScene,
  dodge: DodgeScene,
  tile_lab: TileLabScene,
};

export function sceneFor(spec: GameSpec) {
  return scenes[spec.gameType] ?? PlatformerScene;
}
