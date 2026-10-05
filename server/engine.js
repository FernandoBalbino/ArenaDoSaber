import { randomBytes, randomUUID } from "node:crypto";
import { CATEGORIES, SHIRTS, POWERS, zoneAt } from "../public/shared/rules.js";
import { MAX_LIVES } from "../public/shared/systems/arena.js";
import { JUMP_COOLDOWN, resetJump } from "../public/shared/systems/jump.js";
import { arenaState, advanceArena } from "./arena-system.js";
import { usePower } from "./powers.js";
export const DURATIONS = {
  POWER_SELECTION: 20000,
  ROUND_COUNTDOWN: 3000,
  ROUND_ACTIVE: 60000,
  ROUND_LOCKED: 100,
  ROUND_RESULT: 6000,
};
const token = () => randomBytes(24).toString("hex");
export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const blankStats = () => ({
  rounds: 0,
  correct: 0,
  powers: 0,
  affected: 0,
  survivalMs: 0,
  placement: null,
  eliminationRound: null,
});
export class Room {
  constructor(
    code,
    questions,
    {
      capacity = 24,
      categories = Object.keys(CATEGORIES),
      rng = Math.random,
      now = Date.now(),
    } = {},
  ) {
    this.code = code;
    this.questions = questions;
    this.rng = rng;
    this.capacity = capacity;
    this.categories = categories;
    this.adminToken = token();
    this.adminSocket = null;
    this.adminDisconnectedAt = now;
    this.players = new Map();
    this.records = [];
    this.phase = "LOBBY";
    this.paused = false;
    this.time = 0;
    this.remaining = 0;
    this.round = 0;
    this.normalRounds = 0;
    this.usedQuestions = new Set();
    this.sudden = false;
    this.question = null;
    this.answer = null;
    this.result = null;
    this.objects = [];
    this.nextObject = 1;
    this.lastPower = null;
    this.chat = [];
    this.chatMuted = false;
    this.emptySince = null;
    this.createdAt = now;
    this.revision = 0;
    this.roundStartedAt = 0;
    this.arena = arenaState(this);
  }
  connectAdmin(socketId) {
    this.adminSocket = socketId;
    this.adminDisconnectedAt = null;
    this.emptySince = null;
  }
  addPlayer(name, socketId, now) {
    name = String(name ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!name || name.length > 25 || /[\u0000-\u001f\u007f]/u.test(name))
      throw Error("Informe um nome entre 1 e 25 caracteres.");
    if (
      [...this.players.values()].some(
        (p) =>
          p.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      )
    )
      throw Error("Este nome já está na sala. Use outro nome.");
    if (this.players.size >= this.capacity)
      throw Error("Esta sala está cheia.");
    const occupied = new Set(
      [...this.players.values()].map((p) => p.appearance.shirt),
    );
    const shirt = shuffle(
      SHIRTS.filter((c) => !occupied.has(c)),
      this.rng,
    )[0];
    const waiting = !["LOBBY", "GAME_OVER"].includes(this.phase);
    const p = {
      id: randomUUID(),
      token: token(),
      name,
      socketId,
      disconnectedAt: null,
      alive: !waiting,
      waiting,
      muted: false,
      x: 0,
      y: 0,
      input: {},
      inputSeq: -1,
      lastInputAt: now,
      teleport: 0,
      effects: {},
      power: null,
      offered: [],
      used: false,
      affected: new Set(),
      stats: blankStats(),
      appearance: {
        shirt,
        skin: Math.floor(this.rng() * 6),
        hair: Math.floor(this.rng() * 5),
        accessory: Math.floor(this.rng() * 4),
      },
    };
    p.lives = MAX_LIVES;
    p.jumpSeq = -1;
    resetJump(p);
    this.players.set(p.id, p);
    this.emptySince = null;
    this.revision++;
    return p;
  }
  resume(tokenValue, socketId, now) {
    if (tokenValue === this.adminToken) {
      if (this.adminSocket && this.adminSocket !== socketId)
        throw Error("Professor já conectado em outra aba.");
      this.connectAdmin(socketId);
      return { role: "teacher" };
    }
    const p = [...this.players.values()].find((p) => p.token === tokenValue);
    if (!p || (p.disconnectedAt !== null && now - p.disconnectedAt >= 60000))
      throw Error("Sua reserva expirou. Entre novamente.");
    if (p.socketId && p.socketId !== socketId)
      throw Error("Você já está conectado em outra aba.");
    p.socketId = socketId;
    p.disconnectedAt = null;
    p.input = {};
    p.inputSeq = -1;
    p.jumpSeq = -1;
    p.lastInputAt = now;
    this.emptySince = null;
    return { role: "player", player: p };
  }
  disconnect(socketId, now) {
    if (this.adminSocket === socketId) {
      this.adminSocket = null;
      this.adminDisconnectedAt = now;
    }
    for (const p of this.players.values())
      if (p.socketId === socketId) {
        p.socketId = null;
        p.disconnectedAt = now;
        p.input = {};
      }
  }
  remove(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.records.push({ ...this.playerDTO(p), abandoned: true });
    this.players.delete(id);
    this.revision++;
  }
  start() {
    if (!["LOBBY", "GAME_OVER"].includes(this.phase))
      throw Error("A partida já está em andamento.");
    if ([...this.players.values()].filter((p) => p.socketId).length < 2)
      throw Error("Aguarde pelo menos dois alunos.");
    if (!this.adminSocket) throw Error("Professor desconectado.");
    this.time = 0;
    this.round = 0;
    this.normalRounds = 0;
    this.sudden = false;
    this.paused = false;
    this.usedQuestions.clear();
    this.records = [];
    this.result = null;
    this.lastPower = null;
    this.winnerIds = [];
    this.finishReason = null;
    for (const p of this.players.values()) {
      p.alive = !!p.socketId;
      p.lives = MAX_LIVES;
      p.waiting = false;
      p.stats = blankStats();
      p.effects = {};
      p.affected.clear();
      resetJump(p);
    }
    this.nextRound();
  }
  nextRound() {
    for (const p of this.players.values())
      if (p.waiting) {
        p.waiting = false;
        p.alive = true;
      }
    if (!this.alive().length) {
      this.finish("cancelled");
      return;
    }
    if (this.normalRounds >= 30) this.sudden = true;
    let available = this.questions.filter(
      (q) =>
        this.categories.includes(q.category) &&
        q.difficult === this.sudden &&
        !this.usedQuestions.has(q.id),
    );
    if (!available.length && !this.sudden) {
      this.sudden = true;
      available = this.questions.filter(
        (q) =>
          this.categories.includes(q.category) &&
          q.difficult &&
          !this.usedQuestions.has(q.id),
      );
    }
    if (!available.length) {
      this.finish("exhausted");
      return;
    }
    const q = shuffle(available, this.rng)[0];
    const order = shuffle([0, 1, 2, 3], this.rng);
    this.question = {
      id: q.id,
      category: q.category,
      text: q.text,
      options: order.map((i) => q.options[i]),
    };
    this.answer = {
      index: order.indexOf(q.correctIndex),
      explanation: q.explanation,
    };
    this.usedQuestions.add(q.id);
    this.round++;
    if (!this.sudden) this.normalRounds++;
    this.result = null;
    this.clearEffects();
    this.arena = arenaState(this, false);
    const alive = this.alive();
    alive.forEach((p, i) => {
      const a = (i / alive.length) * Math.PI * 2;
      p.x = Math.cos(a) * 90;
      p.y = Math.sin(a) * 90;
      p.teleport++;
      p.input = {};
      p.offered = this.sudden
        ? []
        : shuffle(POWERS, this.rng)
            .slice(0, 2)
            .map((p) => p.id);
      p.power = null;
      p.used = false;
      p.affected.clear();
    });
    this.setPhase(this.sudden ? "ROUND_COUNTDOWN" : "POWER_SELECTION");
  }
  alive() {
    return [...this.players.values()].filter((p) => p.alive && !p.waiting);
  }
  setPhase(phase) {
    this.phase = phase;
    this.remaining =
      phase === "ROUND_ACTIVE" && this.sudden ? 20000 : DURATIONS[phase] || 0;
    if (phase === "ROUND_ACTIVE") {
      this.roundStartedAt = this.time;
      this.arena = arenaState(this);
    }
    this.revision++;
  }
  clearEffects() {
    this.objects = [];
    this.lastPower = null;
    for (const p of this.players.values()) {
      p.effects = {};
      p.input = {};
      resetJump(p);
    }
  }
  choose(p, id) {
    if (
      this.paused ||
      this.phase !== "POWER_SELECTION" ||
      !p.alive ||
      p.waiting ||
      !p.offered.includes(id)
    )
      throw Error("Escolha um dos poderes oferecidos nesta rodada.");
    p.power = id;
  }
  input(p, data, now) {
    if (
      !Number.isSafeInteger(data.seq) ||
      data.seq < 0 ||
      data.seq <= p.inputSeq
    )
      return;
    p.inputSeq = data.seq;
    p.lastInputAt = now;
    p.input = {
      up: data.up === true,
      down: data.down === true,
      left: data.left === true,
      right: data.right === true,
    };
  }
  use(p, targetId) {
    usePower(this, p, targetId);
  }
  jump(p, data) {
    if (
      Object.keys(data).some((k) => k !== "seq") ||
      !Number.isSafeInteger(data.seq) ||
      data.seq < 0
    )
      throw Error("Solicitação de pulo inválida.");
    if (data.seq <= p.jumpSeq) return;
    p.jumpSeq = data.seq;
    if (
      this.paused ||
      this.phase !== "ROUND_ACTIVE" ||
      !p.alive ||
      p.waiting ||
      !p.socketId ||
      p.effects.ice > this.time ||
      p.jumpReadyAt > this.time
    )
      throw Error("Pulo indisponível neste momento.");
    p.jumpStartedAt = this.time;
    p.jumpReadyAt = this.time + JUMP_COOLDOWN;
  }
  skip() {
    if (["LOBBY", "GAME_OVER"].includes(this.phase))
      throw Error("Inicie a partida primeiro.");
    this.clearEffects();
    this.nextRound();
  }
  finish(reason = "finished") {
    this.clearEffects();
    this.phase = "GAME_OVER";
    this.remaining = 0;
    this.paused = false;
    this.finishReason = reason;
    const winners = ["cancelled", "all_eliminated"].includes(reason)
      ? []
      : this.alive();
    for (const p of winners) p.stats.placement = 1;
    this.winnerIds = winners.map((p) => p.id);
    this.revision++;
  }
  evaluate() {
    if (this.result) return; // Results and life losses are committed once per round.
    const choices = this.alive().map((p) => ({
      id: p.id,
      zone: zoneAt(p.x, p.y, this.arena.zones.angle),
      livesBefore: p.lives,
    }));
    for (const choice of choices) {
      const p = this.players.get(choice.id),
        correct = choice.zone === this.answer.index;
      p.stats.rounds++;
      if (correct) p.stats.correct++;
      else p.lives = Math.max(0, p.lives - 1);
      p.alive = p.lives > 0;
      Object.assign(choice, {
        correct,
        livesAfter: p.lives,
        lostLife: !correct,
        eliminated: !p.alive,
      });
      if (!p.alive) p.stats.eliminationRound = this.round;
    }
    const survivors = this.alive().length;
    for (const choice of choices)
      if (choice.eliminated)
        this.players.get(choice.id).stats.placement = survivors
          ? survivors + 1
          : null;
    this.result = {
      choices,
      correctIndex: this.answer.index,
      explanation: this.answer.explanation,
      allWrong: choices.every((c) => !c.correct),
      allEliminated: survivors === 0,
    };
    this.clearEffects();
  }
  tick(dt, now) {
    for (const p of [...this.players.values()])
      if (p.disconnectedAt !== null && now - p.disconnectedAt >= 60000)
        this.remove(p.id);
    if (
      !this.adminSocket &&
      this.adminDisconnectedAt !== null &&
      now - this.adminDisconnectedAt >= 5000 &&
      !["LOBBY", "GAME_OVER"].includes(this.phase)
    )
      this.paused = true;
    if (
      !this.adminSocket &&
      ![...this.players.values()].some((p) => p.socketId)
    ) {
      this.emptySince ??= now;
    } else this.emptySince = null;
    if (
      !["LOBBY", "GAME_OVER", "ROUND_LOCKED", "ROUND_RESULT"].includes(
        this.phase,
      ) &&
      !this.alive().length &&
      ![...this.players.values()].some((p) => p.waiting)
    ) {
      this.finish("cancelled");
      return;
    }
    if (this.paused || ["LOBBY", "GAME_OVER"].includes(this.phase)) return;
    const step = Math.min(Math.max(0, dt), this.remaining);
    if (this.phase === "ROUND_ACTIVE") advanceArena(this, step, now);
    else {
      this.time += step;
      this.remaining -= step;
    }
    if (this.remaining <= 0)
      switch (this.phase) {
        case "POWER_SELECTION":
          for (const p of this.alive())
            p.power ??= shuffle(p.offered, this.rng)[0];
          this.setPhase("ROUND_COUNTDOWN");
          break;
        case "ROUND_COUNTDOWN":
          this.setPhase("ROUND_ACTIVE");
          break;
        case "ROUND_ACTIVE":
          this.setPhase("ROUND_LOCKED");
          this.evaluate();
          break;
        case "ROUND_LOCKED":
          this.setPhase("ROUND_RESULT");
          break;
        case "ROUND_RESULT":
          if (this.alive().length <= 1)
            this.finish(
              this.alive().length
                ? "finished"
                : this.result?.allEliminated
                  ? "all_eliminated"
                  : "cancelled",
            );
          else this.nextRound();
          break;
      }
  }
  playerDTO(p) {
    return {
      id: p.id,
      name: p.name,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      alive: p.alive,
      lives: p.lives,
      jumpStartedAt: p.jumpStartedAt,
      jumpReadyAt: p.jumpReadyAt,
      laserHitAt: p.laserHitAt ?? null,
      slipVector: p.slipVector,
      waiting: p.waiting,
      connected: !!p.socketId,
      muted: p.muted,
      appearance: { ...p.appearance },
      effects: Object.keys(p.effects).filter((k) => p.effects[k] > this.time),
      teleport: p.teleport,
      stats: { ...p.stats },
    };
  }
  snapshot() {
    const reveal = ["ROUND_LOCKED", "ROUND_RESULT", "GAME_OVER"].includes(
      this.phase,
    );
    return {
      maxLives: MAX_LIVES,
      arena: this.arena,
      code: this.code,
      capacity: this.capacity,
      categories: this.categories,
      phase: this.phase,
      paused: this.paused,
      time: this.time,
      remaining: this.remaining,
      round: this.round,
      normalRounds: this.normalRounds,
      sudden: this.sudden,
      revision: this.revision,
      teacherConnected: !!this.adminSocket,
      chatMuted: this.chatMuted,
      players: [...this.players.values()].map((p) => this.playerDTO(p)),
      question: [
        "ROUND_ACTIVE",
        "ROUND_LOCKED",
        "ROUND_RESULT",
        "GAME_OVER",
      ].includes(this.phase)
        ? this.question
        : null,
      result: reveal ? this.result : null,
      objects: this.objects
        .filter((o) => o.until > this.time)
        .map(({ id, kind, owner, x, y }) => ({ id, kind, owner, x, y })),
      lastPower: this.lastPower,
      finishReason: this.finishReason || null,
      winnerIds: this.winnerIds || [],
      records: this.phase === "GAME_OVER" ? this.records : [],
    };
  }
  privateDTO(p) {
    return {
      id: p.id,
      offered: p.offered,
      power: p.power,
      used: p.used,
      inputSeq: p.inputSeq,
      jumpSeq: p.jumpSeq,
    };
  }
}
