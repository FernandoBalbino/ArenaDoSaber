# Arena do Saber

Jogo educacional multiplayer de informática, para uma turma de até 30 alunos. Uma arena original com quatro zonas de resposta, 480 perguntas, dez poderes, chat e painel do professor. Projeto independente do HelpDeskSimulator e do OSLab.

**Jogar:** https://arena-do-saber.onrender.com

**Repositório:** https://github.com/FernandoBalbino/ArenaDoSaber

Publicado e verificado em 4 de outubro de 2026. [Resultados dos testes e desempenho observado](docs/verification.md).

## Executar localmente

Instale **Node.js 24** (inclui npm), abra um terminal nesta pasta e execute:

```sh
npm ci
npm start
```

Abra `http://localhost:3000`. Para outros computadores na mesma rede, use o IP do computador que está executando o servidor e libere somente a porta necessária no firewall. `npm run dev` reinicia o servidor quando o código muda; isso apaga as salas em memória.

As variáveis disponíveis estão em `.env.example`. O projeto lê variáveis do ambiente. Para carregar um arquivo `.env` local, use `node --env-file=.env server/index.js`. No Render, configure as variáveis pelo serviço.

## Usar em aula

1. O professor escolhe **Sou professor**, capacidade e conteúdos, depois **Criar sala**.
2. Compartilha o código de cinco caracteres. Alunos informam nome e código.
3. Com pelo menos dois alunos, o professor inicia a partida.
4. Cada aluno escolhe um de dois poderes em 20 segundos. Após 3 segundos de preparação, lê a pergunta e caminha com WASD, setas ou botões de toque.
5. A norte, B leste, C sul e D oeste são zonas fixas. Centro e divisórias são neutros. A posição oficial no fim dos 60 segundos define a resposta.
6. Poderes: clique no botão/ícone ou pressione **E/Espaço**. Para os seis poderes direcionados, selecione personagem ou nome e confirme. **Esc** cancela. Tab e Enter permitem escolher na lista. Digitar no chat bloqueia os atalhos do jogo.
7. Quem erra vira espectador, continua vendo e conversando. Se todos erram, ninguém sai e a explicação aparece.
8. Até 30 rodadas regulares. Depois, morte súbita com perguntas difíceis de 20 segundos, sem poderes. Esgotadas as inéditas, os sobreviventes dividem a vitória.

Novos alunos durante a partida aguardam a próxima rodada. Uma sessão eliminada não volta à arena ao recarregar. Sem contas, é impossível identificar com certeza uma pessoa que cria outro nome; o professor pode expulsá-la. A aparência é sorteada pelo servidor, com camisas sem repetição na sala, preservada ao reconectar.

O professor pode pausar/continuar, pular, encerrar, silenciar a sala ou um aluno, limpar chat e expulsar. A ausência do professor pausa a partida após cinco segundos; ao retornar, ele continua manualmente. Alunos têm reserva de 60 segundos. O personagem ausente para, mas continua sujeito aos efeitos e à avaliação da rodada. Abandono de todos cancela sem campeão.

## Arquitetura

| Diretório | Responsabilidade |
| --- | --- |
| `server/engine.js` | Máquina de estados, tempo ativo, posições, respostas e resultados |
| `server/rooms.js` | Salas, códigos e expiração |
| `server/powers.js` | Efeitos calculados e validados pelo servidor |
| `server/app.js` | HTTP, Socket.IO, permissões, validação, limites e projeções públicas |
| `public/shared/rules.js` | Geometria, metadados dos poderes e categorias; sem gabaritos |
| `public/js/arena.js` | Phaser, geometria original, personagens, interpolação e previsão |
| `public/js/app.js` | Interface, sessão da aba, chat, controles e acessibilidade |
| `data/` | Banco privado ao HTTP, com fontes editáveis e explicações |
| `public/assets/powers/` | Dez ilustrações originais com transparência |
| `tests/` e `scripts/` | Verificação determinística, navegador e carga |

O único servidor HTTP serve frontend, Phaser, Socket.IO e `/healthz`. Escuta em `0.0.0.0:$PORT`. Não há banco de dados. Tudo referente às salas fica em RAM; os únicos dados locais de preferência são volume e silêncio. O token da própria sessão fica em `sessionStorage` e não é exposto aos colegas.

