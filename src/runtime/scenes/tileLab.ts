import Phaser from "phaser";
import { addToken, preloadArt } from "@/art/tokens";

type StarToken = Phaser.GameObjects.Arc | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

export class TileLabScene extends Phaser.Scene {
  private ground!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer;
  private player!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private stars: StarToken[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private score = 0;
  private total = 0;
  private over = false;
  private won = false;
  private scoreText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super("tile-lab");
  }

  preload() {
    preloadArt(this);
    this.load.tilemapTiledJSON("tile-lab", "/maps/tile-lab/map.json");
    this.load.image("tile-lab-tiles", "/maps/tile-lab/tiles.png");
  }

  create() {
    const map = this.make.tilemap({ key: "tile-lab" });
    const tiles = map.addTilesetImage("lab", "tile-lab-tiles");
    if (!tiles) {
      this.add.text(24, 24, "砖图资源没加载到", { color: "#ff8fab" });
      return;
    }

    const ground = map.createLayer("ground", tiles, 0, 0);
    if (!ground) {
      this.add.text(24, 24, "找不到 ground 图层", { color: "#ff8fab" });
      return;
    }
    this.ground = ground;
    this.ground.setCollisionByProperty({ collider: true });
    this.ground.setDepth(0);

    const spawn = this.readSpawn(map) ?? { x: 48, y: 48 };
    this.stars = [];
    this.score = 0;
    this.over = false;
    this.won = false;
    this.placeStars(map);

    this.player = addToken(this, "hero", spawn.x, spawn.y, 28, 28, 0x3ee0c5);
    this.player.setDepth(10);

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(80, 48);

    this.scoreText = this.add
      .text(24, 16, this.hudLine(), {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(200);
    this.add
      .text(24, 44, "砖图 · 方向键 / WASD / 按住拖去，捡星星到门口", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#9aa3c7",
      })
      .setScrollFactor(0)
      .setDepth(200);
    this.hint = this.add
      .text(this.scale.width / 2, 78, "", {
        fontFamily: "sans-serif",
        fontSize: "22px",
        color: "#3ee0c5",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    const kb = this.input.keyboard;
    this.keys = kb
      ? kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>
      : {};
    this.input.on("pointerdown", () => {
      if (this.over || this.won) this.scene.restart();
    });
  }

  update(_time: number, delta: number) {
    if (this.over || this.won || !this.player) return;
    const step = Math.min(delta / 16, 2);
    let vx = 0;
    let vy = 0;
    if (this.keys.A?.isDown || this.keys.LEFT?.isDown) vx -= 1;
    if (this.keys.D?.isDown || this.keys.RIGHT?.isDown) vx += 1;
    if (this.keys.W?.isDown || this.keys.UP?.isDown) vy -= 1;
    if (this.keys.S?.isDown || this.keys.DOWN?.isDown) vy += 1;

    const pointer = this.input.activePointer;
    if (pointer.isDown && vx === 0 && vy === 0) {
      const dx = pointer.worldX - this.player.x;
      const dy = pointer.worldY - this.player.y;
      if (Math.hypot(dx, dy) > 8) {
        vx = dx;
        vy = dy;
      }
    }

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      const spec = this.registry.get("spec") as { player?: { speed?: number } } | undefined;
      const speed = ((spec?.player?.speed ?? 160) / 160) * 2.6 * step;
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
      this.tryMove(vx, vy);
    }

    for (const star of this.stars.slice()) {
      if (Phaser.Math.Distance.Between(star.x, star.y, this.player.x, this.player.y) < 22) {
        this.stars = this.stars.filter((item) => item !== star);
        star.destroy();
        this.score += 1;
        this.scoreText.setText(this.hudLine());
      }
    }

    if (this.score >= this.total && this.onExit()) {
      this.won = true;
      this.hint.setText("星星齐了，点一下再走一趟").setVisible(true);
    }
  }

  private hudLine() {
    return "星星 " + this.score + " / " + this.total;
  }

  private readSpawn(map: Phaser.Tilemaps.Tilemap) {
    const layer = map.getObjectLayer("objects");
    const hit = layer?.objects.find((item) => item.type === "spawn" || item.name === "spawn");
    if (!hit) return null;
    return { x: hit.x ?? 48, y: hit.y ?? 48 };
  }

  private placeStars(map: Phaser.Tilemaps.Tilemap) {
    const layer = map.getObjectLayer("objects");
    const marks = (layer?.objects ?? []).filter((item) => item.type === "star" || item.name === "star");
    this.total = marks.length;
    for (const mark of marks) {
      const star = addToken(this, "star", mark.x ?? 0, mark.y ?? 0, 22, 22, 0xffd166);
      star.setDepth(8);
      this.stars.push(star);
    }
  }

  private blocked(x: number, y: number) {
    const r = 11;
    const spots = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ];
    return spots.some(([px, py]) => {
      const tile = this.ground.getTileAtWorldXY(px, py, true);
      return Boolean(tile && tile.collides);
    });
  }

  private tryMove(vx: number, vy: number) {
    const nextX = this.player.x + vx;
    if (!this.blocked(nextX, this.player.y)) this.player.x = nextX;
    const nextY = this.player.y + vy;
    if (!this.blocked(this.player.x, nextY)) this.player.y = nextY;
  }

  private onExit() {
    const tile = this.ground.getTileAtWorldXY(this.player.x, this.player.y, true);
    return Boolean(tile?.properties && tile.properties.exit);
  }
}
