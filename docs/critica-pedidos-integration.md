# Crítica Pedidos como serviço independente

O botão lateral **Critica Pedidos** abre `/critica-pedidos`, em página completa,
com o visual original do Carlos. O frontend oficial apenas encaminha HTTP; o
projeto do painel não faz parte deste repositório ou do build do Next.js.

## Repositório e manutenção

O projeto fica em `../logimarui_services/critica-pedidos`, um checkout Git próprio
de <https://github.com/Imarui-litoral-norte/Roteizarador>. Os arquivos originais
permanecem intactos. Um commit local em `integracao/logimarui`, que acompanha
`origin/master`, adiciona somente o adaptador de hospedagem, seus testes e a
documentação. Nenhuma alteração foi enviada ao remoto.

As instruções completas estão no `README.logimarui.md` do serviço. Para receber
alterações do Carlos, execute no repositório do serviço, com árvore limpa:

```powershell
git pull --rebase
```

O servidor lê o HTML em cada acesso. Mudanças no painel aparecem ao recarregar
a página e não exigem recompilar este frontend.

## Execução

- Processo independente: `python logimarui_service.py`, apenas Python padrão.
- Supervisor do core: ID `critica-pedidos`, tipo Python, habilitado para boot
  automático antes do frontend, com controles próprios no gerenciador de serviços.
- Porta preferida DEV `4104`; local/PROD `4004`; escuta em `127.0.0.1`.
- Gateway: `/critica-pedidos`, com destino na porta efetiva do runtime cadastrado.
- Next.js: rewrite de `/critica-pedidos/:path*` para `CRITICA_SERVICE_URL`, sem
  modificar HTML/CSS/JavaScript. DEV: `http://127.0.0.1:4104`.
- A tela **Servidor** identifica a Crítica e oferece os mesmos controles de
  iniciar/parar/reiniciar usados pelos outros serviços, quando o core está ativo.

`SERVICE_CRITICA_PREFERRED_PORT` altera a preferência de porta do supervisor.
No boot gerenciado, o supervisor injeta `CRITICA_SERVICE_URL` com a porta efetiva
da Crítica antes de iniciar o frontend; o gateway também acompanha essa porta.
Se iniciar o Next manualmente, alinhe a URL ao runtime. Alterações no proxy exigem reiniciar
o Next e, quando estiver usando build, recompilar o frontend.

Os endereços são `http://SEU_IP:8191/critica-pedidos` (frontend DEV) e
`http://SEU_IP:81/critica-pedidos` (gateway DEV ativo). O processo Python não
depende do frontend para executar e pode ser iniciado separadamente pelo Carlos.
O servidor oficial mantém `allowedDevOrigins` com o hostname e os IPv4 locais.

## Dados e preservação

O HTML do Carlos permanece intacto no checkout. O adaptador injeta os dados
compartilhados e uma ponte de upload somente na resposta HTTP. Os controles
**Enviar arquivos** e **Atualizar consulta** usam os leitores CSV/XLSX originais
e enviam JSON ao próprio serviço. A pasta `data/` do serviço, ignorada pelo Git,
guarda `mock-clientes.json`, `mock-veiculos.json`, `mock-consulta.json` e
`mock-paletes.json` em um snapshot, publicado pelo ponteiro atômico `mock.json`.

Cada base selecionada é totalmente substituída. Os dados retornam no F5 e após
reinício. A revisão enviada no upload evita sobrescrita por sessões desatualizadas
(HTTP 412); todas as sessões visíveis consultam novidades a cada 15 segundos.
O frontend permite corpos de proxy de até 64 MiB para comportar as bases atuais.
As regras de armazenamento e backup estão no README do serviço. A alimentação
funciona pelo IP sem vínculo com pastas; não depende do backend de negócio.
PROD não foi alterado.

A antiga cópia incorporada e o pacote de preservação foram guardados somente em
`.runtime/critica-embedded-backup`, ignorado pelo Git e fora do conteúdo publicado.

## Validação

Os testes Python cobrem substituição, reinício, disputa entre threads e processos,
falha de publicação, validação e hidratação do HTML sem modificar o arquivo original.
Upload dos quatro arquivos e F5 foram verificados pelo IP na porta do frontend.
O cadastro usa o fluxo normal do supervisor; iniciar/reiniciar apenas a Crítica
não exige iniciar o backend de negócio ou carregar dados.
