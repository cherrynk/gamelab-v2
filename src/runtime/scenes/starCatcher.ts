import Phaser from "phaser";
import { addToken, preloadArt } from "@/art/tokens";
import { speedMul } from "../readSpec";

type Star = (Phaser.GameObjects.Arc | Phaser.GameObjects.Image) & {
  vx: number;
  vy: number;
};

export class StarCatcherScene extends Phaser.Scene {
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private stars: Star[] = [];
  private spawnAt = 0;

  constructor() {
    super("star-catcher");
  }

  preload() {
    preloadArt(this);
  }

  create() {
    this.score = 0;
    this.stars = [];
    this.spawnAt = 0;

    this.add
      .text(24, 18, "接星星 · 点击下落的星星得分", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#9aa3c7",
      })
      .setOrigin(0, 0);

    this.scoreText = this.add
      .text(24, 44, "得分 0", {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.input.on("gameobjectdown", (_pointer: Phaser.Input.Pointer, obj: Star) => {
      this.collect(obj);
    });
  }

  update(_time: number, delta: number) {
    this.spawnAt += delta;
    if (this.spawnAt > 420 / speedMul(this)) {
      this.spawnAt = 0;
      this.spawnStar();
    }

    const h = this.scale.height;
    for (const star of [...this.stars]) {
      star.x += star.vx * (delta / 16);
      star.y += star.vy * (delta / 16);
      star.rotation += 0.04;
      if (star.y > h + 20) this.drop(star);
    }
  }

  private spawnStar() {
    const x = 40 + Math.random() * (this.scale.width - 80);
    const r = 10 + Math.random() * 10;
    const star = addToken(this, "star", x, -20, r * 2, r * 2, 0xffd166) as Star;
    if ("setStrokeStyle" in star) star.setStrokeStyle(2, 0xfff3c4);
    star.setInteractive({ useHandCursor: true });
    star.vx = (Math.random() - 0.5) * 1.6;
    star.vy = (2.2 + Math.random() * 1.8) * speedMul(this);
    this.stars.push(star);
  }

  private collect(star: Star) {
    this.score += 1;
    this.scoreText.setText(`得分 ${this.score}`);
    this.tweens.add({
      targets: star,
      scale: 0,
      alpha: 0,
      duration: 140,
      onComplete: () => this.drop(star),
    });
  }

  private drop(star: Star) {
    this.stars = this.stars.filter((item) => item !== star);
    star.destroy();
  }
}
