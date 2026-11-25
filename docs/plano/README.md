# Plano mestre 2027–2028: modelo de simulação

- Documento do plano: https://claude.ai/artifact/3hM6ZimQdkapqRXhd2GMQx
- `simulacao.py`: o modelo usado (Monte Carlo mensal, dez/2026 → dez/2028, base de 350 clientes).
  - `python3 simulacao.py 1` corre a 1.ª etapa (34.560 estratégias × 60 futuros) e grava `s1.json`;
    `python3 simulacao.py 2` reavalia as melhores com 2.000 futuros e grava `s2.json`.
  - A função `run(estratégia, N, seed_rng, shock)` aceita choques para os testes de crise
    (`delay`, `ai`, `pros`, `b2b`, `churn`).
- `plano_combinado.py`: o plano recomendado (Brasil enxuto + Europa a partir de jun/2027) e os testes de crise.
  Uma região é uma estratégia com `reg` (câmbio, IVA, tamanho do mercado, custo de aquisição, mês de arranque).
- Plano recomendado: Brasil com app R$ 39,90 / R$ 249,90 (70% anual), empresas R$ 29,90 por pessoa com anual
  adiantado, licença do Pro R$ 249; equipa enxuta com automação por IA, custo de IA 25% mais baixo, empurrão de
  R$ 60 mil por mês durante 12 meses, reinvestir 40% da receita. Europa a partir de jun/2027: app 9,99 € / 69,99 €,
  empresas 9,99 € por pessoa, licença 79 €, empurrão de 12 mil € por mês durante 12 meses.
- Resultado (5.000 futuros): 93% de probabilidade das duas metas, vale de R$ 119 mil (R$ 234 mil em 8 de 10
  futuros), ~17 mil pagantes em dez/2027 e ~63 mil em dez/2028.
- Todos os trimestres: trocar os intervalos das premissas pelos números reais e correr de novo.
