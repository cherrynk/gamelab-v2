import type { StyleId, StyleSpec } from "./spec";

export type StyleMeta = {
  id: StyleId;
  title: string;
  emoji: string;
  blurb: string;
};

export const styleCatalog: StyleMeta[] = [
  { id: "pixel_art", title: "像素艺术", emoji: "👾", blurb: "复古点阵，最近邻放大" },
  { id: "cartoon", title: "卡通", emoji: "🎨", blurb: "圆润色块，明亮干净" },
  { id: "anime", title: "动漫", emoji: "🌸", blurb: "高饱和，柔和描边" },
  { id: "dark_fantasy", title: "黑暗奇幻", emoji: "🗡️", blurb: "低饱和，戏剧光影" },
  { id: "cyberpunk", title: "赛博朋克", emoji: "🌃", blurb: "霓虹描边，夜色城市" },
];

const styles: Record<StyleId, StyleSpec> = {
  pixel_art: {
    id: "pixel_art",
    palette: "warm",
    outline: "dark",
    lighting: "flat",
    resolution: "32px",
    animation: "retro",
    pixelArt: true,
    background: "#1a1530",
    colors: {
      bg: 0x1a1530,
      ground: 0x3d2b1f,
      player: 0xe8c36a,
      enemy: 0x7cba5a,
      coin: 0xffd35a,
      boss: 0xc44b4b,
      accent: 0x7c5cff,
      platform: 0x5a3d2b,
      hazard: 0x3a5a8c,
      ui: "#eef1ff",
      muted: "#9aa3c7",
    },
  },
  cartoon: {
    id: "cartoon",
    palette: "warm",
    outline: "dark",
    lighting: "soft",
    resolution: "smooth",
    animation: "smooth",
    pixelArt: false,
    background: "#1b2740",
    colors: {
      bg: 0x1b2740,
      ground: 0x3d6b3a,
      player: 0xff8a5b,
      enemy: 0x6ec6ff,
      coin: 0xffe066,
      boss: 0xff5d8f,
      accent: 0x5ad1c8,
      platform: 0x7bb661,
      hazard: 0x4d7cff,
      ui: "#fff7ea",
      muted: "#b8c4d8",
    },
  },
  anime: {
    id: "anime",
    palette: "cool",
    outline: "light",
    lighting: "soft",
    resolution: "smooth",
    animation: "smooth",
    pixelArt: false,
    background: "#2a1838",
    colors: {
      bg: 0x2a1838,
      ground: 0x5a3d6b,
      player: 0xff9ec4,
      enemy: 0x8ec5ff,
      coin: 0xffe29a,
      boss: 0xc77dff,
      accent: 0xff7eb6,
      platform: 0x7a5a9a,
      hazard: 0x4ecdc4,
      ui: "#fff0f6",
      muted: "#c9b4d8",
    },
  },
  dark_fantasy: {
    id: "dark_fantasy",
    palette: "night",
    outline: "dark",
    lighting: "dramatic",
    resolution: "32px",
    animation: "retro",
    pixelArt: true,
    background: "#0f1218",
    colors: {
      bg: 0x0f1218,
      ground: 0x2a221c,
      player: 0xc9a36a,
      enemy: 0x6b3a3a,
      coin: 0xd4af37,
      boss: 0x8b1e3f,
      accent: 0x8a7a5a,
      platform: 0x3a322c,
      hazard: 0x3d1f2b,
      ui: "#e6dcc8",
      muted: "#8a8070",
    },
  },
  cyberpunk: {
    id: "cyberpunk",
    palette: "neon",
    outline: "none",
    lighting: "dramatic",
    resolution: "smooth",
    animation: "smooth",
    pixelArt: false,
    background: "#070814",
    colors: {
      bg: 0x070814,
      ground: 0x16182a,
      player: 0x3ee0c5,
      enemy: 0xff2d95,
      coin: 0xffe14a,
      boss: 0x7c5cff,
      accent: 0x3ee0c5,
      platform: 0x2a3158,
      hazard: 0xff2d95,
      ui: "#eef1ff",
      muted: "#9aa3c7",
    },
  },
};

export function getStyle(id: StyleId): StyleSpec {
  return structuredClone(styles[id]);
}

export function getStyleMeta(id: StyleId) {
  return styleCatalog.find((item) => item.id === id) ?? styleCatalog[0];
}
