import Phaser from "phaser";
import type { GameSpec, LevelSpec } from "@/core/spec";
import { addActor, hudStyle, overlaps, playerColor, playerSize, scaled } from "../sdk";
import { rng } from "../seed";

type Actor = Phaser.GameObjects.Rectangle & {
  vx?: number;
  hp?: number;
  damage?: number;
  kind?: "enemy" | "boss" | "coin" | "flag";
};

export class PlatformerScene extends Phaser.Scene {
  private spec!: GameSpec;
  private levelIndex = 0;
  private player!: Phaser.GameObjects.Rectangle;
  private platforms: Phaser.GameObjects.Rectangle[] = [];
  private actors: Actor[] = [];
  private vx = 0;
  private vy = 0;
  private grounded = false;
  private hp = 100;
  private coins = 0;
  private hurtUntil = 0;
  private shopOpen = false;
  private over = false;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("platformer");
  }

  create() {
    this.spec = this.registry.get("spec") as GameSpec;
    this.hp = this.spec.player.health;
    this.coins = 0;
    this.levelIndex = 0;
    this.over = false;
    this.shopOpen = false;
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.wasd;
    this.hud = this.add
      .text(16, 12, "", { ...hudStyle(this.spec), fontSize: "16px" })
      .setScrollFactor(0)
      .setDepth(50);
    this.banner = this.add
      .text(480, 220, "", { ...hudStyle(this.spec), fontSize: "22px", align: "center" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);
    this.input.keyboard?.on("keydown-SPACE", () => this.useShopOrJump());
    this.input.on("pointerdown", () => this.useShopOrJump());
    this.buildLevel();
  }

  private currentLevel(): LevelSpec {
    return this.spec.levels[this.levelIndex] ?? this.spec.levels[0];
  }

  private buildLevel() {
    this.platforms.forEach((item) => item.destroy());
    this.actors.forEach((item) => item.destroy());
    this.platforms = [];
    this.actors = [];
    this.vx = 0;
    this.vy = 0;
    this.shopOpen = false;
    this.banner.setText("");

    const level = this.currentLevel();
    const c = this.spec.style.colors;
    const worldW = level.width;
    const h = this.scale.height;
    const rand = rng(`${this.spec.id}-${level.id}`);

    this.add.rectangle(worldW / 2, h / 2, worldW, h, c.bg).setDepth(-20);
    for (let i = 0; i < 8; i += 1) {
      const tree = this.add.rectangle(80 + i * (worldW / 8), 210 + (i % 2) * 20, 18, 90, c.platform);
      tree.setAlpha(0.35);
    }

    const ground = this.add.rectangle(worldW / 2, h - 28, worldW, 56, c.ground);
    this.platforms.push(ground);

    const plats = 5 + this.levelIndex;
    for (let i = 0; i < plats; i += 1) {
      const x = 180 + i * ((worldW - 240) / plats) + rand() * 40;
      const y = 180 + rand() * 220;
      this.platforms.push(this.add.rectangle(x, y, 140 + rand() * 40, 18, c.platform));
    }

    const size = playerSize(this.spec);
    this.player = addActor(this, 70, h - 70, size.w, size.h, playerColor(this.spec));
    this.player.setDepth(10);

    if (this.spec.systems.coins) {
      for (let i = 0; i < level.coinCount; i += 1) {
        const platform = this.platforms[1 + (i % Math.max(1, this.platforms.length - 1))];
        const coin = addActor(this, platform.x + (i % 3) * 24 - 24, platform.y - 28, 14, 14, c.coin) as Actor;
        coin.kind = "coin";
        this.actors.push(coin);
      }
    }

    const enemy = this.spec.enemies[0];
    for (let i = 0; i < level.enemyCount; i += 1) {
      const platform = this.platforms[1 + (i % Math.max(1, this.platforms.length - 1))];
      const body = addActor(this, platform.x, platform.y - 22, 24, 24, c.enemy) as Actor;
      body.kind = "enemy";
      body.vx = (i % 2 === 0 ? 1 : -1) * scaled(this.spec, enemy?.speed ?? 40, "speed") * 0.02;
      body.hp = enemy?.health ?? 20;
      body.damage = scaled(this.spec, enemy?.damage ?? 10, "damage");
      this.actors.push(body);
    }

    if (level.hasBoss && this.spec.boss) {
      const boss = addActor(this, worldW - 140, h - 80, 54, 64, c.boss, this.spec.boss.name) as Actor;
      boss.kind = "boss";
      boss.vx = 0.7;
      boss.hp = this.spec.boss.health;
      boss.damage = scaled(this.spec, this.spec.boss.damage, "damage");
      this.actors.push(boss);
    } else {
      const flag = addActor(this, worldW - 60, h - 86, 16, 56, c.accent) as Actor;
      flag.kind = "flag";
      this.actors.push(flag);
    }

    this.cameras.main.setBounds(0, 0, worldW, h);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  private useShopOrJump() {
    if (this.over) {
      this.scene.restart();
      return;
    }
    if (this.shopOpen) {
      if (this.coins >= 5) {
        this.coins -= 5;
        this.hp = Math.min(this.spec.player.health, this.hp + 30);
      }
      this.shopOpen = false;
      this.levelIndex += 1;
      if (this.levelIndex >= this.spec.levels.length) {
        this.win();
        return;
      }
      this.buildLevel();
      return;
    }
    if (this.grounded) this.vy = -this.spec.player.jump / 60;
  }

  private win() {
    this.over = true;
    this.banner.setText("通关了。点一下再玩一局。");
  }

  private fail() {
    this.over = true;
    this.banner.setText("被打倒了。点一下重来。");
  }

  update() {
    if (this.over || this.shopOpen) return;
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const jump = this.cursors.up.isDown || this.wasd.W.isDown;
    const speed = this.spec.player.speed / 60;
    this.vx = left ? -speed : right ? speed : 0;
    if (jump && this.grounded) this.vy = -this.spec.player.jump / 60;

    this.vy += 0.55;
    this.player.x += this.vx;
    this.player.y += this.vy;
    this.grounded = false;

    const p = { x: this.player.x, y: this.player.y, w: this.player.width, h: this.player.height };
    for (const platform of this.platforms) {
      const box = { x: platform.x, y: platform.y, w: platform.width, h: platform.height };
      if (overlaps(p, box) && this.vy >= 0 && this.player.y < platform.y) {
        this.player.y = platform.y - platform.height / 2 - this.player.height / 2;
        this.vy = 0;
        this.grounded = true;
      }
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 20, this.currentLevel().width - 20);
    if (this.player.y > this.scale.height + 40) this.fail();

    for (const actor of [...this.actors]) {
      if (actor.kind === "enemy" || actor.kind === "boss") {
        actor.x += actor.vx ?? 0;
        if (actor.x < 40 || actor.x > this.currentLevel().width - 40) actor.vx = -(actor.vx ?? 0);
      }
      if (!overlaps(p, { x: actor.x, y: actor.y, w: actor.width, h: actor.height })) continue;
      if (actor.kind === "coin") {
        this.coins += this.spec.rules.coinValue;
        actor.destroy();
        this.actors = this.actors.filter((item) => item !== actor);
      } else if (actor.kind === "flag") {
        this.completeLevel();
      } else if ((actor.kind === "enemy" || actor.kind === "boss") && this.time.now > this.hurtUntil) {
        if (this.vy > 0 && this.player.y < actor.y) {
          actor.hp = (actor.hp ?? 1) - 20;
          this.vy = -8;
          if ((actor.hp ?? 0) <= 0) {
            if (actor.kind === "boss") {
              actor.destroy();
              this.actors = this.actors.filter((item) => item !== actor);
              this.completeLevel();
            } else {
              actor.destroy();
              this.actors = this.actors.filter((item) => item !== actor);
            }
          }
        } else {
          this.hp -= actor.damage ?? 10;
          this.hurtUntil = this.time.now + 700;
          this.player.setAlpha(0.5);
          this.time.delayedCall(180, () => this.player.setAlpha(1));
          if (this.hp <= 0) this.fail();
        }
      }
    }

    const level = this.currentLevel();
    this.hud.setText(
      `${this.spec.title}  ·  ${level.name}\n${this.spec.player.name}  HP ${Math.max(0, Math.round(this.hp))}   金币 ${this.coins}`,
    );
  }

  private completeLevel() {
    if (this.spec.systems.shop && this.levelIndex < this.spec.levels.length - 1) {
      this.shopOpen = true;
      this.banner.setText("商店开了。花 5 金币回 30 血，再点一下进入下一关。");
      return;
    }
    this.levelIndex += 1;
    if (this.levelIndex >= this.spec.levels.length) {
      this.win();
      return;
    }
    this.buildLevel();
  }
}
