import Phaser from "phaser";
import { addToken, preloadArt, tokenSize } from "@/art/tokens";
import { readSpec, speedMul } from "../readSpec";

type Obstacle = (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image) & {
  scored: boolean;
};

export class RunnerScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private obstacles: Obstacle[] = [];
  private vy = 0;
  private grounded = true;
  private spawnAt = 0;
  private score = 0;
  private speed = 5;
  private over = false;
  private scoreText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private groundY = 0;

  constructor() {
    super("runner");
  }

  preload() {
    preloadArt(this);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.groundY = h - 56;
    this.vy = 0;
    this.grounded = true;
    this.spawnAt = 0;
    this.score = 0;
    this.speed = 5;
    this.over = false;
    this.obstacles = [];

    this.add.rectangle(w / 2, h - 24, w, 48, 0x1c2133);
    this.add
      .text(24, 16, "跑酷 · 点击或空格跳跃", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#9aa3c7",
      })
      .setOrigin(0, 0);
    this.scoreText = this.add
      .text(24, 42, "得分 0", {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.hint = this.add
      .text(w / 2, h / 2, "", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#3ee0c5",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.player = addToken(this, "hero", 110, this.groundY - 20, 36, 44, 0x7c5cff);

    this.input.on("pointerdown", () => this.jumpOrRestart());
    this.input.keyboard?.on("keydown-SPACE", () => this.jumpOrRestart());
  }

  update(_time: number, delta: number) {
    if (this.over) return;
    const step = delta / 16;

    this.vy += 0.55 * step;
    this.player.y += this.vy * step;
    if (this.player.y >= this.groundY - 20) {
      this.player.y = this.groundY - 20;
      this.vy = 0;
      this.grounded = true;
    }

    this.spawnAt += delta;
    const gap = Math.max(720, 1280 - this.score * 18);
    if (this.spawnAt > gap) {
      this.spawnAt = 0;
      this.spawnObstacle();
    }

    this.speed = (5 + this.score * 0.08) * speedMul(this);
    for (const block of [...this.obstacles]) {
      block.x -= this.speed * step;
      if (!block.scored && block.x < this.player.x - 30) {
        block.scored = true;
        this.score += 1;
        this.scoreText.setText(`得分 ${this.score}`);
      }
      if (block.x < -40) {
        this.obstacles = this.obstacles.filter((item) => item !== block);
        block.destroy();
      }
      const a = tokenSize(block);
      const b = tokenSize(this.player);
      if (
        Math.abs(block.x - this.player.x) < (a.w + b.w) / 2 - 6 &&
        Math.abs(block.y - this.player.y) < (a.h + b.h) / 2 - 6
      ) {
        this.fail();
      }
    }
  }

  private jumpOrRestart() {
    if (this.over) {
      this.scene.restart();
      return;
    }
    if (!this.grounded) return;
    this.grounded = false;
    this.vy = -11.2 * (readSpec(this).player.jump / 420);
  }

  private spawnObstacle() {
    const h = 28 + Math.random() * 46;
    const block = addToken(
      this,
      "hazard",
      this.scale.width + 30,
      this.groundY - h / 2,
      28 + Math.random() * 10,
      h,
      0xff6b9d,
    ) as Obstacle;
    block.scored = false;
    this.obstacles.push(block);
  }

  private fail() {
    this.over = true;
    this.hint.setText("撞到了，点一下重开").setVisible(true);
  }
}
