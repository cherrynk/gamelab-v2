import Phaser from "phaser";
import { ART_KEYS, type ArtStyleId } from "./catalog";
import { getActiveArtStyle } from "./runtime";

export function preloadArt(scene: Phaser.Scene, style: ArtStyleId = getActiveArtStyle()) {
  if (style === "shapes") return;
  for (const key of ART_KEYS) {
    scene.load.image(key, `/art/${style}/${key}.png?v=2`);
  }
}

export function preloadBackdrop(scene: Phaser.Scene, style: ArtStyleId = getActiveArtStyle()) {
  if (style === "shapes") return;
  scene.load.image("bg", `/art/${style}/bg.png?v=2`);
}

export function preloadBosses(scene: Phaser.Scene) {
  scene.load.image("boss-1", "/art/bosses/boss-1.png?v=1");
  scene.load.image("boss-2", "/art/bosses/boss-2.png?v=1");
  scene.load.image("boss-3", "/art/bosses/boss-3.png?v=1");
}

export function addBackdrop(scene: Phaser.Scene) {
  return addWorldBackdrop(scene, scene.scale.width, scene.scale.height);
}

export function addWorldBackdrop(scene: Phaser.Scene, worldW: number, worldH: number) {
  if (!hasArt(scene, "bg")) return null;
  const tileW = scene.scale.width;
  const tileH = scene.scale.height;
  const cols = Math.ceil(worldW / tileW);
  const rows = Math.ceil(worldH / tileH);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const bg = scene.add.image(col * tileW + tileW / 2, row * tileH + tileH / 2, "bg");
      bg.setDisplaySize(tileW, tileH);
      bg.setDepth(-100);
    }
  }
  return true;
}

export function addScrollingBackdrop(scene: Phaser.Scene) {
  if (!hasArt(scene, "bg")) return null;
  const w = scene.scale.width;
  const h = scene.scale.height;
  const tile = scene.add.tileSprite(w / 2, h / 2, w, h, "bg");
  tile.setDepth(-100);
  tile.setScrollFactor(0);
  return tile;
}

export function hasArt(scene: Phaser.Scene, key: string) {
  return scene.textures.exists(key) && scene.textures.get(key).key !== "__MISSING";
}

export function tokenSize(obj: Phaser.GameObjects.GameObject & { displayWidth?: number; width?: number; displayHeight?: number; height?: number }) {
  return {
    w: obj.displayWidth || obj.width || 16,
    h: obj.displayHeight || obj.height || 16,
  };
}

export function addToken(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
) {
  if (hasArt(scene, key)) {
    const image = scene.add.image(x, y, key);
    image.setDisplaySize(w, h);
    return image;
  }
  if (Math.abs(w - h) < 6) {
    return scene.add.circle(x, y, w / 2, color);
  }
  return scene.add.rectangle(x, y, w, h, color);
}
