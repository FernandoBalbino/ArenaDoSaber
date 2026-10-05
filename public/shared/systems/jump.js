export const JUMP_DURATION = 700;
export const JUMP_COOLDOWN = 1000;
export const JUMP_HEIGHT = 90;

export function jumpHeight(player, time) {
  if (player.jumpStartedAt == null) return 0;
  const progress = (time - player.jumpStartedAt) / JUMP_DURATION;
  return progress > 0 && progress < 1
    ? Math.sin(progress * Math.PI) * JUMP_HEIGHT
    : 0;
}

export function resetJump(player) {
  player.jumpStartedAt = null;
  player.jumpReadyAt = 0;
  player.laserImmuneUntil = 0;
}
