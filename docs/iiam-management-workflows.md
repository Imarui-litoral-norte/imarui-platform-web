# IIAM — gestão de identidades e acessos pelo frontend

Implementação revisada em 29/10/2026. Escopo: frontend DEV, sem migração, implantação, alteração de permissões reais ou mudança dos contratos do serviço.

## Referência de experiência

Foi consultado o código da branch `develop` de [Jeep-Club/front-end-web-application](https://github.com/Jeep-Club/front-end-web-application), em especial:

- `src/components/pages/admin/users/UserManagementView.tsx`: lista pesquisável, situação, paginação e ações contextuais.
- `src/components/pages/admin/users/UserWorkspace.tsx`: ficha de gestão, navegação por tarefa, resumo do cadastro e retorno à lista.
- `src/components/pages/admin/users/[id]/UserSecurityTab.tsx`: distinção entre sessões e tokens, histórico, datas e confirmação do impacto.
- `src/components/pages/admin/roles-permissoe/index.tsx`: composição de perfis, atribuições e ações de ciclo de vida.

A aplicação preserva o tema do Logimarui e separa as funções adicionais do IIAM em espaços próprios. A implementação foi dividida em componentes por domínio; a console não concentra mais todas as operações em uma única tela.

## Organização e princípios

| Rota                             | Tarefas                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/iam/identidade`                | Solicitações; cadastro e acesso; empresas                                                         |
| `/iam/autenticacao`              | Minhas sessões; sessões administrativas; renovações; senha e recuperação                          |
| `/iam/autorizacao`               | Perfis; atribuições; negações; delegações; escopos; diagnóstico; auditoria; catálogo e governança |
| `/authorization/role-management` | Entrada existente, que também utiliza a nova console de autorização                               |

As decisões aparecem com descrições humanas, datas de São Paulo, nomes quando disponíveis no recurso, situação, motivos e próximos passos. UUIDs continuam copiáveis e são necessários quando o backend não oferece listagem ou busca por nome. Os links da ficha transportam `identityId` para sessões, atribuições e diagnóstico; `section` e `scopeId` permitem abrir um contexto específico.

Referências em sessões, atribuições e auditoria consultam os nomes somente das linhas visíveis (dez na paginação local, vinte na página do servidor). Consultas simultâneas do mesmo UUID compartilham a requisição em andamento, sem manter um cache de cadastros concluídos. Se a leitura da identidade for negada, o registro continua acessível pelo UUID e pelo atalho de cadastro, sem bloquear a consulta principal. A busca dessas tabelas considera os metadados da coleção original; não equivale a uma pesquisa global de nomes.

Consultas possuem estados de carregamento, vazio e erro com nova tentativa. Mudar de escopo desmonta a edição anterior. Respostas atrasadas de consultas anteriores são descartadas. Mutações bloqueiam envio duplicado; diálogos nativos mantêm o foco e tornam o fundo inerte, aceitam Escape fora de operações em andamento e devolvem o foco ao fechar.

O serviço continua responsável pela autorização. O frontend respeita `manageable`/`available` dos perfis e trata 403 sem simular dados ou acesso. Permissões presentes no perfil da plataforma não são tratadas como prova de autorização em todos os descendentes.

## Casos de uso e jornada do administrador

### 1. Analisar uma solicitação

1. Abrir Solicitações e observar pendentes, aprovadas e rejeitadas da consulta completa.
2. Buscar por nome, apelido, contato, documento ou UUID; filtrar situação e ordenar as colunas disponíveis.
3. Abrir Analisar: o detalhe é consultado novamente, apresentando dados específicos de pessoa física, pessoa jurídica ou serviço, data e identificador.
4. Selecionar a empresa ativa pelo nome ou código. A lista é paginada no servidor e limitada ao acesso do operador. Quando existe apenas uma empresa ativa visível, ela é pré-selecionada; a seleção permanece para as próximas análises dentro da área. Se necessário, criar a empresa e ativá-la pela área Empresas antes de prosseguir.
5. Escolher o tipo aprovado permitido pelo fluxo e a classificação do vínculo. Funcionário exige matrícula; cliente exige código do cliente; fornecedor exige código do fornecedor. Parceiro/externo não enviam os códigos das outras classificações.
6. Aprovar: a seleção precisa corresponder à empresa ativa consultada. O retorno abre a ficha da identidade criada.
7. Alternativamente, rejeitar com motivo obrigatório de até 500 caracteres. Depois, consultar data, revisor, motivo e IDs resultantes da revisão.

**Primeiro acesso:** a aprovação cria identidade `PENDING` e vínculo ativo. O convite de ativação só pode ser concluído com a identidade ainda pendente: o titular define a senha e o serviço ativa o cadastro. A ativação administrativa fica separada, com explicação de que não define senha e inviabiliza concluir o convite de ativação enquanto o cadastro estiver ativo.

### 2. Gerenciar cadastro e acesso

1. Abrir uma identidade pela solicitação aprovada, selecionar uma identidade das aprovações carregadas, consultar por UUID ou abrir Meu cadastro.
2. Conferir nome, apelido, e-mail, tipo, documentos, contato e marcos do ciclo de vida.
3. Alterar apelido com validação de tamanho e tratamento da unicidade pelo serviço.
4. Para pendentes, gerar e copiar convite de primeiro acesso. O segredo existe apenas no estado da tela; pode ser ocultado e não é persistido no navegador.
5. Desabilitar uma identidade ativa com confirmação do impacto; reativar uma desabilitada. A reativação não restaura sessões revogadas.
6. Continuar diretamente para sessões, perfis atribuídos ou diagnóstico da identidade.

### 3. Gerenciar empresas

Buscar pelo nome/código, filtrar por situação e selecionar na lista; criar código/nome pendentes; ativar; renomear preservando o código; desabilitar; reativar. Após criar ou alterar o cadastro, a lista é atualizada. A tela explica o efeito contextual sobre vínculos, sem prometer alterar o estado individual de identidades ou afiliações. O mesmo seletor é usado ao criar um perfil pertencente a uma empresa.

### 4. Investigar e interromper acesso

- **Minhas sessões:** consultar situação, criação e expiração; distinguir a sessão atual por `profile.sessionId`; renovar o próprio acesso; encerrar uma sessão. Encerrar a atual limpa o estado e leva à entrada.
- **Sessões administrativas:** navegar páginas do servidor, filtrar situação ou identidade nos registros da página e encerrar por ID numérico administrativo. Exibir criação, expiração e encerramento/revogação.
- **Renovações:** consultar metadados do token, sessão de origem, expiração e token substituto; revogar uma renovação ativa com confirmação. Revogação do refresh não é apresentada como encerramento da sessão atual.
- **Senha:** conferir senha atual, nova senha e confirmação; validar mínimo de 12 pontos de código e máximo de 72 bytes UTF-8; após sucesso, limpar a sessão e solicitar nova entrada.
- **Recuperação:** orientar o titular ao fluxo público existente. A tela não oferece consulta/cancelamento administrativo de pedidos que o serviço não expõe.

### 5. Modelar e atribuir acesso

1. Selecionar o contexto administrativo, conferindo nome, código, UUID e situação. A seleção geral depende de leitura na plataforma; o campo por UUID permite consultar diretamente um contexto autorizado.
2. Distinguir perfis pertencentes ao contexto de perfis disponíveis para atribuição, incluindo perfis compartilhados elegíveis.
3. Criar perfil global, de escopo ou de empresa; selecionar permissões por descrição/código/módulo/serviço. A composição pode ser definida já na criação.
4. Consultar os dados atuais do perfil e sua composição antes de editar. Selecionar/desmarcar as permissões visíveis; preservar permissões existentes ausentes do catálogo consultado; impedir novas seleções descontinuadas.
5. Editar nome, situação e composição; registrar motivo; enviar a versão lida. Perfis sem `manageable` e ROOT permanecem de consulta. Inativação e exclusão têm confirmação própria.
6. Atribuir um perfil usando a lista de disponíveis; conferir a identidade por UUID antes da operação; registrar motivo e contexto.
7. Consultar atribuições diretas ou herdadas, inclusive revogadas; filtrar identidade no servidor; revogar com justificativa. A confirmação informa quando a origem ancestral impacta outros descendentes.

### 6. Restringir e delegar

- Criar negação para identidade ou perfil, escolhendo a permissão e o contexto. Exibir motivo, situação, criação e alcance; consultar também o histórico revogado. Revogar avisa que concessões existentes podem passar a valer.
- Criar delegação de autoridade para uma identidade e permissão, definindo se pode redelegar. Explicar a diferença entre autoridade de gestão e acesso operacional. Consultar e revogar com motivo e versão.

### 7. Administrar escopos e entender decisões

- Consultar ancestrais e descendentes; abrir um contexto; criar, renomear, mudar estado ou superior; excluir após confirmação. O serviço valida ciclos, dependências, jurisdição e ganhos de acesso. A raiz protegida não pode ser desabilitada, reparentada ou excluída pela interface.
- Conferir a identidade e consultar permissões efetivas no escopo selecionado. Exibir permitido/bloqueado e o motivo: concessão, negação explícita, ausência de concessão, identidade inativa, permissão desconhecida ou recurso indisponível.
- Abrir Explicar decisão para observar efeito, origem direta/herdada, perfil e evidência retornados pelo avaliador. A tela não recalcula o resultado localmente.
- Consultar auditoria por evento/correlação com paginação do servidor; abrir responsável, recurso, escopo, motivo, data e estados antes/depois.

### 8. Governança e integrações

- Consultar catálogo por descrição, código, módulo, proprietário e situação. Cadastrar proprietário/namespace; consultar revisões e manifesto; inicializar autoridade de catálogo no fluxo reservado do serviço.
- Listar clientes técnicos; cadastrar serviço, operações, raízes, chave pública e expiração; configurar habilitação/operações/raízes com versão; rotacionar ou revogar chave; vincular recurso a um escopo elegível. Chaves privadas não são solicitadas. O contrato aceita RSA de 2048–4096 bits, X.509 DER em Base64 e expiração futura em até 90 dias.
- Iniciar transferência ROOT com destinatário distinto, motivo e reautenticação. Consultar pelo UUID e confirmar exclusivamente pela sessão do destinatário com sua própria reautenticação. A tela explica a expiração de dez minutos e a preservação das negações. As regras de governança são aplicadas pelo backend.

## Matriz de endpoints utilizados

Todos os caminhos abaixo recebem o prefixo do gateway **`/api/iam`**. `A` significa `/api/v1/authorization/admin`. Payloads de autorização incluem `reason` (1–500 caracteres) e `correlationId`; revisões/revogações versionadas incluem `version`. Senhas, convites e chaves não entram em logs ou armazenamento da interface.

| Recurso/ação                  | Método e caminho no IIAM                                                                             | Dados relevantes                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Fila e detalhe administrativo | `GET /api/v1/admin/identity-applications[/{id}]`                                                     | Lista simples completa; detalhe atual antes da revisão                      |
| Aprovar                       | `POST /api/v1/admin/identity-applications/{id}/approve`                                              | `tenantId`, `identityKind`, `affiliation.type` e código específico          |
| Rejeitar                      | `POST /api/v1/admin/identity-applications/{id}/reject`                                               | `reason`                                                                    |
| Ficha                         | `GET /api/v1/identities/{id}`                                                                        | Dados discriminados por `kind`, sem credenciais                             |
| Apelido                       | `PATCH /api/v1/identities/{id}/nickname`                                                             | `nickname`                                                                  |
| Ciclo da identidade           | `POST /api/v1/admin/identities/{id}/{activate,disable,reactivate}`                                   | Ação compatível com a situação                                              |
| Convite                       | `POST /authentication/admin/identities/{id}/invitation`                                              | Retorno único `invitation`, usado no fragmento do link                      |
| Empresa                       | `GET /api/v1/tenants/{id}`; `POST /api/v1/admin/tenants`                                             | Consulta; criação com `code`, `name`                                        |
| Nome/ciclo da empresa         | `PATCH /api/v1/admin/tenants/{id}/name`; `POST .../{activate,disable,reactivate}`                    | `name`; ação compatível com estado                                          |
| Minhas sessões                | `GET /authentication/sessions`; `DELETE /authentication/sessions/{sid}`                              | UUID público da sessão                                                      |
| Senha                         | `POST /authentication/password`                                                                      | `currentPassword`, `newPassword`                                            |
| Sessões administrativas       | `GET /authentication/admin/sessions`; `PATCH /authentication/admin/sessions/{id}/logout`             | `page`, `size`; ID numérico                                                 |
| Refresh tokens                | `GET /authentication/admin/refresh-tokens`; `PATCH /authentication/admin/refresh-tokens/{id}/revoke` | Metadados; ID numérico                                                      |
| Perfis próprios/disponíveis   | `GET A/roles`; `GET A/roles/available`                                                               | `scopeId`, `page`, `size`                                                   |
| Perfil e composição atuais    | `GET A/roles/{id}`; `GET A/roles/{id}/permissions`                                                   | `manageable`, `available`, `version`; códigos da composição                 |
| Criar/editar perfil           | `POST A/roles`; `PATCH A/roles/{id}`                                                                 | Nome, propriedade/owner na criação, situação na edição, permissões          |
| Ciclo/exclusão                | `POST A/roles/{id}/lifecycle`; `DELETE A/roles/{id}`                                                 | Situação, versão, motivo e correlação                                       |
| Atribuições                   | `GET/POST A/assignments`; `POST A/assignments/{id}/revoke`                                           | Consulta com `scopeId`, `identityId`, `inherited`; criação com `roleId`     |
| Negações                      | `GET/POST A/denies`; `POST A/denies/{id}/revoke`                                                     | Permissão, escopo, identidade **ou** perfil; histórico completo do contexto |
| Delegações                    | `GET/POST A/delegations`; `POST A/delegations/{id}/revoke`                                           | Identidade, permissão, escopo, `redelegable`                                |
| Escopos                       | `GET/POST A/scopes`; `GET/PATCH/DELETE A/scopes/{id}`                                                | Código/nome, `parentId`, estado; alterações versionadas                     |
| Ancestrais                    | `GET A/scopes/{id}/ancestors`                                                                        | Paginação do servidor                                                       |
| Catálogo de permissões        | `GET A/catalog/permissions`                                                                          | Catálogo visível no contexto                                                |
| Diagnóstico                   | `GET A/effective-permissions`; `GET A/decisions/explain`                                             | `identityId`, `scopeId`, e `permission` para explicar                       |
| Auditoria                     | `GET A/audit`                                                                                        | `scopeId`, `event`, `correlationId`, `page`, `size`                         |
| Proprietários/revisões        | `GET/POST A/catalog/owners`; `GET A/catalog/owners/{service}/revisions[/{version}]`                  | Serviço, namespace; revisões/manifesto                                      |
| Autoridade inicial            | `POST A/catalog/initial-authority`                                                                   | `permission`, `rootScopeId`                                                 |
| Clientes técnicos             | `GET/POST A/service-clients`; `GET/PATCH A/service-clients/{service}`                                | Operações, raízes, habilitação, versão; chave/expiração na criação          |
| Chaves técnicas               | `POST A/service-clients/{service}/keys`; `POST .../keys/{key}/revoke`                                | Chave pública/expiração; chave UUID na revogação                            |
| Recursos técnicos             | `POST A/service-clients/{service}/resources`                                                         | `type`, `resourceId`, `scopeId`                                             |
| Transferência ROOT            | `POST A/root/transfers`; `GET A/root/transfers/{id}`; `POST .../{id}/confirm`                        | Destinatário, escopo, senha e motivo na iniciação; senha na confirmação     |

## Permissões e proteção dos fluxos

- Revisão: `IDENTITY_APPLICATION_REVIEW`; leitura de terceiros: `IDENTITY_READ`; alterações: `IDENTITY_MANAGE`; convite: `AUTHENTICATION_INVITATION_CREATE`.
- Empresas: `TENANT_READ` e `TENANT_MANAGE`, com validação no contexto do tenant pelo serviço.
- Segurança administrativa: `AUTHENTICATION_SESSION_READ`/`AUTHENTICATION_SESSION_LOGOUT` e `AUTHENTICATION_REFRESH_TOKEN_READ`/`AUTHENTICATION_REFRESH_TOKEN_REVOKE`.
- Consultas de política e auditoria: `AUTHORIZATION_AUDIT_READ` no contexto. Mutações exigem a autoridade específica de perfil, atribuição, negação, delegação, escopo ou catálogo e suas regras de jurisdição/ganho de acesso.
- Clientes técnicos: leitura de auditoria na plataforma; mudanças exigem `AUTHENTICATION_SERVICE_MANAGE` e, quando aplicável, `AUTHORIZATION_SCOPE_MANAGE` nas raízes/recursos.
- ROOT: `AUTHORIZATION_ROOT_RECOVERY`, atribuição ROOT válida, destinatário ativo distinto e as validações de duas sessões/reautenticação do serviço.

## Paginação, limites e lacunas verificadas

1. Solicitações retornam uma lista simples completa. Busca, ordenação e paginação de dez itens são locais. Indicadores representam a lista recebida, sem inventar totais de identidades.
2. Coleções de autorização agregam páginas de cem itens, com limite de cem páginas. Não se apresenta uma coleção parcial como completa: ao atingir o limite, a interface informa erro e pede um escopo mais restrito.
3. Sessões e refresh tokens administrativos retornam listas paginadas sem total. A interface consulta vinte por página e oferece próxima enquanto vier uma página cheia. Uma página final vazia é possível. Busca/filtros e indicadores explicitam o alcance da página.
4. Auditoria, proprietários, revisões e clientes técnicos usam paginação do servidor com o total informado. Consulta de identidades não é simulada por uma lista administrativa inexistente.
   A seleção de empresas também consulta páginas do servidor, com dez opções por página e total autorizado, sem carregar todo o diretório no navegador.
5. A busca de empresas usa `GET /api/v1/tenants?q=&status=ACTIVE&page=0&size=10` (prefixo do gateway `/api/iam`). `status` aceita ACTIVE, PENDING, DISABLED ou ALL; ACTIVE é o padrão; `size` permite 1–100. Nome/código são pesquisados sem diferenciar maiúsculas; `%`, `_` e barra invertida são tratados literalmente. Itens e total são filtrados por TENANT_READ efetivo por empresa, incluindo herança e negações, **antes** da paginação; não basta confiar nas authorities da plataforma. Não há diretório geral de identidades: os atalhos de identidades aprovadas e consultas por UUID continuam disponíveis.
6. Os controllers atuais não oferecem CRUD/listagem de afiliações para gestão independente após a aprovação. A interface apresenta o vínculo criado e seu identificador na revisão, sem prometer edição inexistente.
7. Não há consulta/cancelamento administrativo de recuperação ou edição genérica de CPF/CNPJ/e-mail/dados pessoais. Apenas a alteração de nickname está exposta. Autoexclusão do titular (`DELETE /api/v1/identities/me`) permanece fora desta console administrativa; cadastro público, entrega de desafios, PDP e sincronização máquina a máquina preservam seus fluxos existentes.
8. `PUT A/roles/{id}/permissions`, `POST A/scopes/{id}/reparent`, leitura isolada de sessão/token e rotas de perfis por tenant continuam disponíveis no serviço. A tela usa a edição combinada de perfil/escopo, listas com metadados e perfis disponíveis no escopo para evitar controles duplicados.

## Verificação

- `npm run test:iam`: contratos anteriores e novos contratos administrativos, paginação, fronteiras UUID/ID numérico, motivo/versão/correlação, histórico, filtros e fuso horário.
- `npm run test:iiam-auth`: transporte autenticado e fluxos públicos preservados.
- ESLint dos arquivos alterados e TypeScript do projeto.
- Revisão visual local com dados sintéticos, usando os componentes reais. Não valida disponibilidade, permissões ou alterações em um backend implantado.
- Suíte completa `npm test` aprovada, incluindo os testes dos demais módulos. Compilação otimizada `npm run build` concluída com TypeScript e geração de páginas, em `.runtime/iiam-ui-build`, com configuração isolada; a configuração principal do projeto foi preservada.
- Navegador: verificados lista e revisão de solicitação, campos condicionais de vínculo, ficha, sessão atual, referências com nome, composição de perfil, conferência do destinatário, diagnóstico/explicação, auditoria antes/depois e configuração de cliente técnico. Temas claro/escuro e viewports desktop/celular; largura da página no celular igual à largura disponível, sem transbordamento do documento. Escape fecha o diálogo e restaura o foco.
- A página temporária de revisão foi removida e seu servidor encerrado antes da entrega. Backend, gateway e frontend previamente em execução não foram reiniciados. As operações contra dados reais dependem de homologação integrada posterior.
- Correção de seleção de empresas: diretório no IIAM com 39 testes HTTP/integração aprovados; testes de contrato do frontend para nome/código, filtros e paginação; revisão no navegador da seleção automática da única empresa ativa, busca por nome, aprovação simulada com vínculo EMPLOYEE e navegação para a gestão de empresas. Não utiliza UUID digitado nesses fluxos.

As fontes dos contratos são os controllers/DTOs/use cases do serviço local `imarui-identity-and-access-manager-service`, principalmente `AuthorizationAdminController`, `AuthenticationController`, `AdminIdentityApplicationController`, `AuthorizationQueries`, `SecurityAuditController`, `TechnicalClientController` e `RootRecoveryController`.
