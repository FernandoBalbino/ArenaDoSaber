// A clear inner circle and outer ring always connect the four sectors.
export const OBSTACLES = Array.from({ length: 4 }, (_, i) => {
  const angle = (i * Math.PI) / 2;
  const rotate = (x, y) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  });
  return [
    {
      id: `pillar-${i}`,
      kind: "pillar",
      ...rotate(330, 130),
      radius: 48,
      height: Infinity,
    },
    {
      id: `low-${i}`,
      kind: "low",
      ...rotate(490, -150),
      width: 120,
      depth: 44,
      angle,
      height: 26,
    },
  ];
}).flat();
