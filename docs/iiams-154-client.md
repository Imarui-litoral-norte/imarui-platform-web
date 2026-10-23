# IIAM V1 no cliente DEV

Entrada integrada: `https://localhost:8443`. O Next roda internamente em 8191;
o Core publica o frontend e `/api/iam` na mesma origem HTTPS. Configure
`NEXT_PUBLIC_GATEWAY_URL` antes do build quando usar outra origem.

- Login por kind/identifier e senha. Não existe login local de demonstração.
- Access fica em memória; refresh fica no cookie Secure/HttpOnly do IIAM.
  Tokens antigos persistidos no storage são removidos na atualização.
- Refresh usa CSRF e Web Locks para serializar a rotação entre abas.
- `/api/v1/gateway/me` traz o contexto próprio e capacidades do Core via PDP.
- Registro cria IdentityApplication pendente. Aprovação, Tenant, tipo de vínculo
  e convite são operações administrativas explícitas no console IAM.
- Primeiro acesso e recuperação recebem o token no fragmento da URL; senhas
  não são migradas nem preenchidas automaticamente.
- Identity/Tenant/Scope usam UUID; IDs técnicos de Role/Assignment/Deny e de
  consultas administrativas de sessão seguem o contrato específico V1.
- Aplicações publicadas recebem transporte suplementar Secure/HttpOnly de
  access por prefixo. O gateway valida JWT e PDP em cada acesso e remove esse
  cookie antes de encaminhar a requisição ao serviço.

`npm test`, `npm run typecheck` e build webpack passaram nesta rodada.
Os testes de refresh entre abas usam simulação de Web Locks; a homologação do
navegador e a abertura das solicitações legadas fazem parte do corte integrado.

O operador de governança do IIAM e o consumidor sintético do Core são contas
distintas. A proteção contra autoelevação do ROOT permanece no IIAM.
