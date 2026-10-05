import { FINAL_CALM_MS } from "../public/shared/systems/arena.js";
import { gateStates } from "../public/shared/systems/gates.js";
import { zonesAtTime } from "../public/shared/systems/zones.js";
import { laserAtTime, laserTouches } from "../public/shared/systems/laser.js";
import { movementStep } from "../public/shared/systems/collision.js";
import { updateEffects } from "./powers.js";

export function arenaState(room, active = room.phase === "ROUND_ACTIVE") {
  const elapsed = active ? Math.max(0, room.time - room.roundStartedAt) : 0;
  const calm = !active || room.remaining <= FINAL_CALM_MS;
  return {
    elapsed,
    calm,
    zones: zonesAtTime(room.round, room.sudden, elapsed),
    laser: laserAtTime(room.round, elapsed, calm),
    gates: gateStates(elapsed, calm, room.alive(), room.arena?.gates),
  };
}

export function advanceArena(room, duration, now) {
  // Substeps handle both the moving beam and swept player collisions at 5/10 Hz.
  let rest = duration;
  while (rest > 0) {
    const dt = Math.min(rest, 20);
    room.time += dt;
    room.remaining -= dt;
    rest -= dt;
    room.arena = arenaState(room);
    for (const p of room.alive()) {
      p.stats.survivalMs += dt;
      if (now - p.lastInputAt > 1000 || !p.socketId) p.input = {};
      movementStep(p, p.input, p.effects, dt, room.time, room.arena);
    }
    updateEffects(room, dt);
    for (const p of room.alive()) {
      if (room.arena.calm) {
        delete p.effects.slow;
        continue;
      }
      if (
        p.laserImmuneUntil <= room.time &&
        laserTouches(p, room.arena.laser, room.time)
      ) {
        p.effects.slow = room.time + 1000;
        p.laserImmuneUntil = room.time + 1500;
        p.laserHitAt = room.time;
      }
    }
  }
}
