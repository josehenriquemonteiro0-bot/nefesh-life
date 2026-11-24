# Chaves do Dia (secção Mente)

- `src/domain/chavesDoDia.json` — **100 chaves** (frase + referência bíblica + temas):
  - 1 a 46: das notas do José Henrique (`referencia_origem: "nota"` quando o versículo já vinha na nota);
  - 47 a 100: escritas pela NEFESH no mesmo estilo, com versículos que sustentam a frase (`"sugerida"`).
- `src/domain/chavesDoDia.ts` — `chaveDoDia(dia, lista, semente)`, `temasDasChaves()`, `chavesPorTema(tema)`.
- O campo `origem_interna` é só de controlo e **nunca** aparece na app.

## Como funciona

- **Cada pessoa tem a sua chave**: uma semente pessoal (criada na primeira vez e guardada com os dados, por isso
  igual no iPhone e na web) define a ordem das chaves. No mesmo dia, amigos recebem quase sempre chaves
  diferentes, o que dá mais variedade às partilhas.
- A chave não muda ao longo do dia e não se repete até a pessoa ter visto todas; depois recomeça noutra ordem.
- Tocar na referência abre o versículo na Bíblia online (NVI). Partilha no WhatsApp e imagem para o Instagram.

## Acrescentar chaves

Basta enviar as novas frases (copiadas das Notas do iPhone, com ou sem a referência) na conversa com o Claude.
Cada uma entra no JSON com `id` sequencial, temas e referência; se faltar a referência, é sugerida e marcada
como `"sugerida"`. Os testes confirmam que não há textos repetidos e que todas as referências abrem na Bíblia.
