import Phaser from "phaser";
import { addToken, preloadArt } from "@/art/tokens";
import { speedMul } from "../readSpec";

type Bolt = (Phaser.GameObjects.Arc | Phaser.GameObjects.Image) & {
  vx: number;
  vy: number;
};

export class DodgeScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private bolts: Bolt[] = [];
  private spawnAt = 0;
  private lived = 0;
  private over = false;
  private scoreText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super("dodge");
  }

  preload() {
    preloadArt(this);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.bolts = [];
    this.spawnAt = 0;
    this.lived = 0;
    this.over = false;

    this.add
      .text(24, 16, "躲避 · 跟着指针躲开弹体", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#9aa3c7",
      })
      .setOrigin(0, 0);
    this.scoreText = this.add
      .text(24, 42, "存活 0.0 秒", {
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

    this.player = addToken(this, "hero", w / 2, h / 2, 32, 32, 0x3ee0c5);
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.over) return;
      this.player.x = Phaser.Math.Clamp(pointer.x, 16, w - 16);
      this.player.y = Phaser.Math.Clamp(pointer.y, 70, h - 16);
    });
    this.input.on("pointerdown", () => {
      if (this.over) this.scene.restart();
    });
  }

  update(_time: number, delta: number) {
    if (this.over) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const step = delta / 16;
    this.lived += delta;
    this.scoreText.setText(`存活 ${(this.lived / 1000).toFixed(1)} 秒`);

    this.spawnAt += delta;
    if (this.spawnAt > Math.max(260, 720 - this.lived / 40)) {
      this.spawnAt = 0;
      this.spawnBolt();
    }

    for (const bolt of [...this.bolts]) {
      bolt.x += bolt.vx * step;
      bolt.y += bolt.vy * step;
      if (bolt.x < -30 || bolt.x > w + 30 || bolt.y < -30 || bolt.y > h + 30) {
        this.bolts = this.bolts.filter((item) => item !== bolt);
        bolt.destroy();
        continue;
      }
      if (Phaser.Math.Distance.Between(bolt.x, bolt.y, this.player.x, this.player.y) < 20) {
        this.over = true;
        this.hint.setText("碰到了，点一下重开").setVisible(true);
      }
    }
  }

  private spawnBolt() {
    const w = this.scale.width;
    const h = this.scale.height;
    const side = Math.floor(Math.random() * 4);
    const speed = (3.2 + Math.random() * 2.2 + this.lived / 18000) * speedMul(this);
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    if (side === 0) {
      x = Math.random() * w;
      y = -12;
      vx = (Math.random() - 0.5) * 2;
      vy = speed;
    } else if (side === 1) {
      x = Math.random() * w;
      y = h + 12;
      vx = (Math.random() - 0.5) * 2;
      vy = -speed;
    } else if (side === 2) {
      x = -12;
      y = 80 + Math.random() * (h - 80);
      vx = speed;
      vy = (Math.random() - 0.5) * 2;
    } else {
      x = w + 12;
      y = 80 + Math.random() * (h - 80);
      vx = -speed;
      vy = (Math.random() - 0.5) * 2;
    }
    const bolt = addToken(this, "hazard", x, y, 18, 18, 0xff6b9d) as Bolt;
    bolt.vx = vx;
    bolt.vy = vy;
    this.bolts.push(bolt);
  }
}
