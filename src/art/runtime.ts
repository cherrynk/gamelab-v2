import type { ArtStyleId } from "./catalog";
import { defaultArtStyle } from "./catalog";

let active: ArtStyleId = defaultArtStyle;

export function getActiveArtStyle() {
  return active;
}

export function setActiveArtStyle(id: ArtStyleId) {
  active = id;
}
