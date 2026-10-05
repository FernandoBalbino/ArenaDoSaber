import { RADIUS } from "../../shared/systems/arena.js";
import { OBSTACLES } from "../../shared/systems/obstacles.js";
import { GATES } from "../../shared/systems/gates.js";

export const ZONE_COLORS = [0x6fe0d4, 0xf2c56f, 0x9d99ef, 0xec9cac];
const polygon = (shape, width = shape.width, depth = shape.depth) => {
  const c = Math.cos(shape.angle),
    s = Math.sin(shape.angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, y]) => ({
    x: shape.x + ((x * width) / 2) * c - ((y * depth) / 2) * s,
    y: shape.y + ((x * width) / 2) * s + ((y * depth) / 2) * c,
  }));
};

export class WorldRenderer {
  constructor(scene) {
    this.scene = scene;
    this.zones = scene.add.graphics().setDepth(-950);
    this.obstacles = scene.add.graphics().setDepth(-800);
    this.gates = scene.add.graphics().setDepth(-700);
    this.laser = scene.add.graphics().setDepth(-600);
    this.labels = Array.from({ length: 4 }, (_, i) =>
      scene.add
        .text(0, 0, "ABCD"[i], {
          fontFamily: "Segoe UI",
          fontSize: "54px",
          fontStyle: "bold",
          color: "#effffb",
          stroke: "#102933",
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setDepth(-550),
    );
    scene.world.add([
      this.zones,
      this.obstacles,
      this.gates,
      this.laser,
      ...this.labels,
    ]);
    for (const o of OBSTACLES) {
      const g = this.obstacles;
      if (o.kind === "pillar") {
        g.fillStyle(0x051621, 0.4);
        g.fillEllipse(o.x, o.y + 18, 120, 78);
        g.fillStyle(0x375360);
        g.fillRoundedRect(o.x - 48, o.y - 56, 96, 76, 15);
        g.fillStyle(0x769797);
        g.fillEllipse(o.x, o.y - 54, 96, 45);
        g.lineStyle(4, 0xa8c5b5, 0.6);
        g.strokeEllipse(o.x, o.y - 54, 76, 30);
      } else {
        g.fillStyle(0x526971);
        g.fillPoints(polygon(o), true);
        g.lineStyle(5, 0xf2c56f, 0.9);
        g.strokePoints(polygon(o), true);
        // Paired chevrons are the visual vocabulary for jumpable barriers.
        g.lineStyle(5, 0xffe4a0);
        for (const dx of [-20, 20]) {
          g.lineBetween(o.x + dx - 10, o.y + 5, o.x + dx, o.y - 7);
          g.lineBetween(o.x + dx, o.y - 7, o.x + dx + 10, o.y + 5);
        }
      }
    }
  }

  draw(arena, factor, time, reduced) {
    const angle = arena?.zones.angle || 0;
    if (angle !== this.angle) {
      this.angle = angle;
      const g = this.zones;
      g.clear();
      for (let i = 0; i < 4; i++) {
        const start = -Math.PI * 0.75 + (i * Math.PI) / 2 + angle;
        g.fillStyle(ZONE_COLORS[i], 0.19);
        g.slice(0, 0, RADIUS - 12, start, start + Math.PI / 2, false);
        g.fillPath();
        g.lineStyle(44, 0x142f3b, 0.9);
        g.lineBetween(
          Math.cos(start) * 130,
          Math.sin(start) * 130,
          Math.cos(start) * RADIUS,
          Math.sin(start) * RADIUS,
        );
        g.lineStyle(4, 0x9cebdd, 0.7);
        g.lineBetween(
          Math.cos(start) * 130,
          Math.sin(start) * 130,
          Math.cos(start) * RADIUS,
          Math.sin(start) * RADIUS,
        );
      }
      g.fillStyle(0x193842);
      g.fillCircle(0, 0, 130);
      g.lineStyle(5, 0xc4b685, 0.7);
      g.strokeCircle(0, 0, 130);
    }
    this.labels.forEach((label, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 2 + angle;
      label
        .setPosition(Math.cos(a) * 720, Math.sin(a) * 720)
        .setFontSize(Math.max(52, 20 / factor));
    });
    const gates = this.gates;
    gates.clear();
    GATES.forEach((gate, i) => {
      const state = arena?.gates[i],
        closed = state?.closed,
        warning = state?.warning;
      const target = closed ? 1 : 0;
      this.openness ??= [0, 0, 0, 0];
      this.openness[i] = reduced
        ? target
        : this.openness[i] + (target - this.openness[i]) * 0.18;
      // The footprint and status color always show the official collision state.
      const color = warning ? 0xf2c56f : closed ? 0xe8909c : 0x7ae7cc;
      gates.fillStyle(color, closed ? 0.5 : 0.1);
      gates.fillPoints(polygon(gate), true);
      gates.lineStyle(5, color, 0.9);
      gates.strokePoints(polygon(gate), true);
      if (this.openness[i] > 0.02) {
        gates.fillStyle(color, 0.7);
        gates.fillPoints(
          polygon(gate, gate.width * this.openness[i], gate.depth),
          true,
        );
      }
    });
    const laser = this.laser;
    laser.clear();
    const beam = arena?.laser;
    if (beam?.warning) {
      laser.lineStyle(
        8,
        0xf2c56f,
        reduced ? 0.7 : 0.55 + Math.sin(time / 150) * 0.2,
      );
      laser.strokeCircle(0, 0, 95);
    }
    if (beam?.active) {
      const x = Math.cos(beam.angle) * (RADIUS - 35),
        y = Math.sin(beam.angle) * (RADIUS - 35);
      for (const [width, alpha, color] of [
        [40, 0.12, 0x7ce5ed],
        [22, 0.35, 0x80f4ef],
        [10, 1, 0xe5ffff],
      ]) {
        laser.lineStyle(width, color, alpha);
        laser.lineBetween(0, 0, x, y);
      }
      laser.fillStyle(0xc9ffff);
      laser.fillCircle(0, 0, 24);
    }
  }
}
