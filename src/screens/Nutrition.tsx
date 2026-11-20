import { useEffect, useState } from 'react';
import { Bar, Ring } from '../components/Charts';
import { DecimalInput } from '../components/DecimalInput';
import { PhotoMealCard } from '../components/PhotoMeal';
import { targetsFor } from '../domain/body';
import { workoutKcal } from '../domain/progress';
import { PlanUpload } from '../components/PlanUpload';
import { NutriPlanCard } from '../components/NutriPlan';
import { fmtNum, keyDaysAgo, longToday, todayKey } from '../domain/dates';
import { FOODS, MEALS, entryOf, searchFoods, totals, type Food, type FoodEntry, type MealKey } from '../domain/foods';
import { useStore } from '../state/store';
import { Recipes } from './Recipes';

/** Alimentos usados nos últimos 14 dias, do mais frequente para o menos. */
function useRecent(): Food[] {
  const { S } = useStore();
  const count: Record<string, number> = {};
  for (let i = 0; i < 14; i++) {
    const m = S.logs[keyDaysAgo(i)]?.meals || {};
    Object.values(m).flat().forEach((e) => e?.foodId && (count[e.foodId] = (count[e.foodId] || 0) + 1));
  }
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => FOODS.find((f) => f.id === id))
    .filter((f): f is Food => !!f)
    .slice(0, 8);
}

