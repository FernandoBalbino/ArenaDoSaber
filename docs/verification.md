# Verificação da arena dinâmica — 5 de outubro de 2026

## Evidências locais

- Runtime dos testes: Node.js 24.21.0.
- **41 testes de regras e rede aprovados**, incluindo vidas, resultado idempotente, morte súbita, rotação, portas, colisões, salto, laser, os dez poderes, isolamento e 30 conexões simultâneas.
- **27 verificações de navegador aprovadas** com professor e três alunos. Cobrem corações, perda de uma vida, recarregamento, Espaço sem ativar poder, botão de pulo, cooldown, foco no chat, dez poderes, rotação em dois clientes, direcional e pulo por toque, pausa e resultados. Nenhum erro de página.
- Layouts: 1366×768, 1920×1080, 800×650 e 390×844. Sem overflow horizontal; canvas ajustado à altura real do mapa, sem cortar a arena. Legenda fixa e letras no chão acompanham a arena; o aviso de eventos fica fora do mapa para não cobrir respostas. A tela móvel permite rolagem vertical.
- `render.yaml` validado contra o schema oficial. Auditoria das dependências instaladas sem vulnerabilidades reportadas.

### Carga local desta atualização

| Métrica | Resultado |
| --- | --- |
| Alunos / professor | 30 / 1 |
| Duração | 120,018 s |
| Pulos aceitos | 1.470 |
| Falhas / desconexões | 0 / 0 |
| RTT mediana / p95 / máximo | 7,5 / 31,8 / 211,2 ms |
| Pico de RSS | 139 MB |
| Maior p95 do event loop | 32,2 ms |
| Volume JSON estimado | 127,7 MB |

A carga incluiu obstáculos, portas, laser, rotação e pulos. Os números são locais e não representam a rede da escola nem desempenho do Render. Arquivos de evidência: `test-results/load-local-30.json`, `test-results/browser-report.json` e capturas `arena-*.png`.

## Publicação desta atualização

A confirmação do deploy público será registrada após a publicação. O serviço existente permanece Free, em Virginia, com uma instância, Node.js 24, `npm ci`, `npm start` e `/healthz`. As salas continuam em memória, sem persistência entre deploys.

---

# Histórico: publicação original — 4 de outubro de 2026

- Jogo: https://arena-do-saber.onrender.com
- Código: https://github.com/FernandoBalbino/ArenaDoSaber
- Commit da aplicação publicada: `53796ac53609c8e16851e8338f26d6d945873886`.
- Render: `arena-do-saber`, My Workspace, Free, Virginia; deploy `dep-db1b3ek9v7es73eorrig` confirmado como **live** às 20:06:41 UTC.
- Node.js 24; mesma origem para HTTP, Phaser e Socket.IO. Health check `/healthz` configurado no painel; deploy automático da branch `main`.

## Regras e protocolo

31 testes automatizados passaram. Cobrem as 480 perguntas e suas alternativas, 30 camisas distintas, salas e capacidade, isolamento, permissões, ausência de gabaritos antecipados e tokens alheios, movimento e regiões, cronômetros, pausa, reconexão, entrada tardia, abandono, eliminação simultânea, anulação quando todos erram, morte súbita, empate, pulos e nova partida. Uma partida completa com 30 perguntas regulares e dez difíceis foi exercitada com relógio controlado.

Os dez poderes foram verificados quanto a alcance, duração, consumo único, alvos inválidos, últimos dois segundos, pausa e limpeza. O teste de integração conectou 30 clientes Socket.IO; verificou também fallback para polling, texto puro no chat, frequência de envio, silenciamento, expulsão e limpeza.

`npm audit` não apontou vulnerabilidades nas dependências instaladas. `render.yaml` passou na validação contra o schema oficial do Render.

## Navegador e interface

