import Phaser from "phaser";
import { addScrollingBackdrop, addToken, hasArt, preloadArt, preloadBackdrop, preloadBosses } from "@/art/tokens";
import { SHOOTER_CHASSIS_LABEL, resolveWeapon, type DropSpec, type ShooterChassis, type WeaponSpec } from "@/core/spec";
import { bulletColor, readChassis, readCombat, readSpec, speedMul } from "../readSpec";

type Actor = (Phaser.GameObjects.Arc | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle) & {
  vx?: number;
  vy: number;
  hp?: number;
  maxHp?: number;
  fireAt?: number;
  kind?: "minion" | "boss";
  damage?: number;
  homing?: boolean;
  pierce?: number;
  drop?: DropSpec;
  tag?: Phaser.GameObjects.Text;
};

type LevelSpec = {
  quota: number;
  spawnMs: number;
  minionFire: number;
  minionHp: number;
  minionSpeed: number;
  bossHp: number;
  bossFire: number;
  bossKey: string;
  bossW: number;
  bossH: number;
};

const LEVELS: LevelSpec[] = [
  { quota: 8, spawnMs: 1000, minionFire: 1900, minionHp: 1, minionSpeed: 1.8, bossHp: 10, bossFire: 820, bossKey: "boss-1", bossW: 200, bossH: 140 },
  { quota: 12, spawnMs: 780, minionFire: 1500, minionHp: 1, minionSpeed: 2.2, bossHp: 16, bossFire: 600, bossKey: "boss-2", bossW: 280, bossH: 158 },
  { quota: 16, spawnMs: 620, minionFire: 1200, minionHp: 2, minionSpeed: 2.6, bossHp: 22, bossFire: 460, bossKey: "boss-3", bossW: 220, bossH: 174 },
];

function hitBox(
  obj: Phaser.GameObjects.GameObject & {
    displayWidth?: number;
    displayHeight?: number;
    width?: number;
    height?: number;
  },
  scale: number,
) {
  return {
    w: (obj.displayWidth || obj.width || 16) * scale,
    h: (obj.displayHeight || obj.height || 16) * scale,
  };
}

function hits(
  a: Phaser.GameObjects.GameObject & { x: number; y: number; displayWidth?: number; width?: number; displayHeight?: number; height?: number },
  b: Phaser.GameObjects.GameObject & { x: number; y: number; displayWidth?: number; width?: number; displayHeight?: number; height?: number },
  scale = 0.32,
) {
  const aa = hitBox(a, scale);
  const bb = hitBox(b, scale);
  return Math.abs(a.x - b.x) < (aa.w + bb.w) / 2 && Math.abs(a.y - b.y) < (aa.h + bb.h) / 2;
}

