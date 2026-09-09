import Phaser from "phaser";
import { addToken, preloadArt, tokenSize } from "@/art/tokens";
import { brickCellCenter } from "@/core/paddleGrid";
import type { BrickStamp } from "@/core/spec";
import type { PaddleEffectId } from "@/core/capabilityTypes";
import { extraCount, maxBalls, multiballChance, paddleBrickRules, paddleDropTable, paddlePowerups, readSpec, speedMul } from "../readSpec";

type Brick = (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image) & {
  alive: boolean;
  hp: number;
  maxHp: number;
  unbreakable: boolean;
  label?: Phaser.GameObjects.Text;
};

type Ball = (Phaser.GameObjects.Arc | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle) & {
  vx: number;
  vy: number;
};

type Gift = Phaser.GameObjects.Rectangle & {
  kind: PaddleEffectId;
  toast: string;
  label: Phaser.GameObjects.Text;
};

const HP_COLORS = [0x3ee0c5, 0xffd166, 0xff6b9d, 0xff8a5b];
const STEEL_COLOR = 0x8b95a8;

function startLevelIndex(spec: ReturnType<typeof readSpec>) {
  const total = Math.max(1, spec.levels?.length ?? 1);
  const raw = extraCount(spec, ["previewLevel", "startLevel"], 1);
  return Math.max(0, Math.min(total - 1, raw - 1));
}

export class PaddleBallScene extends Phaser.Scene {
  private paddle!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private extraPaddle?: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private gifts: Gift[] = [];
  private running = false;
  private won = false;
  private level = 0;
  private wideUntil = 0;
  private narrowUntil = 0;
  private dualUntil = 0;
  private pierceUntil = 0;
  private slowUntil = 0;
  private ballMul = 1;
  private hint!: Phaser.GameObjects.Text;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastAt = 0;

  constructor() {
    super("paddle-ball");
  }

  preload() {
    preloadArt(this);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.score = 0;
    this.level = startLevelIndex(readSpec(this));
    this.won = false;
    this.running = false;
    this.balls.forEach((ball) => ball.destroy());
    this.balls = [];
    this.clearGifts();
    this.wideUntil = 0;
    this.narrowUntil = 0;
    this.dualUntil = 0;
    this.pierceUntil = 0;
    this.slowUntil = 0;
    this.extraPaddle?.destroy();
    this.extraPaddle = undefined;
    this.ballMul = 1;

    this.add
      .text(24, 16, "弹球 · 鼠标移动挡板，点击开始", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#9aa3c7",
      })
      .setOrigin(0, 0);

    this.scoreText = this.add
      .text(24, 42, this.hudLine(), {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.hint = this.add
      .text(w / 2, h / 2 + 40, this.startHint(), {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#3ee0c5",
      })
      .setOrigin(0.5);

    this.toast = this.add
      .text(w / 2, 78, "", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.paddle = addToken(this, "paddle", w / 2, h - 36, this.paddleWidth(), 22, 0x7c5cff);
    this.spawnBall(w / 2, h - 58, this.ballSpeed(), -this.ballSpeed());
    this.scoreText.setText(this.hudLine());
    this.buildBricks();

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.paddle.x = Phaser.Math.Clamp(pointer.x, 60, w - 60);
      this.syncExtraPaddle();
      if (!this.running && this.balls[0]) this.balls[0].x = this.paddle.x;
    });

    this.input.on("pointerdown", () => {
      if (this.won) {
        this.scene.restart();
        return;
      }
      if (!this.running) {
        this.running = true;
        this.hint.setVisible(false);
      }
    });
  }

