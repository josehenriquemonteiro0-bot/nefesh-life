# Plano mestre 2027–2028: modelo de simulação

- Documento do plano: https://claude.ai/artifact/3hM6ZimQdkapqRXhd2GMQx
- `simulacao.py`: o modelo usado (Monte Carlo mensal, dez/2026 → dez/2028, base de 350 clientes).
  - `python3 simulacao.py 1` corre a 1.ª etapa (34.560 estratégias × 60 futuros) e grava `s1.json`;
    `python3 simulacao.py 2` reavalia as melhores com 2.000 futuros e grava `s2.json`.
  - A função `run(estratégia, N, seed_rng, shock)` aceita choques para os testes de crise
    (`delay`, `ai`, `pros`, `b2b`, `churn`).
- Plano recomendado: app R$ 39,90 / R$ 249,90 (70% anual), empresas R$ 29,90 por pessoa com anual adiantado,
  licença do Pro R$ 249 (mensal ou anual), empurrão de R$ 80 mil por mês durante 12 meses, reinvestir 50% da
  receita, 60% do esforço em empresas e 40% em profissionais.
- Todos os trimestres: trocar os intervalos das premissas pelos números reais e correr de novo.
