import { RADIUS, PLAYER_RADIUS } from "./arena.js";
import { jumpHeight } from "./jump.js";

export function laserAtTime(round, elapsed, calm) {
  return {
    angle:
      (((round % 2 ? 1 : -1) * Math.max(0, elapsed - 3000)) / 12000) *
      Math.PI *
      2,
    active: !calm && elapsed >= 3000,
    warning: !calm && elapsed < 3000,
  };
}

export function laserTouches(player, laser, time) {
  if (
    !laser.active ||
    jumpHeight(player, time) > 26 ||
    Math.hypot(player.x, player.y) < 100
  )
    return false;
  const ux = Math.cos(laser.angle),
    uy = Math.sin(laser.angle);
  const projection = Math.max(
    0,
    Math.min(RADIUS - 35, player.x * ux + player.y * uy),
  );
  return (
    Math.hypot(player.x - projection * ux, player.y - projection * uy) <=
    PLAYER_RADIUS + 10
  );
}
