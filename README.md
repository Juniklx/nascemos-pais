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
- controle de acesso aos dados de cada bebê conforme o vínculo do usuário.

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
- registrar mamadeira com volume em ml por comando de voz, após confirmação.

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

### Múltiplos bebês

- adicionar mais de um bebê à mesma conta;
- selecionar qual bebê está ativo;
- alternar entre os bebês vinculados;
- manter mamadas, sono, fraldas, Histórico e Home isolados por bebê;
- editar no Perfil apenas o bebê atualmente selecionado.

### Compartilhamento entre cuidadores

- convidar outro responsável para acompanhar um bebê;
- compartilhar o convite por link ou QR Code;
- permitir que uma conta com bebê próprio também acompanhe um bebê compartilhado;
- manter responsáveis, convites e registros vinculados ao bebê correto;
- remover o acesso de um responsável sem afetar os demais bebês da conta.

### Rotina compartilhada em tempo real

- mamadas, sono e fraldas são atualizados automaticamente nos aparelhos dos responsáveis vinculados ao bebê;
- a Home e o Histórico acompanham o bebê atualmente selecionado, incluindo atividades ainda em andamento;
- a duração de mamadas e sonos é calculada localmente a partir dos horários registrados, sem gravações periódicas no Firestore;
- registros novos identificam quem os criou e, quando aplicável, quem os finalizou;
- registros antigos, sem autoria, continuam disponíveis;
- o indicador de sincronização diferencia conexão com o servidor, conexão em andamento e erro;
- ao trocar de bebê ou sair da conta, as assinaturas anteriores deixam de fornecer dados.

### Comandos de voz

A aplicação possui suporte a comandos de voz compatíveis com o recurso de reconhecimento de fala disponível no navegador.

Exemplos:

- `registrar mamada`;
- `finalizar mamada`;
- `iniciar sono`;
- `finalizar sono`;
- `registrar fralda suja`.
- `Lucas dormiu há 15 minutos` (o nome deve ser o do bebê ativo);
- `registrar mamadeira de 120 ml`.

O objetivo é permitir registros rápidos em situações em que digitar ou navegar pela interface não seja conveniente.

## Persistência de dados

Os dados são armazenados no **Cloud Firestore**. A conta autenticada mantém um índice dos bebês aos quais possui acesso e um `activeBabyId` que representa o bebê atualmente selecionado.

Estrutura principal:

```text
users/{uid}
users/{uid}/babies/{babyId}

babies/{babyId}
babies/{babyId}/members/{uid}
babies/{babyId}/feedings/{feedingId}
babies/{babyId}/sleeps/{sleepId}
babies/{babyId}/diapers/{diaperId}

babyInvites/{inviteId}
```

Os listeners do Firestore usam a mesma estrutura e as mesmas regras de acesso. Cada assinante acompanha somente o bebê ativo e recebe atualizações quando outro responsável salva, edita, finaliza ou exclui registros.

Os registros pertencem ao bebê, e não diretamente ao usuário. O acesso é autorizado conforme o vínculo em `babies/{babyId}/members/{uid}`, permitindo que diferentes cuidadores acompanhem o mesmo bebê sem misturar registros de outros bebês.

Dados criados em versões anteriores que utilizavam `localStorage` ou a estrutura legada por usuário podem ser migrados para a estrutura atual.

## Segurança

O projeto utiliza regras do Cloud Firestore para restringir o acesso aos dados.

Cada bebê possui vínculos de responsáveis com papéis de proprietário ou cuidador. As regras validam esses vínculos antes de permitir leitura ou gravação dos dados compartilhados.

Também existem testes automatizados das regras utilizando o **Firebase Emulator Suite**.

Entre os cenários testados estão:

- acesso sem autenticação;
- acesso de proprietário e cuidador aos dados do bebê vinculado;
- tentativa de acessar dados de um bebê sem vínculo;
- criação e remoção de vínculos;
- aceitação de convites;
- rejeição de documentos inválidos.

## LGPD e privacidade

O Nascemos Pais trabalha com dados relacionados ao cuidador e ao bebê, portanto privacidade e controle de acesso fazem parte das decisões de arquitetura do projeto.

Neste MVP:

- o usuário é informado sobre os dados utilizados durante o onboarding;
- o consentimento é registrado;
- os dados ficam associados aos bebês e aos vínculos autorizados de cada conta;
- as regras do Firestore impedem o acesso a bebês sem vínculo válido;
- o aplicativo não armazena o áudio utilizado nos comandos de voz.

Quando o reconhecimento de voz é utilizado, o processamento pode depender do serviço disponibilizado pelo navegador.

As medidas implementadas fazem parte da proteção técnica do MVP e não substituem uma análise jurídica completa de conformidade para uma operação comercial em produção.

