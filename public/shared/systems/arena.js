export const RADIUS = 840;
export const PLAYER_RADIUS = 28;
export const CENTER_RADIUS = 130;
export const SPEED = 220;
export const MAX_LIVES = 3;
export const TARGET_RANGE = 440;
export const AREA_RANGE = 320;
export const PUSH_DISTANCE = 240;
export const FINAL_CALM_MS = 5000;

export function clampCircle(p) {
  const distance = Math.hypot(p.x, p.y);
  if (distance > RADIUS - PLAYER_RADIUS) {
    p.x *= (RADIUS - PLAYER_RADIUS) / distance;
    p.y *= (RADIUS - PLAYER_RADIUS) / distance;
  }
}
