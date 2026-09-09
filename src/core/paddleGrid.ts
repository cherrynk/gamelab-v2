import type { BrickStamp } from "./spec";

export const PADDLE_COLS = 8;
export const PADDLE_ROWS = 7;
export const PADDLE_ORIGIN_X = 70;
export const PADDLE_ORIGIN_Y = 88;
export const PADDLE_GAP_X = 90;
export const PADDLE_GAP_Y = 30;
export const PADDLE_BRICK_W = 80;
export const PADDLE_BRICK_H = 20;
export const PADDLE_GAME_W = 960;
export const PADDLE_GAME_H = 540;

export function brickCellCenter(col: number, row: number) {
  return {
    x: PADDLE_ORIGIN_X + col * PADDLE_GAP_X,
    y: PADDLE_ORIGIN_Y + row * PADDLE_GAP_Y,
  };
}

export function starterCustomBricks(): BrickStamp[] {
  const sketch = ["  XXXX  ", " XX  XX ", "XX SS XX", " XX  XX ", "  XXXX  "];
  const bricks: BrickStamp[] = [];
  sketch.forEach((line, row) => {
    [...line].forEach((cell, col) => {
      if (cell === "X") bricks.push({ col, row, hp: row === 0 ? 2 : 1 });
      if (cell === "S") bricks.push({ col, row, steel: true });
    });
  });
  return bricks;
}

export function stampKey(col: number, row: number) {
  return `${col}:${row}`;
}
