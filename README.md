# NEFESH Life

App de bem-estar da NEFESH: o ritual diário de Spirulina, com Índice NEFESH, dose personalizada e acompanhamento da evolução.
Construída a partir do protótipo NEFESH Life, como PWA instalável (React + TypeScript + Vite).

## Funcionalidades
- **Boas-vindas** com animação da marca e três ecrãs de apresentação.
- **Avaliação** com 17 perguntas, que dá o Índice NEFESH (energia, sono, nutrição, hidratação, movimento) em radar.
- **Plano**: dose em gramas e cápsulas, a justificação do cálculo, a semana de adaptação, a linha temporal até 90 dias e um aviso de segurança para as situações de risco.
- **Início**: tomas do dia, contador de água (35 ml/kg), atividade, hábitos, sugestão do dia, sequência, adesão, stock e reposição, e lembrete diário.
- **Check-in**: energia, sono, disposição e treino.
- **Evolução**: gráfico de 14 ou 30 dias, água, passos, histórico do índice e conquistas.
- **Profissionais**: rede de parceiros e relatório para partilhar.
- Funciona offline (service worker). Os dados ficam guardados no dispositivo (`localStorage`).
- Abre com dados de demonstração. "Começar" apaga-os e inicia a avaliação.

## Desenvolvimento
```bash
npm install
npm run dev       # servidor local
npm test          # testes da lógica (dose, índice, stock, sequências)
npm run build     # build de produção em dist/
```

## Estrutura
- `src/domain/`: lógica pura e testada (`plan.ts` dose e índice, `stats.ts` stock, sequências e relatório, `content.ts` textos e perguntas).
- `src/screens/`: ecrãs. `src/components/`: gráficos, ícones, intro e relatório.
- `src/domain/health.ts`: interface `HealthProvider`. Por agora é uma **simulação**; na app nativa liga-se ao Apple Saúde / Health Connect.
- `src/reminders.ts`: notificações do navegador (só enquanto a app está aberta).

## Próximos passos para a app nativa
1. Embrulhar com Capacitor (iOS/Android).
2. Substituir `healthProvider` por um plugin HealthKit / Health Connect.
3. Lembretes com Local Notifications.
4. Backend (contas, sincronização, painel dos profissionais, pedidos de contacto).
5. Validação científica das referências e da fórmula da dose.
