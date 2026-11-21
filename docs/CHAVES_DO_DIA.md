# Chaves do Dia (seção Mente)

Conteúdo pronto neste ramo (`chaves-do-dia`):

- `src/domain/chavesDoDia.json` — 46 chaves (frase + referência bíblica + temas). Sem assinatura.
- `src/domain/chavesDoDia.ts` — `CHAVES`, `chaveDoDia(dia?)`, `temasDasChaves()`, `chavesPorTema(tema)`.
- `src/domain/chavesDoDia.test.ts` — testes (rotação sem repetir dentro de um ciclo, origem interna nunca exposta, filtro por tema).

## O que falta fazer na interface

1. No ecrã **Mente**, por cima da biblioteca de meditação, um cartão **"Chave do dia"** com:
   - o rótulo "🔑 Chave do dia";
   - `chaveDoDia().texto` em destaque;
   - `chaveDoDia().referencia` por baixo, mais discreto.
2. Uma chave diferente por dia, igual para todos, sem repetir até todas terem aparecido (já tratado por `chaveDoDia`).
3. Um link "Ver por tema" que abre a lista de `temasDasChaves()` e, ao tocar num tema, mostra `chavesPorTema(tema)`.
4. **Nunca** mostrar o campo `origem_interna` do JSON (o módulo já o remove).
5. Botão de partilhar a chave no WhatsApp com `whatsappShare(texto + ' — ' + referencia)` (opcional).

Para acrescentar mais chaves no futuro, basta juntar entradas ao JSON com o mesmo formato e `id` sequencial.
