import { POWER, direction } from "../public/shared/rules.js";
import {
  TARGET_RANGE,
  AREA_RANGE,
  PUSH_DISTANCE,
} from "../public/shared/systems/arena.js";
import {
  moveWithCollisions,
  resolvePosition,
} from "../public/shared/systems/collision.js";
import { jumpHeight } from "../public/shared/systems/jump.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function push(room, a, b, amount) {
  const d = distance(a, b) || 1;
  let x = (b.x - a.x) / d,
    y = (b.y - a.y) / d;
  if (x === 0 && y === 0) y = -1;
  moveWithCollisions(
    b,
    x * amount,
    y * amount,
    room.arena,
    jumpHeight(b, room.time),
  );
  b.teleport++;
}
export function usePower(room, actor, targetId) {
  if (
    room.paused ||
    room.phase !== "ROUND_ACTIVE" ||
    room.remaining <= 2000 ||
    !actor.alive ||
    actor.waiting ||
    actor.used ||
    !actor.power ||
    room.sudden
  )
    throw Error("Poder indisponível neste momento.");
  const power = POWER[actor.power];
  let target;
  if (power.target) {
    target = room.players.get(targetId);
    if (!target || !target.alive || target.waiting || target.id === actor.id)
      throw Error("Escolha outro jogador vivo desta sala.");
    if (power.id !== "swap" && distance(actor, target) > TARGET_RANGE)
      throw Error("Este jogador está fora do alcance. Aproxime-se.");
  }
  const effect = (p, type, duration) => {
    p.effects[type] = room.time + duration;
  };
  const affected = new Set();
  if (target) affected.add(target.id);
  switch (power.id) {
    case "banana":
      room.objects.push({
        id: room.nextObject++,
        kind: "banana",
        owner: actor.id,
        x: actor.x,
        y: actor.y,
        until: Infinity,
      });
      break;
    case "invert":
      effect(target, "invert", 4000);
      break;
    case "push":
      push(room, actor, target, PUSH_DISTANCE);
      break;
    case "swap": {
      const x = actor.x,
        y = actor.y;
      actor.x = target.x;
      actor.y = target.y;
      target.x = x;
      target.y = y;
      resolvePosition(actor, room.arena, jumpHeight(actor, room.time));
      resolvePosition(target, room.arena, jumpHeight(target, room.time));
      actor.teleport++;
      target.teleport++;
      break;
    }
    case "ice":
      effect(target, "ice", 2000);
      break;
    case "head":
      effect(target, "head", 4000);
      break;
    case "confuse":
      effect(target, "confuse", 4000);
      break;
    case "smoke":
      room.objects.push({
        id: room.nextObject++,
        kind: "smoke",
        owner: actor.id,
        x: actor.x,
        y: actor.y,
        until: room.time + 4000,
      });
      break;
    case "magnet":
      effect(actor, "magnet", 3000);
      break;
    case "blast":
      for (const p of room.players.values())
        if (
          p.alive &&
          !p.waiting &&
          p.id !== actor.id &&
          distance(actor, p) <= AREA_RANGE
        ) {
          push(room, actor, p, PUSH_DISTANCE);
          affected.add(p.id);
        }
      break;
  }
  actor.used = true;
  actor.stats.powers++;
  for (const id of affected) markAffected(actor, id);
  room.lastPower = {
    id: room.nextObject++,
    kind: power.id,
    actor: actor.id,
    target: target?.id || null,
    x: actor.x,
    y: actor.y,
    time: room.time,
  };
}
function markAffected(actor, id) {
  if (!actor.affected.has(id)) {
    actor.affected.add(id);
    actor.stats.affected++;
  }
}
export function updateEffects(room, dt) {
  for (const p of room.players.values())
    for (const [k, until] of Object.entries(p.effects))
      if (until <= room.time) delete p.effects[k];
  room.objects = room.objects.filter((o) => o.until > room.time);
  for (const o of room.objects) {
    for (const p of room.players.values()) {
      if (!p.alive || p.waiting || p.id === o.owner) continue;
      if (
        o.kind === "banana" &&
        distance(p, o) < 58 &&
        jumpHeight(p, room.time) <= 26
      ) {
        p.effects.slip = room.time + 1500;
        const d = direction(p.input);
        p.slipVector = d.x || d.y ? d : { x: 1, y: 0 };
        o.until = 0;
        const a = room.players.get(o.owner);
        if (a) markAffected(a, p.id);
        break;
      }
      if (o.kind === "smoke" && distance(p, o) <= AREA_RANGE) {
        const a = room.players.get(o.owner);
        if (a) markAffected(a, p.id);
      }
    }
  }
  for (const a of room.players.values())
    if (a.alive && a.effects.magnet > room.time)
      for (const p of room.players.values())
        if (
          p.alive &&
          !p.waiting &&
          p.id !== a.id &&
          distance(a, p) <= AREA_RANGE
        ) {
          const d = distance(a, p) || 1;
          moveWithCollisions(
            p,
            (((a.x - p.x) / d) * 140 * dt) / 1000,
            (((a.y - p.y) / d) * 140 * dt) / 1000,
            room.arena,
            jumpHeight(p, room.time),
          );
          markAffected(a, p.id);
        }
}
