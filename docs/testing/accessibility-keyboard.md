# Validação manual de acessibilidade antes da banca

Issue: #64. Esta lista registra os testes **a executar em navegador real**; a existência deste documento não comprova que eles foram realizados.

## Preparação

- Utilizar dados e contas **fictícios** para testar rotas autenticadas e compartilhamento.
- Testar em um navegador de desktop (Chrome ou Firefox), sem mouse, usando `Tab`, `Shift+Tab`, `Enter`, `Espaço` e setas quando aplicável.
- Repetir a conferência visual de contraste e foco nos temas claro e escuro; conferir também zoom de 200%.
- Quando disponível, revisar nomes e mensagens com leitor de tela, como NVDA ou VoiceOver.

## Percurso pelo teclado

- [ ] **Boas-vindas (`/`):** acessar os links Começar, Entrar e Política de Privacidade pelo teclado; confirmar foco visível.
- [ ] **Carrossel:** alcançar o carrossel e seus controles; testar setas esquerda/direita, Home/End, indicadores e o botão Pausar/Reproduzir; conferir leitura dos rótulos.
- [ ] **Cadastro e login (`/auth/register`, `/auth/login`):** percorrer todos os campos; submeter com teclado; verificar foco e leitura de erros, sem prender o foco.
- [ ] **Onboarding:** marcar o checkbox, ler a política de privacidade e avançar por ambas as etapas; verificar erros nos campos.
- [ ] **Home e navegação:** acessar menu lateral e navegação inferior; não exigir gestos do mouse.
- [ ] **Mamada, sono e fralda:** iniciar, finalizar e selecionar opções por teclado, inclusive mensagens de confirmação.
- [ ] **Histórico:** acessar filtros, links dos registros, edição e exclusão com confirmação.
- [ ] **Comandos de voz:** acionar controles, verificar estados/erros e oferecer alternativa manual sem depender do microfone.
- [ ] **Perfil e convites:** editar dados, alternar bebê/tema, gerar ou copiar convite e remover acesso com as confirmações necessárias.
- [ ] **Meus dados e privacidade:** acessar a política, exportação e solicitação de exclusão, observando a ordem de tabulação.
- [ ] **Página 404:** abrir uma rota inválida, localizar o título e usar o link Voltar ao início via teclado.

## Critérios

- Não há armadilhas de foco; a sequência de tabulação acompanha a ordem visual e lógica.
- Todo controle interativo possui nome acessível e indicador de foco visível.
- A seleção de um botão não depende apenas de cor; estados, alertas e erros são perceptíveis.
- Componentes e formulários continuam utilizáveis em telas estreitas, no modo escuro, com zoom e movimento reduzido.
- Registrar eventuais falhas com rota, navegador, modo de cor, passos para reproduzir e captura sem dados pessoais.

## Alterações automatizadas relacionadas

Os testes de `src/app/core/accessibility/color-contrast.spec.ts` verificam os principais tokens de texto de ambos os temas. Eles **não substituem** a auditoria visual de todos os elementos, elementos com cores específicas nem a validação manual de teclado/leitor de tela.
