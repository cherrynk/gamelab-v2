import Phaser from "phaser";
import { addToken, hasArt, preloadArt } from "@/art/tokens";

type Card = (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image) & {
  key: string;
  face: Phaser.GameObjects.Text;
  open: boolean;
  done: boolean;
};

const PAIRS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLORS = [0x7c5cff, 0x3ee0c5, 0xff6b9d, 0xffd166, 0x5c9dff, 0xff8a5c, 0x9b8cff, 0x4ad4a0];

export class MemoryScene extends Phaser.Scene {
  private opened: Card[] = [];
  private lock = false;
  private moves = 0;
  private left = 8;
  private movesText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super("memory");
  }

  preload() {
    preloadArt(this);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.opened = [];
    this.lock = false;
    this.moves = 0;
    this.left = 8;

    this.add
      .text(24, 16, "记忆翻牌 · 点开两张相同的牌", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#9aa3c7",
      })
      .setOrigin(0, 0);
    this.movesText = this.add
      .text(24, 42, "步数 0", {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.hint = this.add
      .text(w / 2, h - 28, "", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#3ee0c5",
      })
      .setOrigin(0.5);

    const deck = PAIRS.flatMap((key, index) => [
      { key, color: COLORS[index] },
      { key, color: COLORS[index] },
    ]);
    Phaser.Utils.Array.Shuffle(deck);

    const cols = 4;
    const rows = 4;
    const size = Math.min((w - 48) / cols, (h - 110) / rows) - 8;
    const gridW = cols * (size + 8);
    const gridH = rows * (size + 8);
    const ox = (w - gridW) / 2 + size / 2 + 4;
    const oy = 86 + (h - 110 - gridH) / 2 + size / 2;

    deck.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const card = addToken(
        this,
        "card",
        ox + col * (size + 8),
        oy + row * (size + 8),
        size,
        size,
        0x2a3148,
      ) as Card;
      if ("setStrokeStyle" in card) card.setStrokeStyle(2, 0x3d4663);
      card.setInteractive({ useHandCursor: true });
      card.key = item.key;
      card.open = false;
      card.done = false;
      card.face = this.add
        .text(card.x, card.y, item.key, {
          fontFamily: "sans-serif",
          fontSize: `${Math.floor(size * 0.42)}px`,
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setAlpha(0);
      card.on("pointerdown", () => this.flip(card, item.color));
    });
  }

  private flip(card: Card, color: number) {
    if (this.lock || card.open || card.done) return;
    card.open = true;
    if ("setFillStyle" in card) card.setFillStyle(color);
    else if (hasArt(this, "star")) card.setTint(color);
    card.face.setAlpha(1);
    this.opened.push(card);

    if (this.opened.length < 2) return;
    this.lock = true;
    this.moves += 1;
    this.movesText.setText(`步数 ${this.moves}`);

    const [a, b] = this.opened;
    this.opened = [];
    if (a.key === b.key) {
      a.done = true;
      b.done = true;
      this.left -= 1;
      this.lock = false;
      if (this.left <= 0) {
        this.hint.setText("全部翻开了，点牌面再来一局");
        this.input.once("pointerdown", () => this.scene.restart());
      }
      return;
    }

    this.time.delayedCall(620, () => {
      a.open = false;
      b.open = false;
      if ("setFillStyle" in a) a.setFillStyle(0x2a3148);
      else a.clearTint();
      if ("setFillStyle" in b) b.setFillStyle(0x2a3148);
      else b.clearTint();
      a.face.setAlpha(0);
      b.face.setAlpha(0);
      this.lock = false;
    });
  }
}
