import { useState } from 'react';
import { daysSince, fmtNum } from '../domain/dates';
import { slotsFor } from '../domain/plan';
import { GOLDEN_RULES, RECIPES, recipeOfDay, type Recipe } from '../domain/recipes';
import { useStore } from '../state/store';
import { shareMoment } from '../domain/social';
import { RecipeArt } from '../components/RecipeArt';

const FILTERS = ['Todas', 'Smoothie', 'Pequeno-almoço', 'Refeição', 'Snack', 'Bebida'] as const;

function RecipeDetail({ r, onBack }: { r: Recipe; onBack: () => void }) {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const sl = slotsFor(S);
  const doses = l.doses || [];
  const next = sl.findIndex((_, i) => !doses[i]);
  const caps = r.grams * 2;

  return (
    <>
      <button className="btn ghost sm" onClick={onBack}>← Receitas</button>
      <div className="rhero" style={{ marginTop: 14 }}>
        <RecipeArt r={r} height={210} />
        <div style={{ padding: '14px 4px 0' }}>
          <span className="rtag solid">{r.kind} · Spirulina {r.form}</span>
          <h1 style={{ margin: '8px 0 6px' }}>{r.title}</h1>
          <p className="small mute" style={{ margin: 0 }}>{r.minutes} min · {r.serves}</p>
        </div>
      </div>
      {S.community && (
        <button
          className="btn ghost sm"
          style={{ marginTop: 10 }}
          onClick={() => {
            shareMoment('receita', RECIPES.indexOf(r));
            toast('Partilhado no mural da comunidade 🥤');
          }}
        >
          🥤 Fiz esta receita
        </button>
      )}

      <section className="card">
        <div className="row">
          <div>
            <p className="small mute" style={{ margin: 0 }}>Spirulina por porção</p>
            <b className="idx-mini">{fmtNum(r.grams)} g</b>
          </div>
          <p className="small mute" style={{ margin: 0, textAlign: 'right' }}>≈ {caps} {caps === 1 ? 'cápsula' : 'cápsulas'}<br />de 500 mg</p>
        </div>
        {S.ans && next >= 0 && (
          <>
            <p className="small" style={{ margin: '10px 0' }}>
              A sua próxima toma ({sl[next].l}) é de {fmtNum(sl[next].n / 2)} g.
              {caps < sl[next].n ? ` Esta porção cobre ${Math.round((caps / sl[next].n) * 100)}% dessa toma.` : ' Esta porção cobre a toma inteira.'}
            </p>
            <button
              className="btn full"
              onClick={() => {
                updateToday((d) => {
                  const ds = [...(d.doses || [])];
                  ds[next] = true;
                  d.doses = ds;
                  d.slots = sl.length;
                  d.viaRecipe = { ...(d.viaRecipe || {}), [next]: r.id };
                });
                toast(`Toma registada: ${sl[next].l}, com a receita. Não conta para o stock.`);
              }}
            >
              Contar como a toma: {sl[next].l}
            </button>
          </>
        )}
        {S.ans && next < 0 && <p className="small neon" style={{ margin: '10px 0 0' }}>As tomas de hoje já estão feitas.</p>}
      </section>

      <section className="card">
        <h2>Ingredientes</h2>
        <ul className="list">
          {r.ingredients.map((i) => (
            <li key={i}><span className="neon">•</span><span>{i}</span></li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Preparação</h2>
        <ol className="steps">
          {r.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </section>

      {r.tip && (
        <section className="card tip">
          <p className="small gold" style={{ margin: '0 0 4px', fontWeight: 700 }}>Dica</p>
          <p style={{ margin: 0 }}>{r.tip}</p>
        </section>
      )}
      <p className="small mute">As quantidades de Spirulina indicadas são por porção. Ajuste-as à dose do seu plano.</p>
    </>
  );
}

export function Recipes() {
  const { S } = useStore();
  const [open, setOpen] = useState<Recipe | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todas');

  if (open) return <RecipeDetail r={open} onBack={() => { setOpen(null); window.scrollTo(0, 0); }} />;

  const goal = S.ans?.goal;
  const list = RECIPES.filter((r) => filter === 'Todas' || r.kind === filter).sort(
    (a, b) => Number(!!goal && b.goals.includes(goal)) - Number(!!goal && a.goals.includes(goal)),
  );

  return (
    <>
      <h1>Receitas com Spirulina</h1>
      <p className="mute">Smoothies com Spirulina em pó e pratos com Nibs, sempre frios para preservar os nutrientes.</p>
      {(() => {
        const rd = recipeOfDay(goal, daysSince('2026-01-01'));
        return (
          <button className="card recipe-day" onClick={() => { setOpen(rd); window.scrollTo(0, 0); }}>
            <RecipeArt r={rd} height={120} />
            <div style={{ padding: '12px 16px 14px' }}>
              <span className="rtag solid">Receita do dia · Spirulina {rd.form}</span>
              <h2 style={{ margin: '8px 0 4px' }}>{rd.title}</h2>
              <span className="small mute">{fmtNum(rd.grams)} g por porção · {rd.minutes} min</span>
            </div>
          </button>
        );
      })()}
      <div className="chips" style={{ margin: '4px 0 16px' }}>
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="rgrid">
        {list.map((r) => (
          <button key={r.id} className="rcard" onClick={() => { setOpen(r); window.scrollTo(0, 0); }}>
            <div className="rimg">
              <RecipeArt r={r} height={104} />
              <div className="rtags">
                <span className="rtag">{r.form}</span>
                {goal && r.goals.includes(goal) && <span className="rtag gold-t">Para si</span>}
              </div>
            </div>
            <div style={{ padding: '10px 12px 12px' }}>
              <h3 style={{ margin: '0 0 4px' }}>{r.title}</h3>
              <p className="small mute" style={{ margin: 0 }}>{fmtNum(r.grams)} g por porção · {r.minutes} min</p>
            </div>
          </button>
        ))}
      </div>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Regras de ouro na cozinha</h2>
        <ul className="list">
          {GOLDEN_RULES.map((g) => (
            <li key={g.t}><span className="neon">•</span><span><b>{g.t}.</b> <span className="mute">{g.d}</span></span></li>
          ))}
        </ul>
      </section>
    </>
  );
}