Motor a 10 Hz, configurável para 5 Hz via `TICK_RATE`. Quadros de movimento a cada tick; estado completo a cada segundo ou mudança importante. WebSocket com fallback para polling e reconexão automática. O cliente envia direções, nunca posições oficiais. Há previsão com correção local e interpolação de adversários. Eventos de movimento obsoletos param após um segundo.

O servidor decide alternativas, tempo, consumo dos poderes, alcance e resultados. O evento `power:use` só aceita `targetId` quando necessário. HTML do chat é tratado como texto. Helmet, limite de payload, verificação de origem e limite por conexão evitam penalizar toda uma turma pelo mesmo IP. Salas vazias são removidas em 15 minutos.

## Perguntas e extensões

São 12 categorias, cada uma com 30 regulares e 10 difíceis. Os arquivos `data/source/*.txt` têm 40 linhas, com os campos separados por `|`: enunciado, correta, três incorretas e explicação. As dez últimas são difíceis. Após editar, execute:

```sh
node scripts/build-questions.js
npm test
```

O servidor embaralha enunciados e alternativas e não repete perguntas, inclusive puladas. Gabaritos não são servidos por HTTP nem enviados antes do bloqueio. **O repositório é público: os gabaritos são consultáveis no código.** Isso é uma atividade educativa, não uma plataforma de provas com segredo de banco.

Para acrescentar poderes, atualize os metadados compartilhados, a regra no servidor, a ilustração local e os testes. Mantenha validação no servidor. Não aceite coordenadas ou duração vindas do cliente.

## Testar

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run loadtest
```

O teste visual usa Chrome instalado por padrão. Para usar o Chromium do Playwright, configure `BROWSER_CHANNEL=chromium`. Os testes de regra usam relógio controlado, sem esperas reais. O teste de navegador cria um servidor isolado, controla seu relógio internamente e usa professor e três alunos em contextos separados. Não existe endpoint público de teste ou de controle de relógio.

Carga padrão: 24 alunos, cinco minutos. Em PowerShell:

```powershell
$env:BOTS='30'
$env:DURATION_SECONDS='120'
npm run loadtest
```

Para testar um serviço real, configure `BASE_URL` com sua URL e use 24 bots por 180 segundos. O teste cria sua própria sala e a encerra, sem atuar em salas existentes. Gera latências, eventos, conexões, RSS e event loop em `test-results/`. Resultados públicos devem ser medidos separadamente dos locais. Não execute carga sem autorização do operador do serviço.

## Publicar no Render Free

O serviço `arena-do-saber` foi criado pelo plugin Render no workspace **My Workspace**. Usa `render.yaml`: Node.js 24, região Virginia, plano Free, `npm ci`, `npm start`, `MAX_ROOMS=5`, branch `main` e deploy automático por commit. O health check `/healthz` foi configurado no painel e confirmado no serviço publicado. [Painel do serviço](https://dashboard.render.com/web/srv-db1b2j142hec73erdnlg).

Limites: o Render Free suspende serviços após 15 minutos sem tráfego recebido, pode levar aproximadamente um minuto para acordar, tem cotas compartilhadas de horas/tráfego/build e pode reiniciar o processo. Não há persistência de salas entre reinícios, deploys ou suspensão. Não há mecanismo de keep-alive artificial. O multiplayer exige conexão: não existe partida online offline. Abra antes da aula e evite deploys durante uma partida.

Referências: [Render Free](https://render.com/docs/free), [WebSockets no Render](https://render.com/docs/websocket), [Socket.IO](https://socket.io/docs/v4/client-options/), [Phaser](https://docs.phaser.io/phaser/getting-started/installation).

## Arte e créditos

Arena e personagens procedurais originais. A imagem de referência comercial não foi copiada nem distribuída. Os dez PNGs em `public/assets/powers/` foram gerados com a ferramenta integrada de geração de imagens. Prompts e procedência em [docs/image-prompts.md](docs/image-prompts.md). Sons sintetizados com Web Audio, sem gravações externas. Bibliotecas e licenças em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
