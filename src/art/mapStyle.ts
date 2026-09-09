import type { ArtStyleId } from "./catalog";
import type { StyleId } from "@/core/spec";

export function artFolderFor(styleId: StyleId): ArtStyleId {
  if (styleId === "pixel_art" || styleId === "dark_fantasy") return "pixel";
  if (styleId === "cyberpunk") return "neon";
  if (styleId === "cartoon" || styleId === "anime") return "candy";
  return "neon";
}