23 verificações automatizadas passaram, usando professor e três alunos em contextos separados. Foram exercitados os dez poderes, seleção de alvo pelo personagem e pelo nome, confirmação, cancelamento por Esc, E/Espaço, botão e ícone, tecla mantida pressionada, foco no chat, alvo eliminado, bloqueio por alcance, pausa, reconexão por recarregamento, preservação da aparência, espectador e resultados. As imagens são locais e possuem transparência.

Resoluções verificadas: 1366×768, 1920×1080, 800×650 e 390×844, sem overflow horizontal. Botão principal com altura mínima de 64 px; tela cheia e redução de animações também verificadas. Não houve erros de página no teste automatizado.

No site público, professor e três alunos abriram uma sala, trocaram mensagens, escolheram um poder direcionado e o usaram em outro participante. Pausa e restauração da sessão após recarregar foram confirmadas. Console da sessão inspecionada sem erros. Capturas locais estão em `test-results/`, incluindo `public-arena.png`.

## Carga medida

| Métrica | Local: 24 alunos | Local: 30 alunos | Render: 24 alunos |
| --- | ---: | ---: | ---: |
| Duração | 300,006 s | 120,017 s | 180,327 s |
| Mensagens enviadas | 30.378 | 14.908 | 17.777 |
| Mensagens recebidas | 83.019 | 39.923 | 50.454 |
| Falhas / desconexões | 0 / 0 | 0 / 0 | 0 / 0 |
| RTT mediana | 2,4 ms | 2,6 ms | 161,9 ms |
| RTT p95 | 4,1 ms | 4,9 ms | 172,4 ms |
| RTT máximo | 4,7 ms | 8,0 ms | 191,6 ms |
| Pico de RSS do processo | 108,6 MB | 108,3 MB | 84,9 MB |
| Maior p95 observado do event loop | 21,9 ms | 31,9 ms | 20,6 ms |
| Pico de conexões no processo | 25 | 31 | 29 |
| Volume JSON estimado, sem compressão | 157,2 MB | 94,0 MB | 96,1 MB |

Cada carga inclui um professor além dos bots. O pico público de 29 conexões inclui quatro sessões de navegador em uma segunda sala. Os bots enviam movimento a cada 250 ms; perguntas são puladas antes do encerramento para manter todos participando. O volume JSON é uma estimativa dos payloads, não uma medição de tráfego de rede faturável.

Os arquivos locais `test-results/load-local-24.json`, `load-local-30.json` e `load-public-24.json` contêm amostras detalhadas. A execução pública registrada ocorreu depois do deploy que configurou o health check. Uma tentativa anterior foi interrompida por esse deploy e reiniciada para medir uma execução contínua.

## Publicação e limites verificados

`/healthz` e `/credits.html` responderam HTTP 200. `/data/questions.json` respondeu 404; o banco não é servido pelo frontend. A consulta aos logs de erro do Render retornou vazia após a verificação pública.

- O plano Free suspende o serviço após 15 minutos sem tráfego recebido e pode levar cerca de um minuto para acordar. Consulte os [limites oficiais](https://render.com/docs/free).
- Reinício, suspensão ou deploy apagam as salas em memória. Evite publicar mudanças durante uma aula. Commits somente de documentação podem usar `[skip render]`, conforme a [documentação de deploy](https://render.com/docs/deploys).
- Multiplayer requer conexão com o servidor. Não há partida multiplayer offline.
- A reconexão usa a sessão da aba; fechar a aba pode perder a credencial. Recarregar e reconectar na mesma aba foram verificados.
- Sem contas, uma nova identidade não pode ser vinculada com certeza a um aluno eliminado; o professor dispõe de expulsão.
- O GitHub é público e contém os gabaritos, como definido no escopo.
- Os testes de layout foram feitos no Chrome. Hardware físico de Chromebook, touchpad e 24 dispositivos reais em uma escola não foram testados. A carga mede o servidor e a rede utilizada, não o desempenho de renderização de uma turma inteira.

Os resultados representam estas execuções; não constituem garantia de latência em outras redes ou regiões.
