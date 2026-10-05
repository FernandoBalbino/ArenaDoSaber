import { CENTER_RADIUS, RADIUS } from "./arena.js";

export function zonesAtTime(round, sudden, elapsed) {
  if (sudden || round % 2) return { angle: 0, warning: false, rotating: false };
  const sign = round % 4 === 2 ? 1 : -1;
  return {
    angle:
      ((sign * Math.PI) / 2) *
      Math.max(0, Math.min(1, (elapsed - 20000) / 8000)),
    warning: elapsed >= 18000 && elapsed < 20000,
    rotating: elapsed >= 20000 && elapsed < 28000,
  };
}

export function zoneAt(x, y, angle = 0) {
  const distance = Math.hypot(x, y);
  const localX = x * Math.cos(angle) + y * Math.sin(angle);
  const localY = -x * Math.sin(angle) + y * Math.cos(angle);
  if (
    distance < CENTER_RADIUS ||
    distance > RADIUS ||
    Math.abs(Math.abs(localX) - Math.abs(localY)) < 36
  )
    return null;
  return Math.abs(localY) > Math.abs(localX)
    ? localY < 0
      ? 0
      : 2
    : localX > 0
      ? 1
      : 3;
}
