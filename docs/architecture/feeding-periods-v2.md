# ADR 001 — Períodos de mamada escaláveis no Firestore

**Estado:** protótipo de transações e regras validado no Emulator Suite; não integrado ao aplicativo nem implantado. **Issue:** #53.
**Base atual:** `master`, após o Squash and merge do PR #52. Branch de desenvolvimento: `design/scalable-feeding-periods`.

## Motivação e restrições

O formato atual salva toda a lista `periods` no documento
`babies/{babyId}/feedings/{feedingId}`. A validação elemento a elemento nas
Firestore Rules alcançou o limite de 1.000 expressões para listas maiores.
O PR #52 implementa validação integral até seis períodos como proteção
provisória; a solução definitiva não deve impor esse limite.

Manter o plano Firebase Spark, Firestore e regras verificáveis no Emulator
Suite. Não exigir Cloud Functions para iniciar ou alternar lados. Preservar
histórico, controle de autoria, sincronização entre responsáveis e o lock
`babies/{babyId}/activeActivities/feeding`.

## Modelo de armazenamento proposto

```text
babies/{babyId}/feedings/{feedingId}
  id, startedAt, endedAt, side
  createdByUid, finishedByUid?
  storageVersion: 2
  periodCount: N
  lastPeriodStartedAt: timestamp
  # durationsCompletedMs (por lado) pode ser introduzido após definir
  # regras que validem deltas contra o período que está sendo fechado.
  # NÃO gravar um array periods paralelo.

babies/{babyId}/feedings/{feedingId}/periods/{zeroPaddedIndex}
  index: número inteiro a partir de 0
  startedAt: timestamp em milissegundos
  endedAt: timestamp em milissegundos ou null
  side: left | right | null
```

Os IDs indexados e imutáveis (por exemplo `00000000`, `00000001`)
permitem detectar saltos. Não reutilizar um índice. O documento pai contém
apenas estado atual/resumo; períodos individuais permitem validar somente
os documentos alterados a cada troca. `periodCount` não prova sozinho que
toda a coleção está correta; as regras precisam exigir invariantes em cada
transição. Não conceder escrita genérica à subcoleção.

### Transições atômicas a provar com Rules

1. **Iniciar:** em um único lote/transação, criar o pai v2 com
   `periodCount=1`, primeiro período aberto, `side=null` e lock apontando
   para a mamada. Bloquear uma segunda mamada em andamento do mesmo bebê.
2. **Trocar lado:** transação **online** que lê o pai, último período e lock
   antes de qualquer escrita. Fechar somente o último período aberto,
   criar o próximo em `index=periodCount`, atualizar no pai `periodCount`,
   `side` e `lastPeriodStartedAt`. O fim do anterior deve ser exatamente
   o começo do seguinte. Revalidar vínculo e lock ao confirmar.
3. **Finalizar:** transação que fecha o último período, registra `endedAt`
   no pai, fixa `finishedByUid` e remove o lock na mesma operação.
4. **Concorrência:** transações que leem o pai e o último período devem
   conflitar/repetir quando outro responsável troca o lado primeiro.
   Recalcular o estado na repetição, não reaplicar um array antigo.
   A função de transação não deve modificar signals do Angular antes
   do commit. Ao falhar ou ficar offline, não exibir êxito.
5. **Edição do histórico:** definir operação própria e testes para
   períodos de mamadas concluídas. Até essa operação estar disponível,
   a interface deve comunicar que a divisão v2 não é editável;
   **nunca** sobrescrever o pai v2 com a antiga API de `periods`.
