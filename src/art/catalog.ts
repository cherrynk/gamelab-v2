export const ART_KEYS = [
  "star",
  "paddle",
  "ball",
  "brick",
  "hero",
  "hazard",
  "ship",
  "card",
] as const;

export type ArtKey = (typeof ART_KEYS)[number];

export type ArtStyleId = "shapes" | "neon" | "pixel" | "candy";

export type ArtStyle = {
  id: ArtStyleId;
  title: string;
  blurb: string;
  background: string;
  pixelArt: boolean;
};

export const artStyles: ArtStyle[] = [
  {
    id: "shapes",
    title: "色块",
    blurb: "原来的几何图形，没有贴图。",
    background: "#12141f",
    pixelArt: false,
  },
  {
    id: "neon",
    title: "霓虹",
    blurb: "夜店发光描边，默认套装。",
    background: "#070814",
    pixelArt: false,
  },
  {
    id: "pixel",
    title: "像素",
    blurb: "复古点阵，最近邻放大。",
    background: "#1a1530",
    pixelArt: true,
  },
  {
    id: "candy",
    title: "糖果",
    blurb: "软糖和奶油质感。",
    background: "#2a1830",
    pixelArt: false,
  },
];

export const defaultArtStyle: ArtStyleId = "neon";

export function getArtStyle(id?: string | null) {
  return artStyles.find((item) => item.id === id) ?? artStyles[1];
}
