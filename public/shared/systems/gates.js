import { PLAYER_RADIUS } from "./arena.js";

export const GATES = Array.from({ length: 4 }, (_, i) => {
  const angle = Math.PI / 4 + (i * Math.PI) / 2;
  return {
    id: `gate-${i}`,
    kind: "gate",
    x: Math.cos(angle) * 440,
    y: Math.sin(angle) * 440,
    width: 190,
    depth: 30,
    height: Infinity,
    angle,
  };
});

export function gateOccupied(gate, players) {
  return players.some((p) => {
    const dx = p.x - gate.x,
      dy = p.y - gate.y;
    const x = dx * Math.cos(gate.angle) + dy * Math.sin(gate.angle);
    const y = -dx * Math.sin(gate.angle) + dy * Math.cos(gate.angle);
    return (
      Math.abs(x) < gate.width / 2 + PLAYER_RADIUS + 3 &&
      Math.abs(y) < gate.depth / 2 + PLAYER_RADIUS + 3
    );
  });
}

export function gateStates(elapsed, calm, players, previous = []) {
  return GATES.map((gate, i) => {
    const cycle = (elapsed + i * 3000) % 12000;
    const wantsClosed = !calm && cycle >= 7000;
    const occupied = wantsClosed && gateOccupied(gate, players);
    const closed = wantsClosed && (!occupied || previous[i]?.closed === true);
    return {
      id: gate.id,
      closed,
      warning:
        !calm && ((cycle >= 6000 && cycle < 7000) || (wantsClosed && !closed)),
    };
  });
}
