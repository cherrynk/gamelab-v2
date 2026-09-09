import Phaser from "phaser";
import type { GameSpec } from "@/core/spec";
import { addActor, hudStyle, overlaps, playerColor, playerSize, scaled } from "../sdk";
import { rng } from "../seed";

type Actor = Phaser.GameObjects.Rectangle & {
  kind?: "enemy" | "boss" | "coin" | "exit";
  hp?: number;
  damage?: number;
};

export class RpgScene extends Phaser.Scene {
  private spec!: GameSpec;
  private levelIndex = 0;
  private player!: Phaser.GameObjects.Rectangle;
  private walls: Phaser.GameObjects.Rectangle[] = [];
  private actors: Actor[] = [];
  private hp = 100;
  private coins = 0;
  private hurtUntil = 0;
  private over = false;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("rpg");
  }

  create() {
    this.spec = this.registry.get("spec") as GameSpec;
    this.hp = this.spec.player.health;
    this.coins = 0;
    this.over = false;
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.wasd;
    this.hud = this.add.text(16, 12, "", { ...hudStyle(this.spec), fontSize: "16px" }).setDepth(50);
    this.banner = this.add
      .text(480, 260, "", { ...hudStyle(this.spec), fontSize: "22px" })
      .setOrigin(0.5)
      .setDepth(50);
    this.input.on("pointerdown", () => {
      if (this.over) this.scene.restart();
    });
    this.buildLevel();
  }

  private buildLevel() {
    this.walls.forEach((item) => item.destroy());
    this.actors.forEach((item) => item.destroy());
    this.walls = [];
    this.actors = [];
    this.banner.setText("");

    const level = this.spec.levels[this.levelIndex];
    const c = this.spec.style.colors;
    const rand = rng(`${this.spec.id}-${level.id}`);
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, c.bg).setDepth(-10);
    this.walls.push(this.add.rectangle(w / 2, 12, w, 24, c.ground));
    this.walls.push(this.add.rectangle(w / 2, h - 12, w, 24, c.ground));
    this.walls.push(this.add.rectangle(12, h / 2, 24, h, c.ground));
    this.walls.push(this.add.rectangle(w - 12, h / 2, 24, h, c.ground));

    for (let i = 0; i < 8; i += 1) {
      this.walls.push(this.add.rectangle(120 + rand() * 720, 90 + rand() * 360, 70, 24, c.platform));
    }

    const size = playerSize(this.spec);
    this.player = addActor(this, 70, h - 80, size.w, size.h, playerColor(this.spec));

    if (this.spec.systems.coins) {
      for (let i = 0; i < level.coinCount; i += 1) {
        const coin = addActor(this, 80 + rand() * 800, 80 + rand() * 380, 14, 14, c.coin) as Actor;
        coin.kind = "coin";
        this.actors.push(coin);
      }
    }

    const enemy = this.spec.enemies[0];
    for (let i = 0; i < level.enemyCount; i += 1) {
      const body = addActor(this, 200 + rand() * 680, 80 + rand() * 360, 26, 26, c.enemy) as Actor;
      body.kind = "enemy";
      body.hp = enemy?.health ?? 20;
      body.damage = scaled(this.spec, enemy?.damage ?? 10, "damage");
      this.actors.push(body);
    }

    if (level.hasBoss && this.spec.boss) {
      const boss = addActor(this, w - 140, 120, 56, 56, c.boss, this.spec.boss.name) as Actor;
      boss.kind = "boss";
      boss.hp = this.spec.boss.health;
      boss.damage = scaled(this.spec, this.spec.boss.damage, "damage");
      this.actors.push(boss);
    } else {
      const exit = addActor(this, w - 60, 60, 28, 28, c.accent) as Actor;
      exit.kind = "exit";
      this.actors.push(exit);
    }
  }

  private blocked(x: number, y: number) {
    const p = { x, y, w: this.player.width, h: this.player.height };
    return this.walls.some((wall) => overlaps(p, { x: wall.x, y: wall.y, w: wall.width, h: wall.height }));
  }

  update() {
    if (this.over) return;
    const speed = this.spec.player.speed / 60;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += speed;

    if (!this.blocked(this.player.x + dx, this.player.y)) this.player.x += dx;
    if (!this.blocked(this.player.x, this.player.y + dy)) this.player.y += dy;

    const p = { x: this.player.x, y: this.player.y, w: this.player.width, h: this.player.height };
    for (const actor of [...this.actors]) {
      if (actor.kind === "enemy" || actor.kind === "boss") {
        const chase = scaled(this.spec, actor.kind === "boss" ? 0.55 : 0.35, "speed");
        actor.x += Math.sign(this.player.x - actor.x) * chase;
        actor.y += Math.sign(this.player.y - actor.y) * chase;
      }
      if (!overlaps(p, { x: actor.x, y: actor.y, w: actor.width, h: actor.height })) continue;
      if (actor.kind === "coin") {
        this.coins += this.spec.rules.coinValue;
        actor.destroy();
        this.actors = this.actors.filter((item) => item !== actor);
      } else if (actor.kind === "exit") {
        this.nextLevel();
      } else if ((actor.kind === "enemy" || actor.kind === "boss") && this.time.now > this.hurtUntil) {
        actor.hp = (actor.hp ?? 1) - 16;
        this.hp -= actor.damage ?? 10;
        this.hurtUntil = this.time.now + 500;
        this.player.x += Math.sign(this.player.x - actor.x) * 16;
        this.player.y += Math.sign(this.player.y - actor.y) * 16;
        if ((actor.hp ?? 0) <= 0) {
          actor.destroy();
          this.actors = this.actors.filter((item) => item !== actor);
          if (actor.kind === "boss") this.nextLevel();
        }
        if (this.hp <= 0) {
          this.over = true;
          this.banner.setText("被打倒了。点一下重来。");
        }
      }
    }

    const level = this.spec.levels[this.levelIndex];
    this.hud.setText(
      `${this.spec.title}  ·  ${level.name}\n${this.spec.player.name}  HP ${Math.max(0, Math.round(this.hp))}   金币 ${this.coins}`,
    );
  }

  private nextLevel() {
    this.levelIndex += 1;
    if (this.levelIndex >= this.spec.levels.length) {
      this.over = true;
      this.banner.setText("探秘完成。点一下再玩。");
      return;
    }
    this.buildLevel();
  }
}
