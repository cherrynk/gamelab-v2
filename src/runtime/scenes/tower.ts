import Phaser from "phaser";
import type { GameSpec } from "@/core/spec";
import { addActor, hudStyle, scaled } from "../sdk";

type Creep = Phaser.GameObjects.Rectangle & {
  hp: number;
  max: number;
  speed: number;
  damage: number;
  point: number;
  boss?: boolean;
};

type Tower = Phaser.GameObjects.Rectangle & {
  fireAt: number;
};

export class TowerScene extends Phaser.Scene {
  private spec!: GameSpec;
  private wave = 0;
  private coins = 30;
  private baseHp = 100;
  private creeps: Creep[] = [];
  private towers: Tower[] = [];
  private path: { x: number; y: number }[] = [];
  private spawnLeft = 0;
  private spawnAt = 0;
  private over = false;
  private hud!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super("tower");
  }

  create() {
    this.spec = this.registry.get("spec") as GameSpec;
    this.baseHp = this.spec.player.health;
    this.coins = this.spec.systems.shop ? 40 : 30;
    this.over = false;
    const c = this.spec.style.colors;
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, c.bg);
    this.path = [
      { x: 40, y: 280 },
      { x: 220, y: 280 },
      { x: 220, y: 140 },
      { x: 500, y: 140 },
      { x: 500, y: 400 },
      { x: 820, y: 400 },
      { x: 820, y: 220 },
      { x: 920, y: 220 },
    ];
    for (let i = 0; i < this.path.length - 1; i += 1) {
      const a = this.path[i];
      const b = this.path[i + 1];
      const road = this.add.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) + 36, Math.abs(b.y - a.y) + 36, c.ground);
      road.setAlpha(0.9);
    }
    addActor(this, 920, 220, 36, 48, c.accent, "基地");
    this.hud = this.add.text(16, 12, "", { ...hudStyle(this.spec), fontSize: "16px" }).setDepth(20);
    this.banner = this.add.text(480, 80, "点空地点炮塔（10 金币）", { ...hudStyle(this.spec), fontSize: "18px" }).setOrigin(0.5);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.over) {
        this.scene.restart();
        return;
      }
      this.tryBuild(pointer.x, pointer.y);
    });
    this.startWave();
  }

  private startWave() {
    const level = this.spec.levels[this.wave];
    if (!level) {
      this.over = true;
      this.banner.setText("防线守住了。点一下再来一局。");
      return;
    }
    this.spawnLeft = level.enemyCount + (level.hasBoss ? 1 : 0);
    this.spawnAt = 0;
    this.banner.setText(level.name);
  }

  private tryBuild(x: number, y: number) {
    if (this.coins < 10) return;
    const onRoad = this.path.some((point) => Math.hypot(point.x - x, point.y - y) < 50);
    if (onRoad) return;
    this.coins -= 10;
    const tower = addActor(this, x, y, 28, 28, this.spec.style.colors.player) as Tower;
    tower.fireAt = 0;
    this.towers.push(tower);
  }

  private spawnCreep(boss = false) {
    const enemy = this.spec.enemies[0];
    const start = this.path[0];
    const body = addActor(
      this,
      start.x,
      start.y,
      boss ? 40 : 22,
      boss ? 40 : 22,
      boss ? this.spec.style.colors.boss : this.spec.style.colors.enemy,
      boss ? this.spec.boss?.name : undefined,
    ) as Creep;
    body.hp = boss ? this.spec.boss?.health ?? 180 : enemy?.health ?? 24;
    body.max = body.hp;
    body.speed = scaled(this.spec, boss ? this.spec.boss?.speed ?? 40 : enemy?.speed ?? 70, "speed") / 60;
    body.damage = scaled(this.spec, boss ? this.spec.boss?.damage ?? 18 : enemy?.damage ?? 8, "damage");
    body.point = 0;
    body.boss = boss;
    this.creeps.push(body);
  }

  update(time: number) {
    if (this.over) return;
    const level = this.spec.levels[this.wave];
    if (this.spawnLeft > 0 && time > this.spawnAt) {
      const boss = Boolean(level?.hasBoss && this.spawnLeft === 1 && this.spec.boss);
      this.spawnCreep(boss);
      this.spawnLeft -= 1;
      this.spawnAt = time + (boss ? 900 : 700);
    }

    for (const creep of [...this.creeps]) {
      const target = this.path[creep.point + 1];
      if (!target) {
        this.baseHp -= creep.damage;
        creep.destroy();
        this.creeps = this.creeps.filter((item) => item !== creep);
        if (this.baseHp <= 0) {
          this.over = true;
          this.banner.setText("基地被突破了。点一下重来。");
        }
        continue;
      }
      const dx = target.x - creep.x;
      const dy = target.y - creep.y;
      const dist = Math.hypot(dx, dy) || 1;
      creep.x += (dx / dist) * creep.speed;
      creep.y += (dy / dist) * creep.speed;
      if (dist < 8) creep.point += 1;
    }

    for (const tower of this.towers) {
      if (time < tower.fireAt) continue;
      const target = this.creeps.find((creep) => Math.hypot(creep.x - tower.x, creep.y - tower.y) < 140);
      if (!target) continue;
      target.hp -= 18;
      const shot = this.add.line(0, 0, tower.x, tower.y, target.x, target.y, this.spec.style.colors.accent);
      shot.setOrigin(0);
      this.time.delayedCall(80, () => shot.destroy());
      tower.fireAt = time + 380;
      if (target.hp <= 0) {
        this.coins += this.spec.rules.coinValue * (target.boss ? 8 : 2);
        target.destroy();
        this.creeps = this.creeps.filter((item) => item !== target);
      }
    }

    if (this.spawnLeft <= 0 && this.creeps.length === 0 && level) {
      this.wave += 1;
      this.startWave();
    }

    this.hud.setText(
      `${this.spec.title}  ·  波次 ${Math.min(this.wave + 1, this.spec.levels.length)}/${this.spec.levels.length}\n基地 HP ${Math.max(0, Math.round(this.baseHp))}   金币 ${this.coins}   炮塔 ${this.towers.length}`,
    );
  }
}
