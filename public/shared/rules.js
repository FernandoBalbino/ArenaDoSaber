export { RADIUS, SPEED, clampCircle } from "./systems/arena.js";
export { zoneAt } from "./systems/zones.js";
export const SHIRTS = [
  "#f45b69",
  "#ff8a3d",
  "#ffc857",
  "#fff07c",
  "#b9e769",
  "#56cf83",
  "#159e76",
  "#66e2cf",
  "#20c4df",
  "#529cff",
  "#5865ed",
  "#a27aff",
  "#cf77e7",
  "#ee73b9",
  "#f9a9bd",
  "#ad4848",
  "#b5652c",
  "#8e7833",
  "#71903e",
  "#276f53",
  "#247b83",
  "#285c98",
  "#41468c",
  "#7b4099",
  "#b54386",
  "#ead7bc",
  "#a9b4c9",
  "#607987",
  "#d9f2fa",
  "#8e6654",
];
export const CATEGORIES = {
  hardware: "Hardware",
  software: "Software",
  files: "Arquivos e pastas",
  extensions: "Extensões",
  shortcuts: "Atalhos",
  browsers: "Navegadores",
  internet: "Internet",
  safety: "Segurança digital",
  networking: "Redes básicas",
  spreadsheets: "Planilhas",
  documents: "Documentos de texto",
  presentations: "Apresentações",
};
export const POWERS = [
  {
    id: "banana",
    name: "Casca de Banana",
    target: false,
    description:
      "Deixe uma casca no chão. Quem pisar escorrega por 1,5 segundo.",
  },
  {
    id: "invert",
    name: "Controles Invertidos",
    target: true,
    description:
      "Escolha um jogador próximo e inverta seus controles por 4 segundos.",
  },
  {
    id: "push",
    name: "Empurrão Fantasma",
    target: true,
    description: "Escolha um jogador próximo e empurre-o para longe de você.",
  },
  {
    id: "swap",
    name: "Troca-Troca",
    target: true,
    description: "Escolha um jogador vivo e troque de lugar com ele.",
  },
  {
    id: "ice",
    name: "Gelo no Pé",
    target: true,
    description:
      "Escolha um jogador próximo e impeça que ele ande por 2 segundos.",
  },
  {
    id: "smoke",
    name: "Nuvem de Fumaça",
    target: false,
    description:
      "Crie uma nuvem que atrapalha a visão de quem estiver dentro por 4 segundos.",
  },
  {
    id: "head",
    name: "Cabeção",
    target: true,
    description:
      "Deixe um jogador próximo com um cabeção por 4 segundos. É apenas visual.",
  },
  {
    id: "confuse",
    name: "Confusão Total",
    target: true,
    description:
      "Embaralhe os textos das zonas para um jogador próximo por 4 segundos.",
  },
  {
    id: "magnet",
    name: "Ímã Humano",
    target: false,
    description: "Atraia jogadores próximos para você durante 3 segundos.",
  },
  {
    id: "blast",
    name: "Pum Atômico",
    target: false,
    description: "Solte uma explosão cômica que empurra os jogadores ao redor.",
  },
];
export const POWER = Object.fromEntries(POWERS.map((p) => [p.id, p]));
export function direction(input) {
  let x = (input.right ? 1 : 0) - (input.left ? 1 : 0),
    y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
}
