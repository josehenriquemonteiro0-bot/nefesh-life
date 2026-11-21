# NEFESH Life — plano para a app nativa (App Store e Play Store)

Base para quando avançarmos para a app nativa. Objetivo: passar a recolher dados
**automaticamente** (sensores), mantendo o que já nos distingue: o **contexto** (voz,
relatos, humor, ciclo), o **produto** (Spirulina verificada) e os **profissionais**.

## Princípio

Não substituir a app atual: empacotá-la com o **Capacitor** (o mesmo código React),
acrescentando só o que precisa de acesso nativo. A versão web continua a funcionar.

## 1. Apple Health (iPhone) e Health Connect (Android) — o maior salto

Leitura em segundo plano, com permissão por tipo de dado (a pessoa escolhe o que liga):

| Dado | Para quê na NEFESH |
| --- | --- |
| Passos, distância, minutos de exercício, treinos | Movimento e relatório semanal sem escrever |
| Sono com fases (profundo, REM) e horários | Sono e regularidade medidos, não declarados |
| Frequência cardíaca em repouso e VFC (variabilidade) | Recuperação e stress: o melhor indicador diário |
| Peso, % de gordura (balanças ligadas) | Corpo ao longo do tempo sem escrever |
| Tensão arterial | Cuidados/prevenção e relatório para o médico |
| Ciclo menstrual | Ciclo sem marcar à mão (com consentimento próprio) |
| Glicemia (quem tem sensor) | Ligação refeições ↔ energia; só com consentimento |

- Escrita de volta (opcional): treinos e água registados na NEFESH aparecem no Apple Health.
- Já preparado: `DayLog.src` (origem `integration`/`device`/`declared`) e `applyHealthDays`.
- Substitui o atalho do iPhone e a captura do app Saúde (que ficam para quem usar a versão web).

## 2. Relógios e anéis (Garmin, Oura, Whoop, Fitbit, Polar, Withings)

- Um agregador (ex.: Terra, Rook, Junction) dá uma só ligação a todos.
- Custo mensal por utilizador → faz sentido no **Premium**.
- Os dados entram pelo mesmo caminho do ponto 1 (origem `integration`).

## 3. Notificações e voz nativas

- Notificações fiáveis no iPhone (sem depender da app web instalada no ecrã principal).
- Voz com o ecrã bloqueado: conversa por voz a caminhar (mãos-livres real).
- Reconhecimento de voz nativo do iOS (hoje: gravação + Whisper no servidor).
- Lembretes locais (medicação, lembretes do assistente) sem depender do servidor.

## 4. Outros ganhos nativos

- Câmara nativa para o código de barras, fotos do prato e análises (mais rápida).
- Widgets no ecrã principal: toma da Spirulina e água com um toque.
- Atalhos da Siri / Google Assistant: "Ei Siri, diz à NEFESH que tomei a Spirulina".

## 4.1 GPS e treinos (já preparado no código)

Na versão web o GPS só regista com o ecrã ligado. Na app nativa:

- **GPS em segundo plano** (corrida com o telemóvel no bolso e o ecrã bloqueado). O código já
  tem o ponto de ligação: `src/domain/geo.ts`. A app nativa define, antes de arrancar,
  `window.NefeshNative = { geo: { background: true, start(onPoint, onError) { … } } }` e envia
  pontos `{ lat, lon, t, acc, alt }`. O registo (`RunTrack` em `src/domain/gps.ts`), os planos e
  o ecrã continuam iguais, e o aviso "mantenha o ecrã ligado" desaparece sozinho.
  - Plugin: `@capacitor-community/background-geolocation` (gratuito) ou o da Transistorsoft
    (pago, mais poupado na bateria).
  - iOS: modo de fundo "Location updates", `NSLocationWhenInUseUsageDescription` e
    `NSLocationAlwaysAndWhenInUseUsageDescription` com uma explicação clara; `allowsBackgroundLocationUpdates` só durante o treino.
  - Android: serviço em primeiro plano com notificação fixa "A registar o treino",
    permissões `ACCESS_FINE_LOCATION` e `FOREGROUND_SERVICE_LOCATION`.
- **Voz durante o treino com o ecrã bloqueado** (avisos por km e blocos do plano): TTS nativo
  com "audio ducking" (baixa a música e volta a subir), sessão de áudio `playback` no iOS.
- **Gravar o treino no Apple Health / Health Connect** com o percurso
  (`HKWorkoutRouteBuilder`; `ExerciseSessionRecord` com `ExerciseRoute`). O GPX já existe
  (`toGpx` em `gps.ts`) e pode servir de base.
- **Frequência cardíaca do relógio** durante a corrida (zonas, esforço real) e cadência.
- **Mapa por baixo do percurso**: fornecedor de mapas (MapLibre com mosaicos MapTiler ou
  Stadia; pago acima do plano gratuito). Esconder por defeito o início e o fim (zona de casa).
- **Widget / ecrã bloqueado** com o tempo e a distância (Live Activity no iPhone).
- Progressão automática (`src/domain/progression.ts`) e planos de corrida
  (`src/domain/runPlans.ts`) não mudam: só passam a receber também dados do relógio
  (frequência cardíaca, recuperação) para ajustar as cargas e as semanas.

## 5. Dados que só a NEFESH terá (independentes da app nativa)

- **Compras na loja online ligadas à app** (cada compra = frasco registado): aderência à
  Spirulina verificada pela compra e pelo ritmo de reposição.
- **Profissionais dentro da app**: medições da consulta, prescrições e metas (dados clínicos).

## Cuidados

- Dados de saúde = categoria especial (RGPD/LGPD): consentimento por tipo de dado,
  guardar com mais segurança, revisão jurídica própria para batimento, glicemia e análises.
- Bateria: leituras em segundo plano leves e agrupadas.
- Contas de programador: Apple (cerca de 99 USD/ano) e Google Play (taxa única).
- Revisão da Apple: apps de saúde precisam de política de privacidade clara e de explicar
  cada permissão pedida.

## Já feito na versão web (para aproveitar)

- Origem dos dados (medido vs. declarado) em todo o lado.
- Leitura de documentos por IA (planos, análises), código de barras + Open Food Facts.
- Assistente de voz que regista e age, com memória da pessoa.
- Treinos com GPS (distância, ritmo, parciais, recordes, GPX), progressão automática no ginásio e em casa, planos de corrida que se ajustam e semana leve.
