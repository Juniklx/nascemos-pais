# Nascemos Pais

O **Nascemos Pais** é uma aplicação web responsiva criada para ajudar mães, pais e cuidadores a organizar a rotina dos primeiros meses de um bebê.

O projeto nasceu da necessidade de reduzir o esforço de registrar atividades importantes do dia a dia, como mamadas, períodos de sono e trocas de fralda, especialmente em momentos em que os cuidadores estão cansados ou com pouco tempo disponível.

## Problema

Nos primeiros meses do bebê, é comum que os cuidadores precisem acompanhar diversos acontecimentos ao longo do dia:

- horários e duração das mamadas;
- períodos de sono;
- trocas de fralda;
- sequência das atividades;
- informações importantes para acompanhar a rotina do bebê.

Fazer esses registros manualmente ou depender apenas da memória pode se tornar difícil em uma rotina intensa.

O Nascemos Pais centraliza essas informações em uma interface simples e acessível.

## Funcionalidades

### Autenticação

- criação de conta com e-mail e senha;
- login com e-mail e senha;
- login com Google;
- sessão autenticada com Firebase Authentication;
- isolamento dos dados por usuário.

### Onboarding

O primeiro acesso solicita:

- nome do cuidador;
- nome do bebê;
- data de nascimento do bebê;
- consentimento para armazenamento dos dados utilizados pelo MVP.

### Mamada

- iniciar e finalizar uma mamada;
- acompanhar a duração em tempo real;
- registrar lado esquerdo ou direito;
- alternar os lados durante a mamada;
- manter mamadas em andamento após recarregar a página.

### Sono

- iniciar e finalizar períodos de sono;
- acompanhar a duração;
- manter registros em andamento após recarregar a aplicação.

### Fralda

Registro rápido de:

- molhada;
- suja;
- ambas.

### Home

A página inicial apresenta:

- saudação personalizada;
- informações do bebê;
- idade do bebê;
- atividades recentes;
- última atividade concluída;
- atalhos para novos registros.

### Histórico

- visualização dos registros anteriores;
- detalhes de mamadas, sono e fraldas;
- edição dos registros;
- exclusão com confirmação.

### Comandos de voz

A aplicação possui suporte a comandos de voz compatíveis com o recurso de reconhecimento de fala disponível no navegador.

Exemplos:

- `registrar mamada`;
- `finalizar mamada`;
- `iniciar sono`;
- `finalizar sono`;
- `registrar fralda suja`.

O objetivo é permitir registros rápidos em situações em que digitar ou navegar pela interface não seja conveniente.

## Persistência de dados

Os dados são armazenados no **Cloud Firestore** e associados ao UID fornecido pelo Firebase Authentication.

Estrutura principal:

```text
users/{uid}

users/{uid}/feedings/{feedingId}
users/{uid}/sleeps/{sleepId}
users/{uid}/diapers/{diaperId}
```

Cada usuário possui acesso apenas aos próprios dados.

Dados criados em versões anteriores que utilizavam `localStorage` podem ser migrados para o Firestore. Após a confirmação da migração, o armazenamento local deixa de ser a fonte de verdade.

## Segurança

O projeto utiliza regras do Cloud Firestore para restringir o acesso aos dados.

Cada usuário autenticado pode acessar somente documentos vinculados ao próprio UID.

Também existem testes automatizados das regras utilizando o **Firebase Emulator Suite**.

Entre os cenários testados estão:

- acesso sem autenticação;
- leitura dos próprios dados;
- tentativa de acessar dados de outro usuário;
- tentativa de gravar dados em outra conta;
- rejeição de documentos inválidos.

## LGPD e privacidade

O Nascemos Pais trabalha com dados relacionados ao cuidador e ao bebê, portanto privacidade e controle de acesso fazem parte das decisões de arquitetura do projeto.

Neste MVP:

- o usuário é informado sobre os dados utilizados durante o onboarding;
- o consentimento é registrado;
- os dados ficam associados à conta autenticada;
- as regras do Firestore impedem que uma conta acesse os dados de outra;
- o aplicativo não armazena o áudio utilizado nos comandos de voz.

Quando o reconhecimento de voz é utilizado, o processamento pode depender do serviço disponibilizado pelo navegador.

As medidas implementadas fazem parte da proteção técnica do MVP e não substituem uma análise jurídica completa de conformidade para uma operação comercial em produção.

## Tecnologias

- Angular 20
- TypeScript
- HTML
- CSS
- Angular Signals
- Angular Reactive Forms
- Angular Router
- Firebase Authentication
- Cloud Firestore
- Firebase Emulator Suite
- Jasmine
- Karma
- GitHub Actions
- Vercel

## Como executar o projeto

### Pré-requisitos

- Node.js 22 ou compatível;
- npm;
- navegador baseado em Chromium para execução dos testes;
- Java 21 ou superior para os testes do Firestore Emulator.

Clone o repositório:

```bash
git clone https://github.com/Juniklx/nascemos-pais.git
```

Entre no diretório:

```bash
cd nascemos-pais
```

Instale as dependências:

```bash
npm ci
```

Inicie o ambiente de desenvolvimento:

```bash
npm start
```

A aplicação ficará disponível normalmente em:

```text
http://localhost:4200
```

## Build de produção

```bash
npm run build
```

Os arquivos compilados serão gerados no diretório `dist`.

## Testes

### Testes Angular

```bash
npm test -- --watch=false --browsers=ChromeHeadless
```

A suíte atual possui **84 testes Angular**.

### Testes das regras do Firestore

Com o Firebase Emulator:

```bash
npx firebase-tools@latest emulators:exec --only firestore --project nascemos-pais "npm run test:firestore-rules"
```

A suíte atual possui **6 testes das regras do Firestore**.

Os testes Angular e os testes das regras do Firestore também são executados automaticamente pelo GitHub Actions nos Pull Requests direcionados à branch `master`.

## Deploy

A aplicação é publicada utilizando a **Vercel**.

O projeto utiliza fallback de SPA para permitir acesso direto a rotas internas do Angular, como:

```text
/auth/login
/home
/history
```

sem retornar erro 404 do servidor.

## Limitações atuais do MVP

Nesta versão ainda não estão incluídos:

- compartilhamento do mesmo bebê entre diferentes contas ou cuidadores;
- upload de fotos e arquivos;
- notificações push;
- painel administrativo;
- recuperação avançada ou exportação de dados;
- sincronização em tempo real entre múltiplos dispositivos;
- aplicação nativa para Android ou iOS.

O reconhecimento de voz também depende da disponibilidade e compatibilidade da API utilizada pelo navegador.

## Status do projeto

O Nascemos Pais está sendo desenvolvido como projeto final da trilha de Programação Front-End.

Apesar de ter sido concebido inicialmente para apresentação acadêmica, o projeto foi estruturado para permitir evolução após a entrega do MVP.

## Autor

Desenvolvido por **Marcelo Soares Teixeira Junior**.