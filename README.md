## Getting Started

### DEV com IIAM — branch IIAMS-154

A entrada integrada desta branch é `https://localhost:8443`.
Faça o build com `LOGIMARUI_PROFILE=dev` e
`NEXT_PUBLIC_GATEWAY_URL=https://localhost:8443`; execute o launcher
`logimarui-core-api/scripts/start-iiam-integrated-dev.ps1` a partir do workspace.
O gateway inicia o Next internamente em 8191 e publica o IIAM na mesma origem.
O certificado localhost precisa ser instalado manualmente como confiável.
Veja [contratos do cliente IIAM](docs/iiams-154-client.md) e o roteiro
`logimarui-core-api/docs/iiams-154-cutover.md` para configuração e recuperação.

### Configuração standalone anterior

Defina as variaveis em `.env.local`:

```bash
FRONTEND_PORT=8091
NEXT_PUBLIC_CORE_API_URL=http://127.0.0.1:81
```

No workspace `LogImarui-dev`, o gateway Java deve responder em `81`.
Ao promover esse snapshot para `LogImarui`, troque `NEXT_PUBLIC_CORE_API_URL` para `http://127.0.0.1:80`.

Depois execute:

```bash
npm run dev
```

Abra `http://localhost:8091`.

Para producao local do frontend standalone:

```bash
npm run build
npm run start
```

## Arquitetura

O contrato FSD, as responsabilidades das camadas e as regras de dependência estão
documentados em [`docs/frontend-architecture.md`](docs/frontend-architecture.md).
