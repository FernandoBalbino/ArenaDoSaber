# Arena dinâmica e três vidas

## Regras da atualização

O jogo mantém as 480 perguntas, dez poderes, salas para até 30 alunos, chat e moderação. A arena circular continua inteiramente visível. Sua largura e altura dobraram: raio 840, centro neutro de raio 130, colisor do personagem de raio 28 e velocidade de 220 unidades/s. Alcances e empurrões dos poderes foram ampliados proporcionalmente ao cenário.

Cada aluno inicia com três vidas. Uma resposta errada ou região neutra desconta uma vida, incluindo erro coletivo. O resultado é aplicado uma única vez. Acertos não recuperam vidas. Com zero, o aluno passa para a torcida. Reconexão não restaura vidas; uma nova partida restaura três. O aluno que chega durante uma partida aguarda a próxima rodada e entra com três vidas.

As rodadas continuam com 60 segundos; a morte súbita tem 20 segundos, mantém as vidas restantes e não oferece poderes. Se todos os últimos participantes perderem a última vida, a explicação permanece por seis segundos antes do resultado sem campeão. Abandono é um motivo separado de cancelamento.

## Controles

| Ação | Teclado | Tela/toque |
| --- | --- | --- |
| Mover | WASD ou setas | Direcional |
| Pular | Espaço | Pular |
| Usar poder | E | Botão ou ilustração do poder |
| Cancelar alvo | Esc | X da seleção |

O chat desativa atalhos enquanto recebe texto. O pulo dura 700 ms, atinge altura 90 e tem intervalo mínimo de um segundo entre ativações. O jogador pode se mover no ar. Gelo impede iniciar o pulo. Espectadores e participantes aguardando não podem pular. A pausa congela o tempo das mecânicas.

## Como testar cada mecânica

1. **Vidas:** crie uma sala com professor e pelo menos dois alunos. Termine uma rodada no centro. Confira a mudança de três para dois corações e a explicação do erro. Recarregue a mesma aba: continue com duas vidas. Repita até zero; nenhum eliminado deve voltar pela reconexão. Se todos chegarem a zero juntos, não haverá campeão. Inicie outra partida para restaurar três.
2. **Obstáculos:** caminhe contra os pilares altos; deve ser necessário contorná-los. Barreiras com » bloqueiam a caminhada, mas permitem cruzar sua parte estreita durante um salto. Aterrissagens nunca deixam o personagem preso dentro da barreira.
3. **Portas:** observe os quatro segmentos entre setores. Verde indica aberto, rosa fechado e amarelo aviso. Os ciclos têm sete segundos abertos e cinco fechados, defasados em três segundos. Pelo menos duas portas ficam abertas. Ocupando uma passagem aberta durante o aviso, o fechamento é adiado até liberar a passagem.
4. **Rotação:** na segunda rodada normal, aguarde o aviso aos 18 segundos. Entre os segundos 20 e 28, as quatro zonas giram 90°; a quarta rodada gira no sentido contrário. Letras e divisórias acompanham a mudança, enquanto a legenda das respostas continua fixa. A resposta é verificada pela posição final da zona. Obstáculos e jogadores não são carregados pela rotação.
5. **Laser:** após três segundos, uma barra de energia começa a girar, completando uma volta em 12 segundos. Um impacto reduz a velocidade a 60% por um segundo e mostra um anel dourado; vidas não mudam. Há 1,5 segundo de proteção entre impactos. Pule sobre a barra para evitar o efeito.
6. **Pulo:** use Espaço e o botão Pular. Observe elevação do corpo, sombra no chão e indicador de recarga. Segurar Espaço não deve repetir saltos. Pulo não atravessa pilares ou portas fechadas e não ativa poderes.
7. **Final e pausa:** nos cinco segundos finais, confira portas abertas, laser desligado, ausência de lentidão residual e zonas paradas. Pause no meio de um salto ou rotação e confirme que só continuam após o professor retomar.
8. **Poderes:** use empurrão, explosão e ímã junto aos obstáculos. Eles devem respeitar colisões. Troca continua alcançando toda a arena, mas corrige destinos que estariam dentro de obstáculos.

## Organização e protocolo

As regras puras compartilhadas ficam em `public/shared/systems`. `server/arena-system.js` avança o mundo em passos de até 20 ms, independentemente dos ticks de rede de 5 ou 10 Hz. O cliente usa as mesmas regras de movimento e interpola o mundo. O servidor aceita intenções, nunca posições oficiais, quantidade de vidas ou altura informada pelo navegador.

O snapshot acrescenta `maxLives` e `arena`, além de `lives`, `jumpStartedAt`, `jumpReadyAt`, `laserHitAt` e `slipVector` nos jogadores. Os quadros compactos acrescentam dados de salto e o estado da arena. O resultado inclui vidas antes/depois, acerto e eliminação por jogador, `allWrong` e `allEliminated`; não existe mais anulação de erro coletivo. O motivo `all_eliminated` distingue o fim sem sobreviventes de `cancelled`. `player:jump` recebe `{seq}` e valida permissão, fase e cooldown.

## Arquivos

Novos:

- `public/shared/systems/arena.js`, `obstacles.js`, `gates.js`, `zones.js`, `laser.js`, `jump.js` e `collision.js`.
- `public/js/systems/world.js` e `hud.js`.
- `server/arena-system.js`.
- `tests/arena.test.js`.
- `docs/dynamic-arena.md`.

Modificados:

- `server/engine.js`, `server/powers.js` e `server/app.js`.
- `public/shared/rules.js`, `public/js/arena.js`, `public/js/app.js`, `public/index.html` e `public/style.css`.
- `tests/engine.test.js`, `tests/network.test.js`, `scripts/browser-test.js` e `scripts/loadtest.js`.
- `README.md` e `docs/verification.md`.

O `render.yaml` existente continua válido: o serviço Free já tem Node.js 24, health check e deploy automático da `main`. Não foram acrescentados banco de dados ou serviços pagos. Arquivos JS/CSS próprios são revalidados para evitar código antigo após atualizar a página. Deploys ainda reiniciam as salas em memória.