## Controle dos dados e privacidade

A rota pública `/privacidade` reúne informações sobre os dados coletados, suas finalidades,
a infraestrutura utilizada e os direitos dos titulares. O controlador está identificado como
Marcelo Soares Teixeira Junior (pessoa física) e o canal informado para exercício de direitos
e dúvidas é `privacidade@nascemospais.com.br`, cuja configuração e etapa de teste
foram confirmadas pelo responsável pelo projeto.

A localização informada pelo responsável para o Cloud Firestore é
`southamerica-east1` (São Paulo, Brasil). Essa configuração se refere ao banco do Firestore;
o Firebase Authentication processa dados nos Estados Unidos, e o site é distribuído pela
infraestrutura global da Vercel. Ainda é necessário verificar os fluxos de dados, os
contratos dos fornecedores e os mecanismos legais aplicáveis às transferências
internacionais.

Fontes técnicas: [localizações do Firestore](https://firebase.google.com/docs/firestore/locations),
[privacidade e locais de processamento do Firebase](https://firebase.google.com/support/privacy)
e [rede global da Vercel](https://vercel.com/docs/regions).

A política permanece identificada como **rascunho** enquanto não forem revisados
as bases legais específicas, a retenção, as condições de fornecedores e as transferências
internacionais, com validação jurídica. Não publicar esta versão como política definitiva
até concluir essa revisão.

No Perfil, o usuário autenticado pode abrir `/meus-dados` e gerar um arquivo JSON de seus dados
e dos registros de bebês aos quais possui acesso. A exportação exige consulta online ao Firestore,
omite identificadores pessoais dos demais responsáveis e inclui registros legados que ainda possam
estar associados à conta. Não se trata de um backup transacional nem de exportação de credenciais.

Decisão de retenção do produto: não há exclusão automática por inatividade. Os dados
ficam disponíveis enquanto necessários às finalidades de organização e compartilhamento
da rotina. O término do tratamento também se aplica se a finalidade deixar de existir,
se os dados se tornarem desnecessários ou nas demais hipóteses previstas na LGPD,
não apenas quando houver pedido expresso.

Solicitações de exclusão podem ser encaminhadas para
`privacidade@nascemospais.com.br` pela tela `/meus-dados`. O link abre o aplicativo de
e-mail e **não exclui nada automaticamente**. A legitimidade e os efeitos sobre
bebês compartilhados precisam ser avaliados antes da execução.

A exclusão definitiva de conta exige backend confiável e tratamento especial para bebês
compartilhados; está registrada na issue #49. Os prazos operacionais, a política de
backups e eventuais hipóteses de conservação ainda exigem definição e revisão jurídica.

A prévia de exclusão de `/meus-dados` consulta os vínculos no servidor, sem apagar
registros e sem garantir que eventuais referências órfãs foram identificadas. O desenho
do processamento seguro, as limitações dessa prévia e os testes necessários estão
descritos em [docs/privacy/account-deletion.md](docs/privacy/account-deletion.md).

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

### Testes das regras do Firestore

Com o Firebase Emulator:

```bash
npx firebase-tools@latest emulators:exec --only firestore --project nascemos-pais "npm run test:firestore-rules"
```

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

### Login com Google

No projeto `nascemos-pais` do Firebase Console, confira **Authentication → Sign-in method → Google** e habilite o provedor. Em **Authentication → Settings → Authorized domains**, adicione o domínio exato usado para abrir o site na Vercel (somente o host, sem `https://` e sem caminho). Se testar localmente, confira também `localhost`. Cada URL de prévia da Vercel com um host diferente exige autorização própria; prefira um domínio estável para os testes compartilhados.

Se a janela de login abrir e fechar com erro, consulte o código `Firebase Authentication: auth/...` no Console do navegador. `auth/unauthorized-domain` indica que o host da página não consta nos domínios autorizados. O código não inclui dados da conta.

## Limitações atuais do MVP

Nesta versão ainda não estão incluídos:

- upload de fotos e arquivos;
- notificações push;
- painel administrativo;
- recuperação avançada de dados;
- exclusão definitiva autônoma de conta (fluxo seguro em desenvolvimento);
- presença online dos responsáveis;
- resolução colaborativa de edições simultâneas do mesmo registro (última gravação válida prevalece);
- aplicação nativa para Android ou iOS.

O reconhecimento de voz também depende da disponibilidade e compatibilidade da API utilizada pelo navegador.

## Status do projeto

O Nascemos Pais está sendo desenvolvido como projeto final da trilha de Programação Front-End.

Apesar de ter sido concebido inicialmente para apresentação acadêmica, o projeto foi estruturado para permitir evolução após a entrega do MVP.

## Autor

Desenvolvido por **Marcelo Soares Teixeira Junior**.
