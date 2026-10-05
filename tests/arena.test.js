import test from "node:test";
import assert from "node:assert/strict";
import { Room } from "../server/engine.js";
import { readFileSync } from "node:fs";
import { RADIUS, PLAYER_RADIUS } from "../public/shared/systems/arena.js";
import { GATES, gateStates } from "../public/shared/systems/gates.js";
import { OBSTACLES } from "../public/shared/systems/obstacles.js";
import {
  moveWithCollisions,
  isClear,
  resolvePosition,
  overlaps,
} from "../public/shared/systems/collision.js";
import { jumpHeight } from "../public/shared/systems/jump.js";
import { zoneAt, zonesAtTime } from "../public/shared/systems/zones.js";
import { laserAtTime, laserTouches } from "../public/shared/systems/laser.js";
const questions = JSON.parse(
  readFileSync(new URL("../data/questions.json", import.meta.url)),
);
function fixture() {
  const room = new Room("ABCDE", questions, { now: 0, rng: () => 0.4 });
  room.connectAdmin("t");
  const a = room.addPlayer("Ana", "a", 0),
    b = room.addPlayer("Bia", "b", 0);
  room.start();
  room.tick(20000, 0);
  room.tick(3000, 0);
  return { room, a, b };
}
function lock(room) {
  room.tick(room.remaining, 0);
  assert.equal(room.phase, "ROUND_LOCKED");
  room.tick(100, 0);
  assert.equal(room.phase, "ROUND_RESULT");
}
const empty = { gates: [] };

test("vidas: todo erro coletivo desconta, resultado é idempotente e a terceira perda termina sem campeão", () => {
  const { room, a, b } = fixture();
  for (let remaining = 2; remaining >= 0; remaining--) {
    a.x = b.x = 0;
    a.y = b.y = 0;
    lock(room);
    assert.equal(a.lives, remaining);
    assert.equal(b.lives, remaining);
    assert.equal(room.result.allWrong, true);
    room.evaluate();
    assert.equal(a.lives, remaining);
    room.tick(6000, 0);
    if (remaining) {
      room.tick(20000, 0);
      room.tick(3000, 0);
    }
  }
  assert.equal(room.phase, "GAME_OVER");
  assert.equal(room.finishReason, "all_eliminated");
  assert.deepEqual(room.winnerIds, []);
  room.start();
  assert.equal(a.lives, 3);
  assert.equal(b.lives, 3);
  assert.equal(a.alive, true);
});

test("acerto preserva vidas, reconexão não restaura, atrasado recebe três e pergunta pulada não desconta", () => {
  const { room, a } = fixture();
  a.lives = 2;
  room.answer.index = 0;
  a.x = 0;
  a.y = -190;
  lock(room);
  assert.equal(a.lives, 2);
  room.disconnect("a", 0);
  room.resume(a.token, "a2", 200);
  assert.equal(a.lives, 2);
  const late = room.addPlayer("Caio", "c", 200);
  assert.equal(late.waiting, true);
  assert.equal(late.lives, 3);
  room.skip();
  assert.equal(late.waiting, false);
  assert.equal(a.lives, 2);
  a.alive = false;
  a.lives = 0;
  room.disconnect("a2", 300);
  room.resume(a.token, "a3", 400);
  assert.equal(a.lives, 0);
  assert.equal(a.alive, false);
});

test("morte súbita conserva vidas e cada erro custa somente uma", () => {
  const { room, a } = fixture();
  a.lives = 2;
  room.normalRounds = 30;
  room.nextRound();
  assert.equal(room.sudden, true);
  assert.equal(a.lives, 2);
  room.tick(3000, 0);
  assert.equal(room.remaining, 20000);
  a.x = a.y = 0;
  lock(room);
  assert.equal(a.lives, 1);
  assert.equal(a.alive, true);
});

test("geometria rotativa acompanha letras, divisórias e avaliação oficial", () => {
  const { room, a, b } = fixture();
  room.skip();
  room.tick(20000, 0);
  room.tick(3000, 0);
  room.answer.index = 0;
  assert.equal(room.round, 2);
  room.tick(24000, 0);
  assert.equal(room.arena.zones.rotating, true);
  assert.equal(zoneAt(190, 0, Math.PI / 2), 0);
  assert.equal(zoneAt(0, -190, Math.PI / 2), 3);
  room.tick(31000, 0);
  a.x = 190;
  a.y = 0;
  b.x = 0;
  b.y = -190;
  lock(room);
  assert.equal(a.lives, 3);
  assert.equal(b.lives, 2);
  assert.equal(room.result.choices[0].zone, 0);
  assert.equal(zonesAtTime(4, false, 28000).angle, -Math.PI / 2);
  assert.equal(zonesAtTime(2, true, 28000).angle, 0);
});

test("portas: pelo menos duas abertas, aviso, fechamento adiado e finais livres", () => {
  for (let time = 0; time < 36000; time += 50)
    assert.ok(gateStates(time, false, []).filter((g) => !g.closed).length >= 2);
  assert.equal(gateStates(6500, false, [])[0].warning, true);
  assert.equal(gateStates(7500, false, [{ ...GATES[0] }])[0].closed, false);
  assert.equal(gateStates(7500, false, [])[0].closed, true);
  assert.ok(gateStates(7500, true, []).every((g) => !g.closed && !g.warning));
});

