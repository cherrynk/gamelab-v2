import Phaser from "phaser";
import { addToken, hasArt, preloadArt } from "@/art/tokens";

type Cell = {
  value: number;
  box: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

const COLORS: Record<number, number> = {
  0: 0x1c2133,
  2: 0x3d4663,
  4: 0x4a5580,
  8: 0x7c5cff,
  16: 0x5c9dff,
  32: 0x3ee0c5,
  64: 0x4ad4a0,
  128: 0xffd166,
  256: 0xff8a5c,
  512: 0xff6b9d,
  1024: 0x9b8cff,
  2048: 0xffffff,
};

export class MergeScene extends Phaser.Scene {
  private grid: number[][] = [];
  private cells: Cell[] = [];
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private startX = 0;
  private startY = 0;
  private dragging = false;
  private locked = false;

  constructor() {
    super("merge");
  }

  preload() {
    preloadArt(this);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.score = 0;
    this.locked = false;
    this.grid = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    this.add
      .text(24, 16, "合成 · 滑动或方向键合并数字", {
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
      .text(w / 2, h - 26, "滑一下试试", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#9aa3c7",
      })
      .setOrigin(0.5);

    const size = Math.min((w - 64) / 4, (h - 120) / 4);
    const ox = (w - size * 4) / 2 + size / 2;
    const oy = 78 + (h - 120 - size * 4) / 2 + size / 2;
    this.cells = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const box = addToken(this, "brick", ox + col * size, oy + row * size, size - 8, size - 8, 0x1c2133);
        const label = this.add
          .text(box.x, box.y, "", {
            fontFamily: "sans-serif",
            fontSize: `${Math.floor(size * 0.32)}px`,
            color: "#ffffff",
            fontStyle: "bold",
          })
          .setOrigin(0.5);
        this.cells.push({ value: 0, box, label });
      }
    }

    this.spawn();
    this.spawn();
    this.paint();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.locked) {
        this.scene.restart();
        return;
      }
      this.dragging = true;
      this.startX = pointer.x;
      this.startY = pointer.y;
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || this.locked) return;
      this.dragging = false;
      const dx = pointer.x - this.startX;
      const dy = pointer.y - this.startY;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? "right" : "left");
      else this.move(dy > 0 ? "down" : "up");
    });

    this.input.keyboard?.on("keydown-LEFT", () => this.move("left"));
    this.input.keyboard?.on("keydown-RIGHT", () => this.move("right"));
    this.input.keyboard?.on("keydown-UP", () => this.move("up"));
    this.input.keyboard?.on("keydown-DOWN", () => this.move("down"));
  }

  private move(dir: "left" | "right" | "up" | "down") {
    if (this.locked) return;
    const before = this.grid.map((row) => row.slice());
    const rotated = this.orient(this.grid, dir);
    let gained = 0;
    for (let row = 0; row < 4; row += 1) {
      const { line, score } = this.slide(rotated[row]);
      rotated[row] = line;
      gained += score;
    }
    this.grid = this.orientBack(rotated, dir);
    if (this.same(before, this.grid)) return;
    this.score += gained;
    this.scoreText.setText(`得分 ${this.score}`);
    this.spawn();
    this.paint();
    if (this.stuck()) {
      this.locked = true;
      this.hint.setText("没有可合成的了，点一下重开");
    }
  }

  private slide(input: number[]) {
    const nums = input.filter((n) => n !== 0);
    const line: number[] = [];
    let score = 0;
    for (let i = 0; i < nums.length; i += 1) {
      if (nums[i] === nums[i + 1]) {
        const merged = nums[i] * 2;
        line.push(merged);
        score += merged;
        i += 1;
      } else {
        line.push(nums[i]);
      }
    }
    while (line.length < 4) line.push(0);
    return { line, score };
  }

  private orient(grid: number[][], dir: string) {
    if (dir === "left") return grid.map((row) => row.slice());
    if (dir === "right") return grid.map((row) => row.slice().reverse());
    if (dir === "up") {
      return [0, 1, 2, 3].map((col) => [0, 1, 2, 3].map((row) => grid[row][col]));
    }
    return [0, 1, 2, 3].map((col) => [0, 1, 2, 3].map((row) => grid[row][col]).reverse());
  }

  private orientBack(grid: number[][], dir: string) {
    if (dir === "left") return grid;
    if (dir === "right") return grid.map((row) => row.slice().reverse());
    if (dir === "up") {
      return [0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((col) => grid[col][row]));
    }
    const flipped = grid.map((row) => row.slice().reverse());
    return [0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((col) => flipped[col][row]));
  }

  private spawn() {
    const empty: Array<[number, number]> = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        if (this.grid[row][col] === 0) empty.push([row, col]);
      }
    }
    if (!empty.length) return;
    const [row, col] = empty[Math.floor(Math.random() * empty.length)];
    this.grid[row][col] = Math.random() < 0.9 ? 2 : 4;
  }

  private paint() {
    this.cells.forEach((cell, index) => {
      const value = this.grid[Math.floor(index / 4)][index % 4];
      cell.value = value;
      const fill = COLORS[value] ?? 0xff6b9d;
      if ("setFillStyle" in cell.box) cell.box.setFillStyle(fill);
      else if (hasArt(this, "brick")) cell.box.setTint(fill);
      cell.label.setText(value ? String(value) : "");
      cell.label.setColor(value >= 2048 ? "#12141f" : "#ffffff");
    });
  }

  private same(a: number[][], b: number[][]) {
    return a.every((row, r) => row.every((n, c) => n === b[r][c]));
  }

  private stuck() {
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const n = this.grid[row][col];
        if (n === 0) return false;
        if (col < 3 && n === this.grid[row][col + 1]) return false;
        if (row < 3 && n === this.grid[row + 1][col]) return false;
      }
    }
    return true;
  }
}
