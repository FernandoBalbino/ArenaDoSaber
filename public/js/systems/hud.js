import { MAX_LIVES } from "../../shared/systems/arena.js";

export const hearts = (lives) =>
  "♥".repeat(lives) + "♡".repeat(MAX_LIVES - lives);

export function updateHud(state, player, connected, sound) {
  const panel = document.getElementById("lives-panel");
  panel.hidden = !player;
  if (player) {
    const old =
      panel.dataset.player === player.id
        ? Number(panel.dataset.lives)
        : player.lives;
    panel.dataset.player = player.id;
    panel.dataset.lives = player.lives;
    document.getElementById("life-hearts").textContent = hearts(player.lives);
    document.getElementById("life-count").textContent =
      `${player.lives} de ${MAX_LIVES} vidas`;
    panel.classList.toggle("last-life", player.lives === 1);
    if (old > player.lives) {
      document.getElementById("life-announcement").textContent = player.lives
        ? `Você perdeu uma vida. Restam ${player.lives} de 3 vidas.`
        : "Você perdeu a última vida. Agora está na torcida.";
      sound("result");
    }
  }
  const canJump =
    connected &&
    state.phase === "ROUND_ACTIVE" &&
    !state.paused &&
    player?.alive &&
    !player.waiting &&
    !player.effects.includes("ice");
  const cooldown = Math.max(0, (player?.jumpReadyAt || 0) - state.time);
  document.getElementById("jump-action").disabled = !canJump || cooldown > 0;
  document.getElementById("jump-detail").textContent =
    cooldown > 0
      ? `Pronto em ${(cooldown / 1000).toFixed(1)} s`
      : "Passe por barreiras com »";
  const event = document.getElementById("arena-event");
  const arena = state.arena;
  event.hidden = state.phase !== "ROUND_ACTIVE" || state.paused;
  const text = !arena
    ? ""
    : arena.calm
      ? "ESCOLHA SUA RESPOSTA · caminhos livres"
      : arena.zones.warning
        ? "AS ZONAS VÃO GIRAR"
        : arena.zones.rotating
          ? "ARENA ROTACIONANDO"
          : arena.laser.warning
            ? "LASER EM 3 SEGUNDOS · Espaço para pular"
            : arena.gates.some((g) => g.warning)
              ? "ATENÇÃO ÀS PORTAS · procure outra passagem"
              : "LASER ATIVO · pule a barra de energia";
  if (event.textContent !== text) {
    event.textContent = text;
    if (!event.hidden) sound("click");
  }
}
