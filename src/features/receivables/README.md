# Gestão de boletos

Feature independente do organizador SPO; navegação em `/spo/financeiro/gestao-boletos`.
`api/` traduz e valida o contrato, `model/` define tipos, `lib/` apresenta valores e `ui/` contém o painel/detalhe.
A View injeta o transporte autenticado e compõe esta feature. Nenhuma dependência de internals do DPO, de Auth ou de SPO.
Saldo, situação e prioridade vêm do backend. A UI formata valores e pagina conforme o contrato.
Filtros aplicados explicitamente; atualização manual conserva filtro, paginação e últimos dados durante falhas.
Detalhe modal nativo com foco/tecla Escape, histórico paginado e demais títulos do cliente/unidade.
Histórico vazio ou insuficiente é explícito e não produz classificação de bom pagador.
Leia o contrato completo em `logimarui-core-api/docs/receivables.md` no workspace.
Testes de contrato: `npm run test:receivables`. Verificações: typecheck, lint e build.