6. **Exclusão:** apagar apenas o documento pai deixa os períodos órfãos.
   Antes de habilitar exclusão de registros v2, definir remoção
   paginada confiável que inclua a subcoleção, respeitando também a
   futura exclusão de conta e dados compartilhados (#49).

As regras de cada período devem restringir criação ao índice seguinte,
bloquear alteração retroativa de períodos fechados e negar gravações
isoladas que não acompanhem a transição necessária do pai. As regras do
pai devem validar `storageVersion` imutável, estado anterior/próximo,
atribuição/autorização e referências do período/lock após a transação.
Construir testes de bypass, não presumir essas garantias apenas por usar
`getAfter()`.

**Orçamento das Rules:** validar empiricamente os limites de chamadas
`get/exists/getAfter` por operação e por lote, **além** do orçamento
de expressões. Testar cada transição no Emulator Suite e rejeitar
gravações isoladas e batches maliciosos. Se a abordagem em cliente não
couber nesse orçamento, redesenhar a transição; não reduzir
silenciosamente as proteções.

## Compatibilidade e migração sem perda de dados

- Documentos legados `users/{uid}/feedings` e compartilhados com
  `periods: null` continuam representando registros sem divisão.
  Documentos com array `periods` permanecem v1, inclusive casos
  encontrados futuramente com mais de seis períodos. Não interpretar
  `periods: null` como v2: verificar **explicitamente**
  `storageVersion === 2`.
- **Leitura dupla:** parser/serviço seleciona v1 por ausência de
  `storageVersion`; v2 exige ler todos os períodos necessários,
  ordenar por `index`, verificar contagem/continuidade e recusar
  apresentação como histórico completo se algum documento faltar.
- Não migrar automaticamente durante a leitura. Migração v1→v2
  deve ser idempotente, com verificação de contagem, ordem, conteúdo,
  direitos de acesso e evidência de conclusão **antes** de trocar
  o formato ativo. Lotes grandes podem exigir etapas e checkpoint.
  Falha parcial deixa v1 intacto e v2 ignorado.
- Períodos antigos acima de seis encontrados posteriormente são
  **preservados** e encaminhados ao fluxo de migração; não truncar
  nem tentar regravar automaticamente com as regras provisórias.
- A etapa de rollout deve prever usuários com versão antiga do
  frontend aberta em outra aba. Habilitar gravações v2 somente
  após validação das Rules, leitores v1/v2, compatibilidade entre
  versões e estratégia de rollback.

## Integrações impactadas (obrigatórias)

- `FeedingService`, `BabyDataRepository`,
  `ActivityPersistenceService` e `FirestoreGateway`:
  novos métodos específicos de transação e hidratação; não usar
  `saveRecord(..., 'feedings', feeding)` para modificar v2.
- `ActivityPersistenceService.watchRecords`:
  hoje observa apenas a coleção de pais. Implementar hidratação
  dos períodos v2 e invalidar seus dados corretamente ao trocar
  bebê, perder vínculo ou mudar sessão. Evitar consultas em cascata
  não paginadas de todo o histórico: carregar resumos e buscar
  detalhes apenas quando necessários.
- Tela de mamada/histórico: manter cronômetro, lado selecionado,
  soma por lado e atualização entre aparelhos, com estado de
  carregamento e erro explícito quando os períodos estiverem incompletos.
- Exportação LGPD da `master` (PR #50): a branch experimental agora
  consulta também as subcoleções v2 diretamente no servidor, valida
  continuidade e contagem com o mesmo hidratador usado no histórico e
  inclui os períodos no JSON com `storageVersion`, `periodCount` e
  referências ao último período. A identidade de outros responsáveis
  continua anonimizada e erros interrompem a exportação sem arquivo parcial.
  O schema global do JSON permanece 1, com campos extras somente nos
  registros identificados como v2.
- Exclusão por solicitação e exclusão de bebê compartilhado:
  considerar a nova subcoleção, eventuais referências históricas
  e backups no plano da issue #49.

## Progresso experimental (não disponibilizado na interface)

- O protótipo `FeedingV2TransactionRepository` implementa início, troca de lado e
  finalização em transações que leem pai, último período e lock antes das
  escritas. Ainda não é injetado pelo `FeedingService` ou pelo histórico.
- Firestore Rules v2 foram acrescentadas em uma **branch experimental**
  paralelamente às regras v1. Exigem lote atômico e negam alteração retroativa,
  período órfão, índice fora de sequência, resumo divergente e acesso de
  contas sem vínculo. **Não publicar essas regras isoladamente:** um
  cliente autorizado poderia criar documentos v2 que o aplicativo v1
  atual ainda não consegue apresentar.
- Os testes do Emulator Suite passaram para início, troca, encerramento,
  duas contas autorizadas, histórico com 13 períodos, escrita concorrente
  disputando o mesmo índice, recusas por acesso e tentativas de bypass.
  Os testes Angular incluem transações simuladas e hidratação v2, mas
  **a implementação TypeScript do repositório ainda precisa de teste
  integrado diretamente contra o emulador** antes de ser conectada à UI.
- CI #133 (anterior à atualização da branch) aprovado: compilação de produção, testes Angular e Rules v2. Após atualizar a base para `master`, é necessário executar novamente a CI neste novo commit.
  Permanecem pendentes integração da escrita real, edição/exclusão segura,
  paginação, migração idempotente e testes adicionais com
  mudanças de vínculo simultâneas, reconexão e rollback.

## Leitura compatível em desenvolvimento

A camada experimental passa a identificar `storageVersion=2`, consultar
pai e períodos diretamente do servidor e recusar históricos v2 incompletos.
O listener descarta resultados assíncronos obsoletos e mantém a sincronização
como pendente até todos os períodos serem verificados. O histórico v1 permanece
no formato atual. Mamadas v2 ficam **somente leitura** na interface nesta fase.

**Antes de qualquer merge ou deploy:** a exportação LGPD v2 já consulta
períodos filhos e recusa registros parciais, mas ainda requer revisão
integrada no emulador e validação de concorrência. Carregamento progressivo/
paginação, exclusão segura de subcoleções e migração continuam pendentes.
As regras experimentais v2 não podem ser publicadas separadamente da
escrita validada, dos mecanismos de exclusão e do plano de rollout.

## Exportação dos dados v2 (branch experimental)

`PrivacyDataExportService` busca todos os períodos das mamadas v2 vinculadas
à conta diretamente no servidor e chama `FeedingV2Reader` para verificar
o estado do documento pai e cada período antes de montar o arquivo.
O formato v1 permanece inalterado; v2 acrescenta o identificador do
formato, a contagem e o resumo do último período. As listas são
reordenadas cronologicamente e dados internos, como UIDs de outros
responsáveis, não são enviados ao JSON.

Se um período faltar, um resumo mudar, a conta trocar ou o acesso for
revogado, a exportação falha em vez de gerar arquivo incompleto.
Esse fluxo **não é um snapshot global transacional** entre todas as
coleções; alterações durante uma exportação extensa ainda podem
exigir nova tentativa. A liberação em produção depende de testes
integrados adicionais e da conclusão dos demais bloqueios de rollout.

## Estratégia de entregas e testes

- **Fase 1:** definir e testar um parser puro de hidratação v2
  (casos válidos e inconsistências); não alterar armazenamento real.
- **Fase 2:** implementar repositório e Rules v2 com emuladores,
  transações de início/troca/fim e testes positivos/negativos e
  concorrência. Respeitar o plano Spark.
- **Fase 3:** integrar leitura dupla, realtime e UI com proteção
  de edição/exclusão de v2; testar sessões, perda de acesso e offline.
- **Fase 4:** integrar exportação LGPD e migração idempotente de
  dados v1, inclusive dados legados não inspecionados. Testar rollback.
- **Fase 5:** validar manualmente com dois responsáveis e várias
  trocas, e somente então decidir sobre merge e implantação.

O PR #52 já foi integrado à `master`. Este ADR não considera a
implementação v2 pronta nem autoriza excluir/transformar documentos
em produção.

## Referências técnicas

- Firestore: [Rules e getAfter](https://firebase.google.com/docs/firestore/security/rules-conditions).
- Firestore: [transações e concorrência](https://firebase.google.com/docs/firestore/manage-data/transactions).
- Firestore: [subcoleções não são excluídas com o documento pai](https://firebase.google.com/docs/firestore/manage-data/delete-data).