  update(_time: number, delta: number) {
    if (this.toastAt > 0) {
      this.toastAt = Math.max(0, this.toastAt - delta);
      this.toast.setAlpha(this.toastAt > 400 ? 1 : this.toastAt / 400);
    }
    this.tickPowerups(delta);

    if (!this.running) return;

    const w = this.scale.width;
    const h = this.scale.height;
    for (const ball of [...this.balls]) {
      ball.x += ball.vx;
      ball.y += ball.vy;
      const size = tokenSize(ball);

      if (ball.x < size.w / 2 || ball.x > w - size.w / 2) ball.vx *= -1;
      if (ball.y < size.h / 2) ball.vy *= -1;

      this.bounceOnPaddle(ball, this.paddle);
      if (this.extraPaddle && this.dualUntil > 0) this.bounceOnPaddle(ball, this.extraPaddle);

      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        const brickSize = tokenSize(brick);
        if (Math.abs(ball.x - brick.x) < brickSize.w / 2 + 8 && Math.abs(ball.y - brick.y) < brickSize.h / 2 + 8) {
          this.hitBrick(brick, ball);
          ball.vy *= -1;
          break;
        }
      }

      if (ball.y > h + 20) this.removeBall(ball);
    }

    this.tickGifts(h);

    if (this.breakableBricks().length && this.breakableBricks().every((brick) => !brick.alive)) {
      this.onLevelClear();
      return;
    }

