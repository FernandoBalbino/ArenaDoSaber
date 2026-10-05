import { PLAYER_RADIUS, clampCircle, SPEED } from "./arena.js";
import { OBSTACLES } from "./obstacles.js";
import { GATES } from "./gates.js";
import { jumpHeight } from "./jump.js";

export function colliders(arena) {
  return [...OBSTACLES, ...GATES.filter((_, i) => arena?.gates?.[i]?.closed)];
}

export function overlaps(p, shape, height = 0) {
  if (height > shape.height) return false;
  if (shape.radius)
    return (
      Math.hypot(p.x - shape.x, p.y - shape.y) < shape.radius + PLAYER_RADIUS
    );
  const dx = p.x - shape.x,
    dy = p.y - shape.y,
    c = Math.cos(shape.angle),
    s = Math.sin(shape.angle);
  const x = dx * c + dy * s,
    y = -dx * s + dy * c;
  return (
    Math.hypot(
      Math.max(0, Math.abs(x) - shape.width / 2),
      Math.max(0, Math.abs(y) - shape.depth / 2),
    ) < PLAYER_RADIUS
  );
}

export function isClear(p, arena, height = 0) {
  return !colliders(arena).some((shape) => overlaps(p, shape, height));
}

// Resolve landing/teleport overlap to the nearest free point; deterministic on both ends.
export function resolvePosition(p, arena, height = 0) {
  clampCircle(p);
  if (isClear(p, arena, height)) return;
  const origin = { x: p.x, y: p.y };
  for (let r = 4; r <= 240; r += 4) {
    for (let i = 0; i < 32; i++) {
      const angle = (i * Math.PI) / 16;
      const candidate = {
        x: origin.x + Math.cos(angle) * r,
        y: origin.y + Math.sin(angle) * r,
      };
      clampCircle(candidate);
      if (isClear(candidate, arena, height)) {
        p.x = candidate.x;
        p.y = candidate.y;
        return;
      }
    }
  }
  p.x = 0;
  p.y = 0; // The reserved spawn is always clear.
}

export function moveWithCollisions(p, dx, dy, arena, height = 0) {
  resolvePosition(p, arena, height);
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 10));
  for (let i = 0; i < steps; i++) {
    const x = { x: p.x + dx / steps, y: p.y };
    clampCircle(x);
    if (isClear(x, arena, height)) {
      p.x = x.x;
      p.y = x.y;
    }
    const y = { x: p.x, y: p.y + dy / steps };
    clampCircle(y);
    if (isClear(y, arena, height)) {
      p.x = y.x;
      p.y = y.y;
    }
  }
}

export function movementStep(p, input, effects, dt, time, arena) {
  const has = (name) =>
    Array.isArray(effects) ? effects.includes(name) : effects[name] > time;
  const height = jumpHeight(p, time);
  resolvePosition(p, arena, height);
  if (has("ice")) return;
  let x = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(x, y) || 1;
  x /= length;
  y /= length;
  if (has("slip")) {
    x = p.slipVector?.x || 0;
    y = p.slipVector?.y || 0;
  } else if (has("invert")) {
    x *= -1;
    y *= -1;
  }
  const speed = SPEED * (has("slow") ? 0.6 : 1);
  moveWithCollisions(
    p,
    (x * speed * dt) / 1000,
    (y * speed * dt) / 1000,
    arena,
    height,
  );
}
