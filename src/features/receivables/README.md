# Gestão de boletos

Feature independente do organizador SPO; navegação em `/spo/financeiro/gestao-boletos`.
`api/` traduz e valida o contrato, `model/` define tipos, `lib/` apresenta valores e `ui/` contém o painel/detalhe.
A View injeta o transporte autenticado e compõe esta feature. Nenhuma dependência de internals do DPO, de Auth ou de SPO.
Saldo, situação e prioridade vêm do backend. A UI formata valores e pagina conforme o contrato.
Filtros aplicados explicitamente; atualização manual conserva filtro, paginação e últimos dados durante falhas.
Exportar CSV baixa todos os títulos dos filtros e ordenação aplicados, incluindo todas as páginas. Alterações pendentes no formulário exigem Aplicar filtros; consulta, exportação e paginação são coordenadas para evitar ações concorrentes. A exportação relê a fonte, mantendo a janela histórica efetiva da lista, e pode refletir dados mais recentes.
Download autenticado pela View com a mesma renovação de sessão e tratamento de erros da consulta. CSV gerado pelo backend em UTF-8 com BOM, ponto e vírgula, datas e valores brasileiros, informações do título e indicadores do histórico. Falhas de exportação preservam os dados da tela.
Detalhe modal nativo com foco/tecla Escape, histórico paginado e demais títulos do cliente/unidade.
Histórico vazio ou insuficiente é explícito e não produz classificação de bom pagador.
Leia o contrato completo em `logimarui-core-api/docs/receivables.md` no workspace.
Testes de contrato: `npm run test:receivables`. Verificações: typecheck, lint e build.

# Risco comportamental anual (31/10/2026)

Lista e detalhe exibem o campo `risk` calculado pelo backend (`BEHAVIOURAL_V1`), com nível 1–5,
índice 0–100, contagem anual por título/parcela, métricas monetárias, componentes e motivos.
`riskLevel` filtra a lista/resumo/CSV; `RISK_DESC` ordena por risco. O frontend não recalcula o índice.
A janela de pagamentos afeta apenas `history`; a análise anual usa vencimentos de janeiro até hoje
e considera toda a carteira elegível do cliente/unidade, independentemente dos filtros visuais.
Ausência de amostra não implica baixo risco. `metadata.riskModel=BEHAVIOURAL_V1` identifica a capacidade
de análise anual, inclusive em respostas vazias. Backend antigo apresenta aviso na lista e controles
de risco desabilitados. A API do frontend rejeita filtros de risco sem suporte ou linhas de outro nível.
Metodologia e limites estão em `logimarui-core-api/docs/receivables-risk.md` no repositório backend.