    if (!this.balls.length) {
      this.running = false;
      this.spawnBall(this.paddle.x, h - 58, this.ballSpeed(), -this.ballSpeed());
      this.hint.setText("掉下去了，再点一次").setVisible(true);
      this.scoreText.setText(this.hudLine());
    }
  }

  private totalLevels() {
    return Math.max(1, readSpec(this).levels?.length ?? 1);
  }

  private paddleWidth() {
    const scale = this.wideUntil > 0 ? 1.6 : this.narrowUntil > 0 ? 0.62 : 1;
    return Math.max(56, 120 - this.level * 10) * scale;
  }

  private ballSpeed() {
    return (4 + this.level * 0.45) * speedMul(this) * this.ballMul;
  }

  private startHint() {
    if (this.totalLevels() <= 1) return "点击开始";
    return `第 ${this.level + 1} / ${this.totalLevels()} 关，点击开始`;
  }

  private hudLine() {
    const chance = multiballChance(readSpec(this));
    const extra = chance > 0 ? ` · 球 ${this.balls.length}` : "";
    const levels = this.totalLevels() > 1 ? `第 ${this.level + 1}/${this.totalLevels()} 关 · ` : "";
    const buffs = [
      this.wideUntil > 0 ? "长板" : "",
      this.narrowUntil > 0 ? "短板" : "",
      this.dualUntil > 0 ? "双板" : "",
      this.pierceUntil > 0 ? "破钢" : "",
      this.slowUntil > 0 ? "慢球" : "",
      this.ballMul > 1.05 ? "快球" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `${levels}得分 ${this.score}${extra}${buffs ? ` · ${buffs}` : ""}`;
  }

  private breakableBricks() {
    return this.bricks.filter((brick) => !brick.unbreakable);
  }

  private onLevelClear() {
    this.running = false;
    this.balls.forEach((ball) => ball.destroy());
    this.balls = [];
    if (this.level >= this.totalLevels() - 1) {
      this.won = true;
      this.clearGifts();
      this.hint.setText("通关了，点一下再来").setVisible(true);
      this.toast.setText("全部关卡打完了").setAlpha(1);
      this.toastAt = 1800;
      return;
    }
    this.level += 1;
    this.clearGifts();
    this.buildBricks();
    this.spawnBall(this.paddle.x, this.scale.height - 58, this.ballSpeed(), -this.ballSpeed());
    this.hint.setText(`第 ${this.level + 1} / ${this.totalLevels()} 关，点击开始`).setVisible(true);
    this.toast.setText(`进入第 ${this.level + 1} 关`).setAlpha(1);
    this.toastAt = 1400;
    this.scoreText.setText(this.hudLine());
  }

  private tickPowerups(delta: number) {
    if (this.slowUntil > 0) {
      this.slowUntil = Math.max(0, this.slowUntil - delta);
      if (this.slowUntil === 0) this.setBallMul(1);
    }
    if (this.wideUntil > 0) {
      this.wideUntil = Math.max(0, this.wideUntil - delta);
      if (this.wideUntil === 0) this.resizePaddle();
    }
    if (this.narrowUntil > 0) {
      this.narrowUntil = Math.max(0, this.narrowUntil - delta);
      if (this.narrowUntil === 0) this.resizePaddle();
    }
    if (this.dualUntil > 0) {
      this.dualUntil = Math.max(0, this.dualUntil - delta);
      if (this.dualUntil === 0) this.hideExtraPaddle();
    }
    if (this.pierceUntil > 0) this.pierceUntil = Math.max(0, this.pierceUntil - delta);
  }

  private tickGifts(h: number) {
    const paddle = tokenSize(this.paddle);
    for (const gift of [...this.gifts]) {
      gift.y += 2.4;
      gift.label.y = gift.y;
      if (
        gift.y + 10 >= this.paddle.y - paddle.h / 2 &&
        gift.y < this.paddle.y + paddle.h / 2 &&
        Math.abs(gift.x - this.paddle.x) < paddle.w / 2 + 16
      ) {
        this.collectGift(gift);
        continue;
      }
      if (gift.y > h + 20) this.removeGift(gift);
    }
  }

  private maybeDrop(brick: Brick) {
    const pool = paddleDropTable(readSpec(this)).filter((item) => Math.random() < item.chance);
    if (!pool.length) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    this.spawnGift(brick.x, brick.y + 18, picked.effect, picked.label, picked.color, picked.toast);
  }

  private spawnGift(x: number, y: number, kind: PaddleEffectId, label: string, color: number, toast: string) {
    const gift = this.add.rectangle(x, y, 38, 18, color) as Gift;
    gift.kind = kind;
    gift.toast = toast;
    gift.label = this.add
      .text(x, y, label, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setStroke("#0b0d18", 3);
    this.gifts.push(gift);
  }

  private collectGift(gift: Gift) {
    const duration = paddlePowerups(readSpec(this)).duration;
    if (gift.kind === "wide") {
      this.wideUntil = duration;
      this.narrowUntil = 0;
      this.resizePaddle();
    } else if (gift.kind === "narrow") {
      this.narrowUntil = duration;
      this.wideUntil = 0;
      this.resizePaddle();
    } else if (gift.kind === "slow") {
      this.slowUntil = duration;
      this.setBallMul(0.62);
    } else if (gift.kind === "haste") {
      this.slowUntil = 0;
      this.setBallMul(1.35);
      this.time.delayedCall(duration, () => {
        if (this.ballMul > 1) this.setBallMul(1);
      });
    } else if (gift.kind === "clear") {
      this.clearAllBricks();
    } else if (gift.kind === "multiball") {
      if (this.balls.length < maxBalls(readSpec(this))) {
        this.spawnBall(this.paddle.x, this.scale.height - 58, (Math.random() > 0.5 ? 1 : -1) * 3.6, -3.8);
      }
    } else if (gift.kind === "score") {
      this.score += 80;
    } else if (gift.kind === "dual") {
      this.dualUntil = duration;
      this.showExtraPaddle();
    } else if (gift.kind === "pierce") {
      this.pierceUntil = duration;
    }
    this.toast.setText(gift.toast).setAlpha(1);
    this.toastAt = 1400;
    this.scoreText.setText(this.hudLine());
    this.removeGift(gift);
  }

  private clearAllBricks() {
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (!brick.unbreakable) this.score += 10;
      brick.alive = false;
      brick.setVisible(false);
      brick.label?.destroy();
      brick.label = undefined;
    }
  }

  private setBallMul(next: number) {
    const ratio = next / this.ballMul;
    this.balls.forEach((ball) => {
      ball.vx *= ratio;
      ball.vy *= ratio;
    });
    this.ballMul = next;
  }

  private bounceOnPaddle(ball: Ball, paddle: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc) {
    const size = tokenSize(ball);
    const pad = tokenSize(paddle);
    if (
      ball.vy > 0 &&
      ball.y + size.h / 2 >= paddle.y - pad.h / 2 &&
      ball.y < paddle.y + pad.h / 2 &&
      Math.abs(ball.x - paddle.x) < pad.w / 2 + 10
    ) {
      ball.vy = -Math.abs(ball.vy);
      ball.vx += (ball.x - paddle.x) * 0.08;
      const cap = (7 + this.level) * this.ballMul;
      ball.vx = Phaser.Math.Clamp(ball.vx, -cap, cap);
    }
  }

  private syncExtraPaddle() {
    if (!this.extraPaddle || this.dualUntil <= 0) return;
    const gap = this.paddleWidth() + 28;
    this.extraPaddle.x = Phaser.Math.Clamp(this.paddle.x - gap, 60, this.scale.width - 60);
    this.extraPaddle.y = this.paddle.y;
  }

  private showExtraPaddle() {
    const w = this.paddleWidth();
    if (!this.extraPaddle) {
      this.extraPaddle = addToken(this, "paddle", this.paddle.x, this.paddle.y, w, 22, 0xc9a0ff);
    }
    this.extraPaddle.setVisible(true);
    this.syncExtraPaddle();
    this.resizePaddle();
  }

  private hideExtraPaddle() {
    this.extraPaddle?.setVisible(false);
  }

  private resizePaddle() {
    const w = this.paddleWidth();
    const apply = (item: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc) => {
      const paddle = item as Phaser.GameObjects.Rectangle & Phaser.GameObjects.Image;
      if (typeof paddle.setDisplaySize === "function") paddle.setDisplaySize(w, 22);
      else if (typeof paddle.setSize === "function") paddle.setSize(w, 22);
    };
    apply(this.paddle);
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, w / 2 + 8, this.scale.width - w / 2 - 8);
    if (this.extraPaddle && this.dualUntil > 0) {
      apply(this.extraPaddle);
      this.syncExtraPaddle();
    }
  }

  private removeGift(gift: Gift) {
    const index = this.gifts.indexOf(gift);
    if (index >= 0) this.gifts.splice(index, 1);
    gift.label.destroy();
    gift.destroy();
  }

  private clearGifts() {
    this.gifts.forEach((gift) => {
      gift.label.destroy();
      gift.destroy();
    });
    this.gifts = [];
  }

  private maybeSplit(from: Ball, brick: Brick) {
    const spec = readSpec(this);
    const chance = multiballChance(spec);
    if (chance <= 0 || Math.random() > chance) return;
    if (this.balls.length >= maxBalls(spec)) return;
    const dir = from.vx === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(from.vx) * -1;
    this.spawnBall(brick.x, brick.y + 36, dir * (3.4 + Math.random() * 1.4), 3.8);
    this.toast.setText("多了一个球！").setAlpha(1);
    this.toastAt = 1400;
    this.scoreText.setText(this.hudLine());
  }

  private spawnBall(x: number, y: number, vx: number, vy: number) {
    const ball = addToken(this, "ball", x, y, 22, 22, this.balls.length ? 0xffd166 : 0x3ee0c5) as Ball;
    ball.vx = vx;
    ball.vy = vy;
    this.balls.push(ball);
  }

  private removeBall(ball: Ball) {
    const index = this.balls.indexOf(ball);
    if (index >= 0) this.balls.splice(index, 1);
    ball.destroy();
  }

  private hitBrick(brick: Brick, ball: Ball) {
    if (brick.unbreakable && this.pierceUntil <= 0) {
      this.flash(brick);
      return;
    }
    if (brick.unbreakable && this.pierceUntil > 0) {
      brick.unbreakable = false;
      brick.hp = 1;
      brick.maxHp = 1;
    }
    brick.hp -= 1;
    this.score += 10;
    if (brick.hp <= 0) {
      brick.alive = false;
      brick.setVisible(false);
      brick.label?.destroy();
      brick.label = undefined;
      this.maybeSplit(ball, brick);
      this.maybeDrop(brick);
      this.scoreText.setText(this.hudLine());
      return;
    }
    this.paintBrick(brick);
    this.flash(brick);
    this.scoreText.setText(this.hudLine());
  }

  private flash(brick: Brick) {
    brick.setAlpha(0.35);
    this.time.delayedCall(80, () => {
      if (brick.alive) brick.setAlpha(brick.unbreakable ? 1 : 0.55 + 0.45 * (brick.hp / brick.maxHp));
    });
  }

  private colorFor(brick: Brick) {
    if (brick.unbreakable) return STEEL_COLOR;
    return HP_COLORS[Math.max(0, Math.min(HP_COLORS.length, brick.hp) - 1)];
  }

  private paintBrick(brick: Brick) {
    const color = this.colorFor(brick);
    if ("setFillStyle" in brick && typeof brick.setFillStyle === "function") {
      brick.setFillStyle(color);
    } else if ("setTint" in brick && typeof brick.setTint === "function") {
      brick.setTint(color);
    }
    brick.setAlpha(brick.unbreakable ? 1 : 0.55 + 0.45 * (brick.hp / brick.maxHp));
    if (brick.label) {
      brick.label.setText(brick.unbreakable ? "×" : brick.hp > 1 ? String(brick.hp) : "");
    }
  }

  private buildBricks() {
    this.bricks.forEach((brick) => {
      brick.label?.destroy();
      brick.destroy();
    });
    this.bricks = [];

    const spec = readSpec(this);
    const custom = spec.levels[this.level];
    if (custom?.custom || custom?.bricks?.length) {
      this.buildFromStamps(custom.bricks ?? []);
      return;
    }

    const rules = paddleBrickRules(spec, this.level);
    const rows = Math.min(7, 4 + this.level);
    const cols = 8;
    const gapChance = rules.randomLayout ? 0.12 + this.level * 0.05 : 0;
    let breakable = 0;

    for (let row = 0; row < rows; row += 1) {
      const stagger = rules.randomLayout && row % 2 === 1 ? 45 : 0;
      for (let col = 0; col < cols; col += 1) {
        if (rules.randomLayout && Math.random() < gapChance) continue;
        const x = 70 + col * 90 + stagger + (rules.randomLayout ? (Math.random() - 0.5) * 10 : 0);
        const y = 88 + row * 30;
        const steel = rules.unbreakable && Math.random() < rules.unbreakableChance;
        const hp = steel ? 99 : rules.multiHit ? 1 + Math.floor(Math.random() * rules.maxHp) : 1;
        const color = steel ? STEEL_COLOR : rules.colored ? HP_COLORS[hp - 1] ?? HP_COLORS[0] : HP_COLORS[row % HP_COLORS.length];
        const brick = this.add.rectangle(x, y, steel ? 76 : 80, steel ? 18 : 20, color) as Brick;
        if (steel) (brick as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xe8edf7);
        brick.alive = true;
        brick.unbreakable = steel;
        brick.hp = hp;
        brick.maxHp = hp;
        brick.label = this.add
          .text(x, y, steel ? "×" : hp > 1 ? String(hp) : "", {
            fontFamily: "sans-serif",
            fontSize: "14px",
            color: "#ffffff",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setStroke("#0b0d18", 3);
        this.paintBrick(brick);
        this.bricks.push(brick);
        if (!steel) breakable += 1;
      }
    }

    if (!breakable && this.bricks.length) {
      const first = this.bricks[0];
      first.unbreakable = false;
      first.hp = 1;
      first.maxHp = 1;
      this.paintBrick(first);
    }
  }

  private buildFromStamps(stamps: BrickStamp[]) {
    if (!stamps.length) {
      this.hint.setText("这关还没摆砖，点左侧「编辑砖块」").setVisible(true);
      return;
    }
    for (const stamp of stamps) {
      const steel = Boolean(stamp.steel);
      const hp = steel ? 99 : Math.max(1, stamp.hp ?? 1);
      const { x, y } = brickCellCenter(stamp.col, stamp.row);
      const color = steel ? STEEL_COLOR : HP_COLORS[Math.min(HP_COLORS.length, hp) - 1];
      const brick = this.add.rectangle(x, y, steel ? 76 : 80, steel ? 18 : 20, color) as Brick;
      if (steel) (brick as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xe8edf7);
      brick.alive = true;
      brick.unbreakable = steel;
      brick.hp = hp;
      brick.maxHp = hp;
      brick.label = this.add
        .text(x, y, steel ? "×" : hp > 1 ? String(hp) : "", {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setStroke("#0b0d18", 3);
      this.paintBrick(brick);
      this.bricks.push(brick);
    }
  }
}