test("colisão: pilares bloqueiam movimento longo, barreiras baixas permitem salto e aterrissagem é segura", () => {
  const pillar = OBSTACLES[0],
    low = OBSTACLES[1];
  const p = { x: pillar.x - 200, y: pillar.y };
  moveWithCollisions(p, 450, 0, empty, 90);
  assert.ok(p.x < pillar.x);
  assert.ok(isClear(p, empty, 90));
  const grounded = { x: low.x, y: low.y - 120 };
  moveWithCollisions(grounded, 0, 240, empty);
  assert.ok(grounded.y < low.y);
  const jumping = { x: low.x, y: low.y - 120 };
  moveWithCollisions(jumping, 0, 240, empty, 90);
  assert.ok(jumping.y > low.y);
  const landing = { x: low.x, y: low.y };
  resolvePosition(landing, empty);
  assert.equal(isClear(landing, empty), true);
  const edge = { x: 0, y: 0 };
  moveWithCollisions(edge, 2000, 0, empty, 90);
  assert.ok(Math.hypot(edge.x, edge.y) <= RADIUS - PLAYER_RADIUS + 0.001);
});

test("portas fechadas bloqueiam mesmo durante o pulo e abertas permitem passagem", () => {
  const g = GATES[0],
    normal = { x: -Math.sin(g.angle), y: Math.cos(g.angle) };
  const start = { x: g.x - normal.x * 120, y: g.y - normal.y * 120 };
  const p = { ...start };
  moveWithCollisions(
    p,
    normal.x * 240,
    normal.y * 240,
    { gates: [{ closed: true }] },
    90,
  );
  assert.ok((p.x - g.x) * normal.x + (p.y - g.y) * normal.y < 0);
  assert.equal(overlaps(p, g, 90), false);
  const q = { ...start };
  moveWithCollisions(q, normal.x * 240, normal.y * 240, empty, 90);
  assert.ok((q.x - g.x) * normal.x + (q.y - g.y) * normal.y > 0);
});

test("pulo validado, cooldown, sequência, pausa e reconexão conservam altura e tempo", () => {
  const { room, a } = fixture();
  room.jump(a, { seq: 1 });
  assert.ok(jumpHeight(a, room.time + 350) > 89);
  assert.throws(() => room.jump(a, { seq: 2 }), /indisponível/);
  assert.throws(() => room.jump(a, { seq: 3, height: 999 }), /inválida/);
  const start = a.jumpStartedAt;
  room.jump(a, { seq: 1 });
  assert.equal(a.jumpStartedAt, start);
  room.tick(350, 0);
  const height = jumpHeight(a, room.time),
    arena = structuredClone(room.arena);
  room.paused = true;
  room.tick(5000, 0);
  assert.deepEqual(room.arena, arena);
  assert.equal(jumpHeight(a, room.time), height);
  room.disconnect("a", 0);
  room.resume(a.token, "a2", 200);
  assert.equal(a.jumpStartedAt, start);
  room.paused = false;
  room.tick(650, 0);
  room.jump(a, { seq: 4 });
  assert.equal(a.jumpStartedAt, room.time);
  a.alive = false;
  assert.throws(() => room.jump(a, { seq: 5 }));
});

test("laser desacelera sem tirar vida, pulo evita impacto e cinco segundos finais limpam o efeito", () => {
  const { room, a, b } = fixture();
  a.x = 200;
  a.y = 0;
  b.x = b.y = 0;
  room.tick(3000, 0);
  assert.ok(a.effects.slow > room.time);
  assert.equal(a.lives, 3);
  const first = a.laserHitAt;
  room.tick(100, 0);
  assert.equal(a.laserHitAt, first);
  const beam = laserAtTime(1, 3000, false);
  assert.equal(
    laserTouches({ x: 200, y: 0, jumpStartedAt: 2650 }, beam, 3000),
    false,
  );
  room.tick(room.remaining - 5000, 0);
  assert.equal(room.arena.laser.active, false);
  assert.equal(a.effects.slow, undefined);
  assert.ok(room.arena.gates.every((g) => !g.closed));
});

test("empurrão, explosão, ímã e troca respeitam obstáculos e posições de aterrissagem", () => {
  for (const power of ["push", "blast", "magnet"]) {
    const { room, a, b } = fixture();
    a.x = 120;
    a.y = 130;
    b.x = 200;
    b.y = 130;
    a.power = power;
    if (power === "magnet") {
      a.x = 440;
      b.x = 220;
    }
    room.use(a, power === "push" ? b.id : undefined);
    if (power === "magnet") room.tick(1000, 0);
    assert.ok(isClear(b, room.arena));
    assert.ok(b.x < 330);
  }
  const { room, a, b } = fixture();
  const low = OBSTACLES[1];
  a.x = low.x;
  a.y = low.y;
  a.jumpStartedAt = room.time - 350;
  b.x = 0;
  b.y = 0;
  b.power = "swap";
  room.use(b, a.id);
  assert.ok(isClear(b, room.arena));
  assert.ok(isClear(a, room.arena));
});