function AddFood({ meal, onClose }: { meal: MealKey; onClose: () => void }) {
  const { S, updateToday, toast } = useStore();
  const hide = !!S.hideCalories;
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Food | null>(null);
  const [portions, setPortions] = useState(1);
  const [grams, setGrams] = useState<number | undefined>(undefined);
  const [custom, setCustom] = useState(false);
  const [cName, setCName] = useState('');
  const [cKcal, setCKcal] = useState<number | undefined>();
  const recent = useRecent();
  const label = MEALS.find((m) => m[0] === meal)![1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = (e: FoodEntry) => {
    updateToday((d) => {
      d.meals = { ...(d.meals || {}) };
      d.meals[meal] = [...(d.meals[meal] || []), e];
    });
    toast(`${e.name} adicionado ao ${label.toLowerCase()}${hide ? '' : ` (${e.kcal} kcal)`}.`);
    onClose();
  };

  const g = grams ?? (pick ? Math.round(pick.grams * portions * 10) / 10 : 0);
  const preview = pick ? entryOf(pick, g) : null;
  const list = q.trim() ? searchFoods(q) : recent.length ? recent : searchFoods('', 12);

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Adicionar ao ${label}`}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{label}</h2>
          <button className="btn ghost sm" onClick={onClose}>Fechar</button>
        </div>

        {custom ? (
          <>
            <p className="small mute">Não encontrou o alimento? Escreva o nome e as calorias (estão no rótulo).</p>
            <input className="field sm" style={{ width: '100%', marginBottom: 10 }} placeholder="Nome (ex.: Bolo da avó)" value={cName} onChange={(e) => setCName(e.target.value)} aria-label="Nome do alimento" />
            <label className="measure" style={{ marginBottom: 14 }}>
              <span><b>Calorias</b><span className="small mute">da porção que comeu</span></span>
              <span className="measure-in"><DecimalInput decimals={false} value={cKcal} onValue={setCKcal} aria-label="Calorias" placeholder="—" />kcal</span>
            </label>
            <button
              className="btn full"
              disabled={!cName.trim() || !cKcal}
              onClick={() => add({ id: `custom-${Date.now().toString(36)}`, name: cName.trim(), grams: 0, kcal: Math.round(cKcal!), p: 0, c: 0, f: 0 })}
            >
              Adicionar
            </button>
            <p />
            <button className="btn ghost full" onClick={() => setCustom(false)}>Voltar à pesquisa</button>
          </>
        ) : pick ? (
          <>
            <h3 style={{ marginTop: 14 }}>{pick.name}</h3>
            <p className="small mute" style={{ marginTop: 0 }}>{hide ? '' : `${pick.kcal} kcal por 100 g · `}porção: {pick.portion}</p>
            <div className="num-exact" style={{ marginBottom: 8 }}>
              <button className="btn ghost" aria-label="Menos meia porção" onClick={() => { setGrams(undefined); setPortions(Math.max(0.5, portions - 0.5)); }}>−</button>
              <div className="num-box" style={{ flexDirection: 'column', alignItems: 'center' }}>
                <b style={{ font: '700 30px Sora' }}>{fmtNum(portions)}</b>
                <span className="small mute">{portions === 1 ? 'porção' : 'porções'}</span>
              </div>
              <button className="btn ghost" aria-label="Mais meia porção" onClick={() => { setGrams(undefined); setPortions(portions + 0.5); }}>+</button>
            </div>
            <label className="measure" style={{ marginBottom: 14 }}>
              <span><b>Ou em gramas</b><span className="small mute">se pesou</span></span>
              <span className="measure-in"><DecimalInput value={g} onValue={(v) => setGrams(v)} aria-label="Gramas" />g</span>
            </label>
            {preview && (
              <div className="macros" style={{ marginBottom: 14 }}>
                {!hide && <span><b>{preview.kcal}</b> kcal</span>}
                <span><b>{fmtNum(preview.p)} g</b> proteína</span>
                <span><b>{fmtNum(preview.c)} g</b> hidratos</span>
                <span><b>{fmtNum(preview.f)} g</b> gordura</span>
              </div>
            )}
            <button className="btn full" disabled={!g} onClick={() => preview && add(preview)}>Adicionar ao {label.toLowerCase()}</button>
            <p />
            <button className="btn ghost full" onClick={() => { setPick(null); setGrams(undefined); setPortions(1); }}>Escolher outro</button>
          </>
        ) : (
          <>
            <input className="field sm" style={{ width: '100%', margin: '12px 0' }} placeholder="Pesquisar (ex.: arroz, frango, banana)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar alimento" autoFocus />
            {!q.trim() && <p className="small mute" style={{ margin: '0 0 6px' }}>{recent.length ? 'Usados recentemente' : 'Sugestões'}</p>}
            <div className="foodlist">
              {list.map((f) => (
                <button key={f.id} className="food" onClick={() => setPick(f)}>
                  <span>
                    <b>{f.name}</b>
                    <span className="small mute">{f.portion}</span>
                  </span>
                  {!hide && <span className="small mute">{Math.round((f.kcal * f.grams) / 100)} kcal</span>}
                </button>
              ))}
              {!list.length && <p className="small mute">Nada encontrado para "{q}".</p>}
            </div>
            <button className="btn ghost full" style={{ marginTop: 12 }} onClick={() => setCustom(true)}>Adicionar outro alimento à mão</button>
            <p className="small mute" style={{ marginTop: 10 }}>Valores médios aproximados por porção habitual.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Diary() {
  const { S, todayLog: l, updateToday, update } = useStore();
  const [adding, setAdding] = useState<MealKey | null>(null);
  const meals = l.meals || {};
  const all = MEALS.flatMap(([k]) => meals[k] || []);
  const t = totals(all);
  const tg = targetsFor(S, workoutKcal(S, todayKey()));
  const hide = !!S.hideCalories;
  const left = tg.kcal - t.kcal;
  const count = all.length;

  return (
    <>
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>{longToday()}</p>
        {hide ? (
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: 0, font: '600 22px Sora' }}>{count ? `${count} ${count === 1 ? 'alimento registado' : 'alimentos registados'}` : 'Ainda sem registos hoje'}</p>
            <p className="small" style={{ margin: '2px 0 10px', opacity: 0.8 }}>Modo sem calorias: o foco está nas refeições e na proteína.</p>
            <div className="row small"><span>Proteína</span><span className="mute">{Math.round(t.p)} / {tg.protein} g</span></div>
            <Bar pct={(t.p / tg.protein) * 100} />
          </div>
        ) : (
          <>
            <div className="health" style={{ marginTop: 10 }}>
              <Ring value={t.kcal} goal={tg.kcal} label="kcal" />
              <div>
                <p style={{ margin: 0, font: '600 22px Sora' }}>{left >= 0 ? `Faltam ${left.toLocaleString('pt-PT')}` : `+${(-left).toLocaleString('pt-PT')} acima`}</p>
                <p className="small" style={{ margin: '2px 0 0', opacity: 0.8 }}>
                  {tg.source === 'pro' ? `meta do nutricionista (${tg.by})` : tg.source === 'app' ? 'referência geral' : 'referência indicativa'}: {tg.kcal.toLocaleString('pt-PT')} kcal
                </p>
                {tg.exercise ? <p className="small" style={{ margin: '2px 0 0' }}><span className="neon">+{tg.exercise} kcal</span> pelo treino de hoje</p> : null}
              </div>
            </div>
            <div className="macrobars">
              {([['Proteína', t.p, tg.protein], ['Hidratos', t.c, tg.carbs], ['Gordura', t.f, tg.fat]] as const).map(([n, v, goal]) => (
                <div key={n}>
                  <div className="row small"><span>{n}</span><span className="mute">{Math.round(v)} / {goal} g</span></div>
                  <Bar pct={(v / goal) * 100} />
                </div>
              ))}
            </div>
          </>
        )}
        {tg.source === 'padrao' && <p className="small" style={{ margin: '8px 0 0', opacity: 0.85 }}>Complete a avaliação com altura e peso para ter a sua referência personalizada.</p>}
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={hide} onChange={(e) => update((d) => { d.hideCalories = e.target.checked; })} />
          <span className="small">Não quero ver calorias</span>
        </label>
      </section>

      <PlanUpload kind="nutri" />
      <NutriPlanCard />

      <PhotoMealCard />

      {MEALS.map(([k, name]) => {
        const items = meals[k] || [];
        const mt = totals(items);
        return (
          <section className="card" key={k}>
            <div className="row">
              <h2 style={{ margin: 0 }}>{name}</h2>
              {!hide && <span className="small mute">{mt.kcal} kcal</span>}
            </div>
            {items.length > 0 && (
              <ul className="meal">
                {items.map((e) => (
                  <li key={e.id}>
                    <span>
                      <span>{e.name}{e.planRef !== undefined && <span className="plan-chip">plano</span>}</span>
                      <span className="small mute">{e.grams ? `${fmtNum(e.grams)} g` : ''}{hide ? '' : `${e.grams ? ' · ' : ''}${e.kcal} kcal`}</span>
                    </span>
                    <button
                      className="x"
                      aria-label={`Remover ${e.name}`}
                      onClick={() => updateToday((d) => {
                        d.meals = { ...(d.meals || {}) };
                        d.meals[k] = (d.meals[k] || []).filter((x) => x.id !== e.id);
                      })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setAdding(k)}>+ Adicionar</button>
          </section>
        );
      })}
      {adding && <AddFood meal={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

export function Nutrition({ initial = 'diario' }: { initial?: 'diario' | 'receitas' }) {
  const [sub, setSub] = useState(initial);
  return (
    <>
      <h1>Nutrição</h1>
      <div className="seg seg-wide" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginBottom: 14 }} role="group" aria-label="Secção">
        <button className={sub === 'diario' ? 'on' : ''} aria-pressed={sub === 'diario'} onClick={() => setSub('diario')}>Diário</button>
        <button className={sub === 'receitas' ? 'on' : ''} aria-pressed={sub === 'receitas'} onClick={() => setSub('receitas')}>Receitas</button>
      </div>
      {sub === 'diario' ? <Diary /> : <Recipes />}
    </>
  );
}
