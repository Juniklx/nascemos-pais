# Exclusão de conta: pré-verificação e implementação segura

Estado: **em desenvolvimento**. Nenhuma ação desta branch apaga uma conta ou registros.
Issue relacionada: #49. O PR #50 contém a política de privacidade e o canal de contato.

## Infraestrutura: Firebase Spark

O projeto permanece no plano Spark. O fluxo publicado nesta etapa é somente leitura,
com pedidos de exclusão recebidos pelo canal de privacidade para tratamento individual.
O envio da solicitação não apaga dados.

É possível preparar e testar o processamento futuro com o Firebase Local Emulator Suite
(Authentication, Firestore e Functions), usando dados sintéticos e sem alcançar o banco real.
A implantação de Cloud Functions for Firebase requer o plano Blaze. Não habilitar a
exclusão automática até concluir a revisão de permissões, cenários de falha, bases legais,
retenção, backups, custos e mudança de infraestrutura. Evitar substituir a função
confiável por operações destrutivas feitas no navegador.

## Fluxo atual

1. O responsável solicita a exclusão por `privacidade@nascemospais.com.br`, disponível em
   **Perfil → Meus dados**. O primeiro contato não deve conter senhas, documentos ou dados da criança.
2. A página permite consultar uma **prévia informativa** dos bebês identificados na conta,
   diretamente no servidor, distinguindo proprietário de responsável e indicando a quantidade
   de outros vínculos.
3. Essa prévia **não autoriza nem executa a exclusão**. Ela usa o índice
   `users/{uid}/babies` e não é uma descoberta completa de todos os documentos que podem
   mencionar a conta; pode haver índices órfãos, convites antigos ou dados legados.
4. Até o backend estar pronto, os pedidos devem receber acompanhamento humano pelo canal
   de privacidade. Não confirmar que uma conta foi excluída sem evidência técnica da operação.

## Decisões por bebê

| Papel | Condição | Ação exigida |
| --- | --- | --- |
| Responsável | Vínculo em bebê de outra pessoa | Retirar somente o próprio acesso, sem apagar o histórico do bebê nem o acesso dos demais. |
| Proprietário | Outros responsáveis presentes | Confirmar a transferência de propriedade para um responsável elegível **ou** analisar a exclusão do bebê e os efeitos sobre os demais. |
| Proprietário | Sem outros responsáveis | Confirmar expressamente o destino do bebê e dos registros. Não inferir permissão para apagar tudo a partir de um pedido genérico. |

Se a conta tiver vários bebês, a decisão é independente para cada um. A exclusão da conta
não deve deixar bebês sem proprietário nem conceder acesso a usuários previamente removidos.

## Requisitos do backend antes da ativação

- Reautenticação recente, sessão válida e confirmação explícita; o backend precisa verificar
  novamente as permissões, decisões e vínculos, sem confiar na prévia calculada no Angular.
- Descobrir e reconciliar vínculos reais, índices `users/{uid}/babies`, propriedade e
  referências órfãs; o índice do cliente, isoladamente, não é fonte autoritativa.
- Impedir novos convites e gravações durante fases críticas; resolver concorrência com
  convites, remoções, atividades em andamento e mudança de propriedade.
- Tratar `users/{uid}` e subcoleções legadas `feedings`, `sleeps`, `diapers`,
  `notifications` e `babies`; tratar `babies/{babyId}`, `members`,
  `activeActivities` e os registros do bebê **somente quando sua exclusão tiver sido
  autorizada**. Localizar e tratar convites pendentes/aceitos em `babyInvites`, inclusive
  metadados do usuário excluído e referências em outras contas.
- Avaliar a autoria histórica (`createdByUid`, `finishedByUid` e
  `createdByUid` no documento do bebê): desvincular ou tratar conforme política definida,
  sem apagar registros compartilhados que devam permanecer.
- Limitar e paginar operações para coleções grandes, registrar um estado de processamento
  que permita retomada idempotente após falha parcial e não deixar referências quebradas.
- Fazer a remoção no Firebase Authentication **somente após** o sucesso das etapas de dados,
  com estratégias para falha final e para solicitações repetidas.
- Definir e revisar juridicamente prazos operacionais, retenção residual, cópias de segurança,
  hipóteses de conservação e resposta ao titular, antes da operação.
- Concluir os casos de borda de compartilhamento e validação das Firestore Rules da issue #41.

## Testes obrigatórios do processamento real

- Conta somente responsável, proprietário sozinho e proprietário com múltiplos responsáveis.
- Conta com vários bebês e diferentes decisões; convites pendentes, aceitos e expirados.
- Dados legados não migrados, índices divergentes, vínculo removido e autoria histórica.
- Falhas entre etapas, repetição da mesma solicitação, sessões alteradas e operações concorrentes.
- Registros de mamada e sono em andamento e grandes volumes que exijam paginação.
- Verificar que nenhuma outra família perde acesso ou histórico indevidamente e que a conta
  autenticável deixa de existir somente quando a remoção for concluída.

**Proibição:** não implementar uma sequência de exclusões de documentos pelo navegador,
não permitir que o cliente eleve a si mesmo a proprietário e não interpretar o envio
de um e-mail como confirmação da operação.