export class ShooterScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private bullets: Actor[] = [];
  private enemyShots: Actor[] = [];
  private enemies: Actor[] = [];
  private gifts: Actor[] = [];
  private fireAt = 0;
  private spawnAt = 0;
  private score = 0;
  private kills = 0;
  private level = 0;
  private phase: "wave" | "boss" = "wave";
  private over = false;
  private won = false;
  private weaponUntil = 0;
  private baseWeapon!: WeaponSpec;
  private weapon!: WeaponSpec;
  private worldW = 800;
  private worldH = 450;
  private aimX = 0;
  private aimY = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private buffText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bannerAt = 0;
  private tracking = false;
  private safeUntil = 0;
  private boss: Actor | null = null;
  private backdrop: Phaser.GameObjects.TileSprite | null = null;
  private barrel: Phaser.GameObjects.Rectangle | null = null;

  constructor() {
    super("shooter");
  }

  preload() {
    preloadArt(this);
    preloadBackdrop(this);
    preloadBosses(this);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.worldW = w;
    this.worldH = h;
    this.bullets = [];
    this.enemyShots = [];
    this.enemies = [];
    this.gifts = [];
    this.fireAt = 0;
    this.spawnAt = 0;
    this.score = 0;
    this.kills = 0;
    this.level = 0;
    this.phase = "wave";
    this.over = false;
    this.won = false;
    const combat = readCombat(this);
    this.baseWeapon = combat.weapon;
    this.weapon = combat.weapon;
    this.weaponUntil = 0;
    this.boss = null;
    this.tracking = false;
    this.safeUntil = 0;
    this.aimX = w / 2;
    this.aimY = h - 90;
    this.backdrop = addScrollingBackdrop(this);
    this.cameras.main.setBackgroundColor("#12141f");
    this.cameras.main.setScroll(0, 0);

    this.scoreText = this.hudText(24, 16, `${this.modeLabel()}  ·  第 1 关 · 得分 0`, 22);
    this.add
      .text(24, 44, this.modeHint(), {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#9aa3c7",
      })
      .setScrollFactor(0)
      .setDepth(200);
    this.buffText = this.hudText(w - 24, 16, "", 18).setOrigin(1, 0);
    this.bossText = this.hudText(w / 2, 16, "", 18).setOrigin(0.5, 0).setColor("#ff6b9d");
    this.banner = this.add
      .text(w / 2, 78, "", {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0);
    this.hint = this.add
      .text(w / 2, h / 2, "", {
        fontFamily: "sans-serif",
        fontSize: "22px",
        color: "#3ee0c5",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    this.spawnPlayer();

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.over) return;
      this.tracking = true;
      this.aimAt(pointer);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.over) {
        this.scene.restart();
        return;
      }
      this.tracking = true;
      this.aimAt(pointer);
      this.fireAt = 0;
      this.fire();
    });
    this.safeUntil = this.time.now + 1600;
    this.showBanner("第 1 关");
  }

  update(_time: number, delta: number) {
    if (this.over) return;
    const step = delta / 16;
    const spec = LEVELS[this.level];

    if (this.bannerAt > 0) {
      this.bannerAt = Math.max(0, this.bannerAt - delta);
      this.banner.setAlpha(this.bannerAt > 400 ? 1 : this.bannerAt / 400);
    }

    if (this.weaponUntil > 0) {
      this.weaponUntil = Math.max(0, this.weaponUntil - delta);
      this.buffText.setText(`${this.weapon.name} ${Math.ceil(this.weaponUntil / 1000)}s`);
      if (this.weaponUntil === 0) this.weapon = this.baseWeapon;
    } else if (this.weapon.id !== this.baseWeapon.id) {
      this.buffText.setText(this.weapon.name);
    } else {
      this.buffText.setText("");
    }

    this.cruise(step);
    this.steer(step, this.input.activePointer);
    this.fireAt += delta;
    const gap = this.weapon.fireRate || 200;
    if (this.input.activePointer.isDown && this.fireAt > gap) {
      this.fireAt = 0;
      this.fire();
    }

    if (this.phase === "wave") {
      this.spawnAt += delta;
      if (this.spawnAt > spec.spawnMs && this.enemies.length < 5) {
        this.spawnAt = 0;
        this.spawnEnemy();
      }
    }

    this.tickShots(this.bullets, step);
    this.tickShots(this.enemyShots, step);
    this.tickGifts(step);
    this.tickEnemies(step, spec, delta);
    if (this.over) return;

    for (const shot of [...this.enemyShots]) {
      if (!this.inGrace() && hits(shot, this.player, 0.26)) {
        this.fail("被子弹打中了，点一下重开");
        return;
      }
    }
  }

  private hudText(x: number, y: number, value: string, size: number) {
    return this.add
      .text(x, y, value, {
        fontFamily: "sans-serif",
        fontSize: `${size}px`,
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(200);
  }

  private aimAt(pointer: Phaser.Input.Pointer) {
    this.aimX = Phaser.Math.Clamp(pointer.x, 28, this.scale.width - 28);
    this.aimY = Phaser.Math.Clamp(pointer.y, 28, this.scale.height - 28);
  }

  private chassis(): ShooterChassis {
    return readChassis(readSpec(this));
  }

  private modeLabel() {
    return `${SHOOTER_CHASSIS_LABEL[this.chassis()]}射击`;
  }

  private modeHint() {
    const mode = this.chassis();
    if (mode === "tank") return "坦克推进，躲开红弹，清完一波打 Boss";
    if (mode === "soldier") return "特种兵推进，躲开红弹，清完一波打 Boss";
    return "战机往前飞，躲开红弹，清完一波打 Boss";
  }

  private spawnPlayer() {
    this.barrel?.destroy();
    this.barrel = null;
    const mode = this.chassis();
    if (mode === "tank") {
      this.player = this.add.rectangle(this.aimX, this.aimY, 54, 36, 0x4a7c43).setStrokeStyle(3, 0x1f3d1a) as Actor;
      this.barrel = this.add.rectangle(this.aimX, this.aimY - 24, 10, 26, 0x2c4a28).setDepth(11);
    } else if (mode === "soldier") {
      this.player = addToken(this, "hero", this.aimX, this.aimY, 28, 40, 0x3ee0c5);
    } else {
      this.player = addToken(this, "ship", this.aimX, this.aimY, 36, 36, 0x3ee0c5);
    }
    this.player.setDepth(10);
  }

  private cruise(step: number) {
    const mode = this.chassis();
    const base = mode === "tank" ? 0.7 : mode === "soldier" ? 1.1 : 1.8;
    const speed = base + this.level * 0.28;
    if (this.backdrop) this.backdrop.tilePositionY -= speed * step;
  }

  private steer(step: number, pointer: Phaser.Input.Pointer) {
    if (this.tracking) this.aimAt(pointer);
    const mode = this.chassis();
    const pull = Math.min(1, (mode === "tank" ? 0.09 : mode === "soldier" ? 0.16 : 0.22) * step);
    this.player.x += (this.aimX - this.player.x) * pull;
    this.player.y += (this.aimY - this.player.y) * pull;
    this.player.x = Phaser.Math.Clamp(this.player.x, 28, this.scale.width - 28);
    this.player.y = Phaser.Math.Clamp(this.player.y, 28, this.scale.height - 28);
    if (this.barrel) {
      this.barrel.x = this.player.x;
      this.barrel.y = this.player.y - 22;
    }
  }

  private tickShots(list: Actor[], step: number) {
    for (const shot of [...list]) {
      if (shot.homing) {
        const target = this.nearestEnemy(shot.x, shot.y);
        if (target) {
          const aim = this.aimVector(shot.x, shot.y, Math.abs(shot.vy) || 8, target.x, target.y);
          shot.vx = (shot.vx || 0) * 0.55 + aim.x * 0.45;
          shot.vy = shot.vy * 0.55 + aim.y * 0.45;
        }
      }
      shot.x += (shot.vx || 0) * step;
      shot.y += shot.vy * step;
      if (this.farFromView(shot, 80)) this.remove(list, shot);
    }
  }

  private tickGifts(step: number) {
    for (const gift of [...this.gifts]) {
      gift.y += gift.vy * step;
      if (gift.tag) gift.tag.setPosition(gift.x, gift.y - 18);
      if (this.farFromView(gift, 40)) {
        this.remove(this.gifts, gift);
        continue;
      }
      if (hits(gift, this.player, 0.42)) {
        this.collectDrop(gift.drop);
        this.remove(this.gifts, gift);
      }
    }
  }

  private tickEnemies(step: number, spec: LevelSpec, delta: number) {
    for (const unit of [...this.enemies]) {
      if (unit.kind === "boss") {
        unit.x = this.scale.width / 2 + Math.sin(this.time.now / 380) * Math.min(240, this.scale.width * 0.3);
        unit.y += (80 - unit.y) * 0.06 * step;
        unit.x = Phaser.Math.Clamp(unit.x, 60, this.scale.width - 60);
        unit.y = Phaser.Math.Clamp(unit.y, 50, this.scale.height * 0.45);
      } else {
        unit.x += Math.sin(this.time.now / 360 + unit.y * 0.02) * 1.1 * step;
        unit.y += unit.vy * step;
        if (unit.y > this.scale.height + 28) {
          this.remove(this.enemies, unit);
          continue;
        }
      }

      if (!this.inGrace() && hits(unit, this.player, unit.kind === "boss" ? 0.28 : 0.3)) {
        this.fail("被撞到了，点一下重开");
        return;
      }

      unit.fireAt = (unit.fireAt || 0) + delta;
      const interval = unit.kind === "boss" ? spec.bossFire : spec.minionFire;
      if ((unit.fireAt || 0) > interval) {
        unit.fireAt = 0;
        this.enemyFire(unit);
      }

      for (const shot of [...this.bullets]) {
        if (!unit.active) break;
        if (!hits(unit, shot, unit.kind === "boss" ? 0.28 : 0.34)) continue;
        if ((shot.pierce || 0) > 0) {
          shot.pierce = (shot.pierce || 1) - 1;
        } else {
          this.remove(this.bullets, shot);
        }
        unit.hp = (unit.hp || 1) - (shot.damage || 1);
        if (unit.kind === "boss") this.refreshBossHud();
        if ((unit.hp || 0) > 0) break;
        this.maybeDrop(unit.x, unit.y, unit.kind === "boss" ? 1 : undefined);
        this.remove(this.enemies, unit);
        if (unit.kind === "boss") {
          this.boss = null;
          this.score += 5;
          this.onBossDown();
        } else {
          this.score += 1;
          this.kills += 1;
          if (this.phase === "wave" && this.kills >= spec.quota) this.spawnBoss();
        }
        this.refreshHud();
        break;
      }
    }
  }

  private fire() {
    const weapon = this.weapon;
    const color = bulletColor(weapon.bullet);
    if (weapon.bullet === "laser") {
      const muzzle = this.muzzleY();
      const beam = this.add.rectangle(this.player.x, muzzle - 18, 6, 40, color).setStrokeStyle(1, 0xffffff) as Actor;
      beam.vy = -(weapon.speed || 16);
      beam.vx = 0;
      beam.damage = weapon.damage || 2;
      beam.pierce = 3;
      beam.setDepth(8);
      this.bullets.push(beam);
      return;
    }
    const dirs = this.shotDirs(weapon);
    dirs.forEach((dir, index) => {
      const size = weapon.bullet === "spread" ? 10 : 12;
      const shot = addToken(this, "ball", this.player.x, this.muzzleY() - (weapon.bullet === "burst" ? index * 10 : 0), size, size, color) as Actor;
      shot.vy = -(weapon.speed || 10) - (weapon.bullet === "burst" ? index * 0.6 : 0);
      shot.vx = dir * (weapon.bullet === "spread" ? 4.2 : 3.4);
      shot.damage = weapon.damage || 1;
      shot.homing = weapon.bullet === "homing";
      shot.setDepth(8);
      if ("setTint" in shot) shot.setTint(color);
      this.bullets.push(shot);
    });
  }

  private muzzleY() {
    const mode = this.chassis();
    if (mode === "tank") return this.player.y - 34;
    if (mode === "soldier") return this.player.y - 24;
    return this.player.y - 22;
  }

  private shotDirs(weapon: WeaponSpec) {
    if (weapon.bullet === "triple") return [-1, 0, 1];
    if (weapon.bullet === "spread") {
      const count = Math.max(3, weapon.count ?? 5);
      return Array.from({ length: count }, (_, index) => index - (count - 1) / 2);
    }
    if (weapon.bullet === "burst") return [0, 0, 0];
    return [0];
  }

  private inGrace() {
    return this.time.now < this.safeUntil;
  }

  private enemyBolt(x: number, y: number) {
    const shot = this.add.circle(x, y, 7, 0xff3355);
    shot.setStrokeStyle(2, 0xffffff);
    shot.setDepth(12);
    return shot as Actor;
  }

  private enemyFire(unit: Actor) {
    if (Math.hypot(unit.x - this.player.x, unit.y - this.player.y) < 70) return;
    const aim = this.aimVector(unit.x, unit.y, unit.kind === "boss" ? 3.2 : 2.3);
    const dirs = unit.kind === "boss" ? [-0.55, 0, 0.55] : [0];
    for (const spread of dirs) {
      const shot = this.enemyBolt(unit.x, unit.y + 18);
      shot.vx = aim.x + spread * 2.6;
      shot.vy = aim.y;
      this.enemyShots.push(shot);
    }
  }

  private spawnEnemy() {
    const spec = LEVELS[this.level];
    const x = 50 + Math.random() * (this.scale.width - 100);
    const y = -24;
    const enemy = addToken(this, "hazard", x, y, 30, 30, 0xff6b9d) as Actor;
    enemy.vy = (spec.minionSpeed + Math.random() * 1.1) * speedMul(this);
    enemy.hp = spec.minionHp;
    enemy.fireAt = -200 - Math.random() * 300;
    enemy.kind = "minion";
    enemy.setDepth(6);
    this.enemies.push(enemy);
  }

  private spawnBoss() {
    this.phase = "boss";
    const spec = LEVELS[this.level];
    const boss = (
      hasArt(this, spec.bossKey)
        ? this.add.image(this.scale.width / 2, 24 + spec.bossH / 2, spec.bossKey).setDisplaySize(spec.bossW, spec.bossH)
        : addToken(this, "hero", this.scale.width / 2, 90, spec.bossW, spec.bossH, 0xffd166)
    ) as Actor;
    boss.vy = 0;
    boss.hp = spec.bossHp;
    boss.maxHp = spec.bossHp;
    boss.fireAt = 200;
    boss.kind = "boss";
    boss.setDepth(9);
    this.boss = boss;
    this.enemies.push(boss);
    this.showBanner(`第 ${this.level + 1} 关 Boss`);
    this.refreshBossHud();
  }

  private onBossDown() {
    this.bossText.setText("");
    if (this.level >= LEVELS.length - 1) {
      this.won = true;
      this.over = true;
      this.hint.setText("通关了，点一下再来").setVisible(true);
      return;
    }
    this.level += 1;
    this.kills = 0;
    this.phase = "wave";
    this.safeUntil = this.time.now + 1200;
    this.showBanner(`第 ${this.level + 1} 关`);
    this.refreshHud();
  }

  private maybeDrop(x: number, y: number, forceChance?: number) {
    const combat = readCombat(this);
    const pool = combat.drops.filter((item) => item.chance > 0);
    if (!pool.length) return;
    const roll = forceChance ?? combat.dropChance ?? 0.55;
    if (forceChance !== 1 && Math.random() > roll) return;
    const total = pool.reduce((sum, item) => sum + item.chance, 0);
    let pick = Math.random() * total;
    const picked = pool.find((item) => {
      pick -= item.chance;
      return pick <= 0;
    }) ?? pool[0];
    const weapon = resolveWeapon(combat, picked.weaponId || picked.name);
    const color = bulletColor(weapon?.bullet ?? "single");
    const gift = addToken(this, "star", x, y, 22, 22, color) as Actor;
    gift.vy = 2.4;
    gift.drop = { ...picked, weaponId: weapon?.id ?? picked.weaponId };
    gift.setDepth(5);
    if ("setTint" in gift) gift.setTint(color);
    gift.tag = this.add
      .text(x, y - 18, picked.name || weapon?.name || "武器", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.gifts.push(gift);
  }

  private collectDrop(drop?: DropSpec) {
    if (!drop) return;
    const combat = readCombat(this);
    if (drop.kind === "weapon" || drop.weaponId || drop.name) {
      const next = resolveWeapon(combat, drop.weaponId || drop.name);
      if (next) {
        this.weapon = next;
        this.weaponUntil = drop.duration ?? 8000;
      }
      return;
    }
    if (drop.kind === "speed") {
      this.weapon = { ...this.weapon, fireRate: Math.max(60, this.weapon.fireRate * 0.7), speed: this.weapon.speed + 2 };
      this.weaponUntil = drop.duration ?? 6000;
    }
  }

  private nearestEnemy(x: number, y: number) {
    let best: Actor | null = null;
    let bestDist = Infinity;
    for (const unit of this.enemies) {
      const dist = Math.hypot(unit.x - x, unit.y - y);
      if (dist < bestDist) {
        best = unit;
        bestDist = dist;
      }
    }
    return best;
  }

  private aimVector(x: number, y: number, speed: number, tx = this.player.x, ty = this.player.y) {
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: (dx / len) * speed, y: (dy / len) * speed };
  }

  private farFromView(obj: { x: number; y: number }, pad: number) {
    const cam = this.cameras.main;
    return (
      obj.x < cam.scrollX - pad ||
      obj.x > cam.scrollX + this.scale.width + pad ||
      obj.y < cam.scrollY - pad ||
      obj.y > cam.scrollY + this.scale.height + pad
    );
  }

  private refreshHud() {
    this.scoreText.setText(`${this.modeLabel()}  ·  第 ${this.level + 1} 关 · 得分 ${this.score}`);
  }

  private refreshBossHud() {
    if (!this.boss) {
      this.bossText.setText("");
      return;
    }
    this.bossText.setText(`Boss ${this.boss.hp}/${this.boss.maxHp}`);
  }

  private showBanner(text: string) {
    this.banner.setText(text).setAlpha(1);
    this.bannerAt = 1600;
  }

  private remove(list: Actor[], item: Actor) {
    const index = list.indexOf(item);
    if (index >= 0) list.splice(index, 1);
    item.tag?.destroy();
    item.destroy();
  }

  private fail(message: string) {
    this.over = true;
    this.hint.setText(message).setVisible(true);
  }
}
