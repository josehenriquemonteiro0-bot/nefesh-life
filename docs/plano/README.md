# Plano mestre 2027–2028: modelo de simulação

- Documento do plano: https://claude.ai/artifact/3hM6ZimQdkapqRXhd2GMQx
- `simulacao.py`: o modelo usado (Monte Carlo mensal, dez/2026 → dez/2028, base de 350 clientes).
  - `python3 simulacao.py 1` corre a 1.ª etapa (34.560 estratégias × 60 futuros) e grava `s1.json`;
    `python3 simulacao.py 2` reavalia as melhores com 2.000 futuros e grava `s2.json`.
  - A função `run(estratégia, N, seed_rng, shock)` aceita choques para os testes de crise
    (`delay`, `ai`, `pros`, `b2b`, `churn`).
- `plano_combinado.py`: a versão anterior (Brasil enxuto + Europa) e os seus testes de crise.
- `refinado.py`: plano refinado com o utilizador comum (influenciadores pagos à frente `inf`, indicação `ref`) e a Europa;
  `python3 refinado.py 1` varre 540 combinações (1.000 futuros), `python3 refinado.py 2` reavalia as melhores com 5.000.
- `comparar_refinado.py` compara as variantes; `gate.py` aplica a regra de março (Europa só com 1.200 pagantes no Brasil)
  e corre as crises.
- Plano recomendado (IA a custo cheio): app R$ 39,90 / R$ 249,90, empresas R$ 29,90 por pessoa com anual adiantado,
  licença Pro R$ 249; empurrão de R$ 80 mil por mês durante 12 meses, reinvestir 50% da receita, 70% do esforço em
  empresas e 30% em profissionais, programa de indicação, influenciadores só por resultado; Europa em jun/2027 se março
  estiver verde. Resultado: 98% de probabilidade das duas metas, vale de R$ 163 mil (R$ 270 mil em 8 de 10 futuros),
  ~25 mil pagantes em dez/2027.
- Todos os trimestres: trocar os intervalos das premissas pelos números reais e correr de novo.
