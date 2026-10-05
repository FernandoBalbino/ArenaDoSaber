import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { Rooms } from "./rooms.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const readQuestions = () =>
  JSON.parse(
    readFileSync(new URL("../data/questions.json", import.meta.url), "utf8"),
  );
export function createApp({
  questions = readQuestions(),
  tickRate = Number(process.env.TICK_RATE) || 10,
  maxRooms = Number(process.env.MAX_ROOMS) || 5,
  autoTick = true,
} = {}) {
  tickRate = tickRate === 5 ? 5 : 10;
  const app = express(),
    http = createServer(app),
    io = new Server(http, {
      maxHttpBufferSize: 8192,
      perMessageDeflate: { threshold: 1024 },
      serveClient: true,
      allowRequest: (req, cb) => {
        const origin = req.headers.origin;
        let allowed = !origin;
        try {
          allowed ||= new URL(origin).host === req.headers.host;
        } catch {}
        cb(null, allowed);
      },
    });
  const rooms = new Rooms(questions, { maxRooms }),
    lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  const metrics = {
    received: 0,
    snapshots: 0,
    connections: 0,
    peakConnections: 0,
  };
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
  app.get("/vendor/phaser.min.js", (_req, res) =>
    res.sendFile(root + "node_modules/phaser/dist/phaser.min.js"),
  );
  app.use(
    express.static(root + "public", {
      maxAge: "1h",
      setHeaders(res, path) {
        if (/\.(html|js|css)$/.test(path))
          res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  app.use((_req, res) => res.status(404).send("Página não encontrada."));
  const diagnostics = () => ({
    tickRate,
    connections: io.engine.clientsCount,
    peakConnections: metrics.peakConnections,
    messagesReceived: metrics.received,
    snapshots: metrics.snapshots,
    rssMB: Math.round((process.memoryUsage().rss / 1048576) * 10) / 10,
    eventLoopP95Ms: Math.round((lag.percentile(95) / 1e6) * 10) / 10,
    rooms: rooms.rooms.size,
  });
  function publish(room, full = true) {
    if (full) {
      io.to(room.code).emit("room:state", room.snapshot());
      for (const p of room.players.values())
        if (p.socketId)
          io.to(p.socketId).emit("player:private", room.privateDTO(p));
      room.sentRevision = room.revision;
    } else
      io.to(room.code).volatile.emit("room:frame", {
        time: room.time,
        remaining: room.remaining,
        paused: room.paused,
        arena: room.arena,
        players: [...room.players.values()].map((p) => [
          p.id,
          Math.round(p.x),
          Math.round(p.y),
          Object.keys(p.effects).filter((k) => p.effects[k] > room.time),
          p.teleport,
          p.jumpStartedAt,
          p.jumpReadyAt,
          p.laserHitAt ?? null,
          p.slipVector,
        ]),
        objects: room.snapshot().objects,
        lastPower: room.lastPower,
      });
    metrics.snapshots++;
  }
  io.on("connection", (socket) => {
    metrics.connections++;
    metrics.peakConnections = Math.max(
      metrics.peakConnections,
      io.engine.clientsCount,
    );
    let bucket = { at: Date.now(), count: 0 },
      lastChat = -Infinity,
      createCount = 0;
    const context = () => {
      const room = rooms.get(socket.data.code);
      const p = room.players.get(socket.data.playerId);
      return { room, p };
    };
    const teacher = () => {
      const { room } = context();
      if (socket.data.role !== "teacher" || room.adminSocket !== socket.id)
        throw Error("Esta ação é exclusiva do professor.");
      return room;
    };
    const participant = () => {
      const { room, p } = context();
      if (!p || p.socketId !== socket.id)
        throw Error("Entre na sala como jogador.");
      return { room, p };
    };
    const attach = (room, role, p) => {
      socket.data = { code: room.code, role, playerId: p?.id };
      socket.join(room.code);
      socket.emit("chat:history", room.chat);
    };
    const handler = (event, fn) =>
      socket.on(event, (data = {}, ack) => {
        if (typeof ack !== "function") ack = () => {};
        const now = Date.now();
        if (now - bucket.at >= 1000) bucket = { at: now, count: 0 };
        if (++bucket.count > 55) {
          ack({ ok: false, error: "Muitas ações. Aguarde um instante." });
          return;
        }
        metrics.received++;
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          ack({ ok: false, error: "Solicitação inválida." });
          return;
        }
        try {
          ack({ ok: true, ...fn(data, now) });
        } catch (error) {
          ack({ ok: false, error: error.message });
        }
      });
    handler("room:create", (data, now) => {
      if (socket.data.code) throw Error("Saia da sala atual primeiro.");
      if (++createCount > 3)
        throw Error("Limite de criação atingido nesta conexão.");
      const room = rooms.create(data, now);
      room.connectAdmin(socket.id);
      attach(room, "teacher");
      publish(room);
      return {
        code: room.code,
        role: "teacher",
        token: room.adminToken,
        state: room.snapshot(),
      };
    });
    handler("room:join", (data, now) => {
      if (socket.data.code) throw Error("Você já está em uma sala.");
      const room = rooms.get(String(data.code || "").toUpperCase()),
        p = room.addPlayer(data.name, socket.id, now);
      attach(room, "player", p);
      publish(room);
      return {
        code: room.code,
        role: "player",
        id: p.id,
        token: p.token,
        state: room.snapshot(),
        self: room.privateDTO(p),
      };
    });
    handler("session:resume", (data, now) => {
      if (socket.data.code) throw Error("Conexão já vinculada.");
      if (typeof data.token !== "string" || data.token.length !== 48)
        throw Error("Sessão inválida.");
      const room = rooms.get(data.code),
        result = room.resume(data.token, socket.id, now);
      attach(room, result.role, result.player);
      publish(room);
      return {
        code: room.code,
        role: result.role,
        id: result.player?.id,
        state: room.snapshot(),
        self: result.player ? room.privateDTO(result.player) : null,
      };
    });
    handler("player:input", (data, now) => {
      const { room, p } = participant();
      room.input(p, data, now);
    });
    handler("player:jump", (data) => {
      const { room, p } = participant();
      room.jump(p, data);
      return { jumpStartedAt: p.jumpStartedAt, jumpReadyAt: p.jumpReadyAt };
    });
    handler("power:choose", (data) => {
      const { room, p } = participant();
      room.choose(p, data.id);
      socket.emit("player:private", room.privateDTO(p));
    });
    handler("power:use", (data) => {
      if (Object.keys(data).some((k) => k !== "targetId"))
        throw Error("Solicitação de poder inválida.");
      const { room, p } = participant();
      room.use(p, data.targetId);
      publish(room);
    });
    handler("teacher:action", (data) => {
      const room = teacher();
      switch (data.action) {
        case "start":
          room.start();
          break;
        case "pause":
          if (!["LOBBY", "GAME_OVER"].includes(room.phase)) {
            room.paused = true;
            for (const p of room.players.values()) p.input = {};
          }
          break;
        case "resume":
          room.paused = false;
          break;
        case "skip":
          room.skip();
          break;
        case "end":
          room.finish("teacher");
          break;
        case "muteRoom":
          room.chatMuted = !room.chatMuted;
          break;
        case "clearChat":
          room.chat = [];
          io.to(room.code).emit("chat:history", []);
          break;
        case "mute": {
          const p = room.players.get(data.id);
          if (!p) throw Error("Jogador não encontrado.");
          p.muted = !p.muted;
          break;
        }
        case "kick": {
          const p = room.players.get(data.id);
          if (!p) throw Error("Jogador não encontrado.");
          if (p.socketId) {
            const s = io.sockets.sockets.get(p.socketId);
            s?.emit("session:ended", {
              message: "O professor removeu você da sala.",
            });
            s?.leave(room.code);
            if (s) s.data = {};
          }
          room.remove(p.id);
          break;
        }
        default:
          throw Error("Ação desconhecida.");
      }
      room.revision++;
      publish(room);
    });
    handler("chat:send", (data, now) => {
      const { room, p } = context();
      if (socket.data.role !== "teacher" && (!p || p.muted || room.chatMuted))
        throw Error("O chat está silenciado.");
      if (now - lastChat < 1000)
        throw Error("Aguarde um segundo entre mensagens.");
      if (typeof data.text !== "string") throw Error("Mensagem inválida.");
      const text = data.text.trim();
      if (!text || text.length > 150)
        throw Error("Escreva de 1 a 150 caracteres.");
      lastChat = now;
      room.chat.push({
        id: room.nextObject++,
        name: p?.name || "Professor",
        teacher: socket.data.role === "teacher",
        text,
      });
      room.chat = room.chat.slice(-80);
      io.to(room.code).emit("chat:history", room.chat);
    });
    handler("diagnostics", () => {
      teacher();
      return { metrics: diagnostics() };
    });
    handler("ping:check", () => ({ serverTime: Date.now() }));
    handler("session:leave", () => {
      const { room, p } = context();
      if (p) room.remove(p.id);
      else room.disconnect(socket.id, Date.now());
      socket.leave(room.code);
      socket.data = {};
      publish(room);
    });
    socket.on("disconnect", () => {
      if (socket.data.code) {
        const room = rooms.rooms.get(socket.data.code);
        room?.disconnect(socket.id, Date.now());
        if (room) publish(room);
      }
    });
  });
  let last = Date.now();
  function tick(dt = 1000 / tickRate, now = Date.now()) {
    for (const room of rooms.rooms.values()) {
      room.tick(dt, now);
      room.frames = (room.frames || 0) + 1;
      publish(
        room,
        room.frames % tickRate === 0 || room.sentRevision !== room.revision,
      );
    }
    rooms.cleanup(now);
  }
  const interval = autoTick
    ? setInterval(() => {
        const now = Date.now();
        tick(Math.min(now - last, 500), now);
        last = now;
      }, 1000 / tickRate)
    : null;
  const close = async () => {
    clearInterval(interval);
    lag.disable();
    await new Promise((resolve) => io.close(resolve));
  };
  return { app, http, io, rooms, tick, close, diagnostics };
}
