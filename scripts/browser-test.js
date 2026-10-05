import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createApp } from "../server/app.js";
import { POWERS } from "../public/shared/rules.js";
await mkdir("test-results", { recursive: true });
const app = createApp({ autoTick: false });
await new Promise((r) => app.http.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${app.http.address().port}`;
const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "chrome",
  }),
  errors = [],
  checks = [];
const contexts = [];
async function page() {
  const c = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.waitForFunction(
    () => document.querySelector("#connection").textContent === "Conectado",
  );
  return p;
}
async function pump(dt = 0) {
  for (const room of app.rooms.rooms.values()) room.revision++;
  app.tick(dt, Date.now());
  await new Promise((r) => setTimeout(r, 180));
}
async function waitFor(fn) {
  for (let i = 0; i < 40; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(fn(), "Condição de servidor não atingida");
}
try {
  const teacher = await page();
  await teacher.getByRole("tab", { name: "Sou professor" }).click();
  await teacher.getByRole("button", { name: "Criar sala" }).click();
  await teacher.locator("#game").waitFor({ state: "visible" });
  const code = (await teacher.locator("#copy-code").textContent()).trim(),
    room = app.rooms.get(code);
  const students = [];
  for (const name of ["Ana", "Bruno", "Carla"]) {
    const p = await page();
    await p.locator("#player-name").fill(name);
    await p.locator("#room-code").fill(code);
    await p.getByRole("button", { name: "Entrar na arena" }).click();
    await p.locator("#game").waitFor({ state: "visible" });
    students.push(p);
  }
  checks.push("Professor e três alunos em contextos independentes");
  const [ana, bruno] = students,
    [a, b, c] = [...room.players.values()];
  assert.equal(new Set([a, b, c].map((p) => p.appearance.shirt)).size, 3);
  await teacher
    .getByRole("button", { name: "Iniciar partida", exact: true })
    .click();
  await ana.locator("#power-selection").waitFor({ state: "visible" });
  await ana.waitForFunction(() =>
    [...document.querySelectorAll("#power-cards img")].every(
      (i) => i.complete && i.naturalWidth > 0,
    ),
  );
  await ana.screenshot({ path: "test-results/powers-1366.png" });
  const initialChoice = a.offered[0];
  await ana.locator(`[data-power="${initialChoice}"]`).click();
  await waitFor(() => a.power === initialChoice);
  await ana
    .locator(`[data-power="${initialChoice}"][aria-pressed="true"]`)
    .waitFor();
  await pump(20000);
  await pump(3000);
  assert.equal(room.phase, "ROUND_ACTIVE");
  const startX = a.x;
  await ana.keyboard.down("d");
  await new Promise((r) => setTimeout(r, 80));
  await pump(300);
  await ana.keyboard.up("d");
  assert.ok(a.x > startX);
  await ana.locator("#chat-input").focus();
  const x = a.x;
  await ana.keyboard.type("wasd e ");
  await pump(100);
  assert.equal(a.x, x);
  assert.equal(a.used, false);
  checks.push(
    "Movimento, foco de chat e bloqueio dos atalhos durante digitação",
  );
  await ana.locator("#chat-input").fill("<b>Mensagem da Ana</b>");
  await ana.getByRole("button", { name: "Enviar mensagem" }).click();
  await bruno
    .locator(".chat-message")
    .filter({ hasText: "<b>Mensagem da Ana</b>" })
    .waitFor();
  assert.equal(
    await bruno.locator('#chat-log b:has-text("Mensagem da Ana")').count(),
    0,
  );
  checks.push("Chat entre clientes, renderização como texto puro");
  await ana.locator("#chat-input").blur();
  assert.equal(await ana.locator("#life-count").textContent(), "3 de 3 vidas");
  await ana.keyboard.press("Space");
  await waitFor(() => a.jumpStartedAt !== null);
  assert.equal(a.used, false);
  const jumpAt = a.jumpStartedAt;
  await ana.keyboard.down("Space");
  await ana.keyboard.down("Space");
  await ana.keyboard.up("Space");
  assert.equal(a.jumpStartedAt, jumpAt);
  await pump(1000);
  await ana.locator("#jump-action").click();
  await waitFor(() => a.jumpStartedAt !== jumpAt);
  await ana.locator("#chat-input").focus();
  const beforeChatJump = a.jumpStartedAt;
  await ana.keyboard.type(" ");
  assert.equal(a.jumpStartedAt, beforeChatJump);
  await ana.locator("#chat-input").blur();
  checks.push(
    "Três corações, Espaço e botão pulam sem usar poder; cooldown e foco do chat",
  );
  for (const [index, power] of POWERS.entries()) {
    room.nextRound();
    a.offered = [power.id, power.id === "banana" ? "ice" : "banana"];
    await pump();
    await ana.locator(`[data-power="${power.id}"]`).click();
    await waitFor(() => a.power === power.id);
    await pump(20000);
    await pump(3000);
    a.x = -70;
    a.y = 0;
    b.x = 70;
    b.y = 0;
    c.x = 250;
    c.y = 120;
    a.teleport++;
    b.teleport++;
    c.teleport++;
    room.revision++;
    await pump();
    await ana.locator("#power-action:not([disabled])").waitFor();
    if (power.target) {
      await ana.keyboard.press("e");
      await ana.locator("#target-panel").waitFor({ state: "visible" });
      await ana.keyboard.down("e");
      await ana.keyboard.down("e");
      await ana.keyboard.up("e");
      assert.equal(a.used, false);
      await ana.keyboard.press("Escape");
      assert.equal(await ana.locator("#target-panel").isVisible(), false);
      assert.equal(a.used, false);
      await ana.locator("#power-icon").click();
      await ana.locator("#target-panel").waitFor({ state: "visible" });
      if (index === 1) {
        const bounds = await ana.locator("#arena canvas").boundingBox(),
          factor = Math.min(bounds.width / 2100, bounds.height / 2050);
        await ana.mouse.click(
          bounds.x + bounds.width / 2 + b.x * factor,
          bounds.y + bounds.height / 2 + 5 + (b.y - 60) * factor,
        );
      } else if (index === 2) {
        await ana.locator(`[data-target="${b.id}"]`).focus();
        await ana.keyboard.press("Enter");
      } else await ana.locator(`[data-target="${b.id}"]`).click();
      await ana.getByRole("button", { name: /Usar em Bruno/ }).waitFor();
      if (index % 2) await ana.keyboard.press("e");
      else await ana.getByRole("button", { name: /Usar em Bruno/ }).click();
    } else if (index % 2) await ana.keyboard.press("e");
    else await ana.locator("#power-icon").click();
    await waitFor(() => a.used);
    assert.equal(a.stats.powers, index + 1);
    await ana.waitForFunction(
      () => document.querySelector("#power-action").disabled,
    );
    checks.push(`Poder ${power.id}: escolha e ativação pela UI`);
  }
  room.nextRound();
  a.offered = ["ice", "banana"];
  await pump();
  await ana.locator('[data-power="ice"]').click();
  await pump(20000);
  await pump(3000);
  a.x = -380;
  b.x = 600;
  c.alive = false;
  room.revision++;
  await pump();
  await ana.keyboard.press("e");
  assert.equal(await ana.locator(`[data-target="${b.id}"]`).isDisabled(), true);
  assert.equal(await ana.locator(`[data-target="${c.id}"]`).count(), 0);
  assert.equal(a.used, false);
  await ana.keyboard.press("Escape");
  checks.push("Lista exclui eliminados e bloqueia alvos distantes");
  b.x = -280;
  room.revision++;
  await pump();
  await ana.keyboard.press("e");
  await ana.locator(`[data-target="${b.id}"]`).click();
  await ana.screenshot({ path: "test-results/target-1366.png" });
  await ana.keyboard.press("Escape");
  await teacher.getByRole("button", { name: "Pausar", exact: true }).click();
  const remaining = room.remaining;
  await pump(5000);
  assert.equal(room.remaining, remaining);
  await teacher.getByRole("button", { name: "Continuar", exact: true }).click();
  assert.equal(room.paused, false);
  checks.push("Pausa e retomada pelo professor");
  const appearance = { ...a.appearance },
    id = a.id;
  await ana.reload();
  await ana.locator("#game").waitFor({ state: "visible" });
  await ana.waitForFunction(
    () => document.querySelector("#connection").textContent === "Conectado",
  );
  await waitFor(() => room.players.get(id)?.socketId);
  assert.deepEqual(room.players.get(id).appearance, appearance);
  assert.equal(room.players.size, 3);
  checks.push("Atualização recupera sessão, aparência, estado e poder");
  // Inspect a moving round with authoritative state shared by all clients.
  room.nextRound();
  if (room.round % 2) room.nextRound();
  await pump();
  await pump(20000);
  await pump(3000);
  await pump(18000);
  await ana.getByText("AS ZONAS VÃO GIRAR", { exact: true }).waitFor();
  await pump(6000);
  await ana.getByText("ARENA ROTACIONANDO", { exact: true }).waitFor();
  await bruno.getByText("ARENA ROTACIONANDO", { exact: true }).waitFor();
  assert.ok(Math.abs(room.arena.zones.angle) > 0);
  checks.push("Aviso e rotação sincronizados em dois alunos");
  for (const [width, height] of [
    [1366, 768],
    [1920, 1080],
    [800, 650],
    [390, 844],
  ]) {
    await ana.setViewportSize({ width, height });
    await ana.waitForTimeout(300);
    const sizes = await ana.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      button: document.querySelector("#power-action").getBoundingClientRect()
        .height,
      canvasHeight: document.querySelector('#arena canvas').getBoundingClientRect().height,
      stageHeight: document.querySelector('#arena').getBoundingClientRect().height,
    }));
    assert.ok(sizes.scroll <= sizes.width, `Overflow em ${width}`);
    assert.ok(sizes.button >= 64);
    assert.ok(Math.abs(sizes.canvasHeight-sizes.stageHeight)<2, `Arena cortada em ${width}`);
    await ana.screenshot({
      path: `test-results/arena-${width}.png`,
      fullPage: true,
    });
    checks.push(
      `Layout ${width}×${height}: sem overflow horizontal, botão >=64 px`,
    );
    if (width === 390) {
      await ana.locator('[data-direction="right"]').scrollIntoViewIfNeeded();
      const bounds = await ana
          .locator('[data-direction="right"]')
          .boundingBox(),
        before = a.x;
      await ana.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      await ana.mouse.down();
      await waitFor(() => a.input.right === true);
      await pump(200);
      await ana.mouse.up();
      await waitFor(() => a.input.right === false);
      assert.ok(a.x > before);
      await ana.locator("#jump-action").tap();
      await waitFor(() => a.jumpStartedAt !== null);
      checks.push("Controles móveis: direção mantida e pulo por toque");
    }
  }
  await ana.setViewportSize({ width: 1366, height: 768 });
  await ana.locator("#fullscreen").click();
  assert.ok(await ana.evaluate(() => !!document.fullscreenElement));
  await ana.evaluate(() => document.exitFullscreen());
  checks.push("Tela cheia e redução de movimento");
  for (const power of POWERS) {
    const response = await ana.request.get(
      `${url}/assets/powers/${power.id}.png`,
    );
    assert.equal(response.status(), 200);
    const buffer = await response.body();
    assert.equal(buffer[25], 6, "PNG deve ter canal alfa RGBA");
  }
  checks.push("Dez ilustrações locais com canal alfa");
  // First error must show two lives, and reconnect must keep them.
  room.arena.zones.angle = 0;
  room.round = room.round % 2 ? room.round : room.round + 1;
  room.answer.index = 0;
  a.x = a.y = 0;
  b.x = 0;
  b.y = -200;
  c.alive = true;
  c.lives = 3;
  c.x = 0;
  c.y = -230;
  room.revision++;
  await pump();
  await pump(room.remaining);
  await pump(100);
  await ana
    .getByText("Você perdeu uma vida · restam 2", { exact: true })
    .waitFor();
  assert.equal(await ana.locator("#life-count").textContent(), "2 de 3 vidas");
  await ana.reload();
  await ana.locator("#game").waitFor({ state: "visible" });
  await ana.getByText("2 de 3 vidas", { exact: true }).waitFor();
  assert.equal(a.lives, 2);
  checks.push("Erro retira só uma vida e recarregar preserva duas");
  room.nextRound();
  await pump();
  await pump(20000);
  await pump(3000);
  room.round = room.round % 2 ? room.round : room.round + 1;
  room.players.get(id).lives = 1;
  room.players.get(id).x = 0;
  room.players.get(id).y = 0;
  room.players.get(id).teleport++;
  b.x = 0;
  b.y = -200;
  c.alive = true;
  c.x = 0;
  c.y = -230;
  room.answer.index = 0;
  room.revision++;
  await pump();
  await pump(room.remaining);
  await pump(100);
  await ana
    .locator("#center-overlay")
    .getByText("Agora você está na torcida", { exact: true })
    .waitFor();
  assert.equal(room.players.get(id).alive, false);
  await pump(6000);
  room.finish("teacher");
  room.revision++;
  await pump();
  await ana.locator("#results-dialog[open]").waitFor();
  await ana.screenshot({ path: "test-results/results-1366.png" });
  checks.push("Eliminação, torcida e relatório de estatísticas");
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/browser-report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
  await app.close();
}
