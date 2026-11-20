import { Bar, Glass, Ring } from '../components/Charts';
import { Icon } from '../components/Icon';
import { GLASS_ML, HABITS, SHOP_URL, STEP_GOAL, TIPS } from '../domain/content';
import { daysSince, fmtNum, greeting, longToday, todayKey } from '../domain/dates';
import { planFor, inAdaptation, indexOf, slotsFor } from '../domain/plan';
import { adherence, habitOn, stock, streak, took } from '../domain/stats';
import { useStore } from '../state/store';
import { doseText, stockText } from '../domain/lots';
import { recipeOfDay } from '../domain/recipes';
import { RecipeArt } from '../components/RecipeArt';
import { DataCard } from '../components/DataCard';
import { mealForSlot, nextReassessment, spirulinaEntry, weeklySummary } from '../domain/progress';
import type { Nav } from '../App';

const litres = (glasses: number) => fmtNum(((glasses * GLASS_ML) / 1000).toFixed(2).replace(/0$/, ''));

export function SampleBanner({ onReset }: { onReset: () => void }) {
  const { S } = useStore();
  if (!S.sample) return null;
  return (
    <div className="banner">
      <span>Está a ver uma demonstração com dados de exemplo.</span>
      <button className="btn sm" onClick={onReset}>Começar</button>
    </div>
  );
}

function ActivityCard() {
  const { todayLog: l, updateToday } = useStore();
  const steps = l.steps ?? 0;
  const p = Math.min(1, steps / STEP_GOAL);
  const setSteps = (raw: string) => {
    const v = raw.trim() === '' ? undefined : Number(raw.replace(/\D/g, ''));
    updateToday((d) => {
      if (v === undefined || Number.isNaN(v)) delete d.steps;
      else d.steps = Math.max(0, Math.min(100000, Math.round(v)));
    });
  };
  return (
    <section className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Passos de hoje</h2>
        <span className="small mute">meta {STEP_GOAL.toLocaleString('pt-PT')}</span>
      </div>
      <div className="health">
        <Ring value={steps} goal={STEP_GOAL} label="passos" />
        <div className="hm">
          <label className="hin">
            <span>Passos</span>
            <input inputMode="numeric" placeholder="ex.: 7500" value={l.steps ?? ''} onChange={(e) => setSteps(e.target.value)} aria-label="Passos de hoje" />
          </label>
          <div><b>{Math.round(p * 100)}%</b><span>da meta</span></div>
          <div><b>{fmtNum(Math.round(steps * 0.0007 * 10) / 10)} km</b><span>aprox.</span></div>
        </div>
      </div>
      <p className="small mute" style={{ margin: '10px 0 0' }}>Veja o número no app Saúde e escreva-o aqui. As horas de sono registam-se no check-in.</p>
    </section>
  );
}

/** Resumo dos últimos 7 dias. */
function WeekCard({ go }: { go: Nav }) {
  const { S } = useStore();
  const w = weeklySummary(S);
  if (!w.hasData) return null;
  const items: [string, string][] = [
    ['Spirulina', `${w.spirulina}/7 dias`],
    ['Água na meta', `${w.water}/7 dias`],
    ['Check-ins', `${w.checkins}/7`],
    ['Atividade', `${w.minutes} min`],
  ];
  if (w.energy !== null) items.push(['Energia média', `${fmtNum(w.energy)}/5${w.energyDelta ? ` (${w.energyDelta > 0 ? '+' : ''}${fmtNum(w.energyDelta)})` : ''}`]);
  if (w.sleep !== null) items.push(['Sono médio', `${fmtNum(w.sleep)} h`]);
  if (w.plan !== null) items.push(['Plano alimentar', `${w.plan}%`]);
  if (w.train) items.push(['Treinos do personal', `${w.train.done}/${w.train.planned}`]);
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>A sua semana</h2>
        <button className="link small inline" onClick={() => go('evo')}>ver evolução →</button>
      </div>
      <div className="week-grid">
        {items.map(([k, v]) => (
          <div key={k}><span className="small mute">{k}</span><b>{v}</b></div>
        ))}
      </div>
    </section>
  );
}

export function Home({ go, startQuiz, onReset, openBottle, openLogin }: { go: Nav; startQuiz: () => void; onReset: () => void; openBottle: () => void; openLogin: () => void }) {
  const { S, updateToday, todayLog: l, toast } = useStore();

  if (!S.ans)
    return (
      <>
        <SampleBanner onReset={onReset} />
        <section className="card hero">
          <h1>Descubra o seu Índice NEFESH e a sua dose ideal</h1>
          <p>17 perguntas, cerca de 2 minutos. No fim recebe a sua pontuação de bem-estar e um plano de Spirulina feito para si.</p>
          <button className="btn" onClick={startQuiz}>Começar a avaliação</button>
        </section>
        <section className="card">
          <h2>Já usava a NEFESH Life?</h2>
          <p className="small mute">Entre na sua conta para trazer o seu plano. Se guardou uma cópia em ficheiro, recupere-a em "Os meus dados", aqui em baixo.</p>
          <button className="btn ghost sm" onClick={openLogin}>Entrar na minha conta</button>
        </section>
        <DataCard />
      </>
    );

  const c = planFor(S);
  const dt = (n: number) => doseText(n, c.format);
  const sl = slotsFor(S);
  const st = stock(S);
  const doses = l.doses || [];
  const done = doses.filter(Boolean).length;
  const ev = S.evals[S.evals.length - 1];
  const day = S.planStart ? daysSince(S.planStart) + 1 : 1;
  const goalW = c.water;
  const w = l.water || 0;
  const tip = TIPS[((daysSince('2026-01-01') % TIPS.length) + TIPS.length) % TIPS.length];
  const totalCaps = sl.reduce((t, s) => t + s.n, 0);
  const low = st.days <= 7;
  const re = nextReassessment(S);
  const rd = recipeOfDay(S.ans.goal, daysSince('2026-01-01'));

  const toggleDose = (i: number) => {
    const next = [...doses];
    next[i] = !next[i];
    const tag = `spirulina-${i}`;
    updateToday((t) => {
      t.doses = next;
      // a toma entra (ou sai) sozinha no diário de nutrição
      const meal = mealForSlot(sl[i].l);
      const meals = { ...(t.meals || {}) };
      for (const k of Object.keys(meals) as (keyof typeof meals)[]) meals[k] = (meals[k] || []).filter((e) => e.auto !== tag);
      if (next[i]) meals[meal] = [...(meals[meal] || []), spirulinaEntry(S, sl[i], i)];
      t.meals = meals;
    });
    const after = { ...S, logs: { ...S.logs, [todayKey()]: { ...l, doses: next } } };
    if (took(after, after.logs[todayKey()]) && !took(S, l)) {
      toast(`Ritual do dia cumprido. ${streak(after)} dias seguidos.`);
    }
  };

  const setWater = (n: number) => {
    updateToday((t) => { t.water = Math.max(0, n); });
    if (n === goalW && w < goalW) toast('Meta de água cumprida.');
  };

  return (
    <>
      <SampleBanner onReset={onReset} />
      <p className="mute small" style={{ margin: 0 }}>{longToday()} · dia {day} do ritual</p>
      <h1>{greeting()}{S.ans.name ? `, ${S.ans.name}` : ''}</h1>

      {re?.due && !S.sample && (
        <section className="card due">
          <div className="row">
            <div style={{ flex: '1 1 200px' }}>
              <h2 style={{ margin: 0 }}>Hora da reavaliação dos {re.target} dias</h2>
              <p className="small mute" style={{ margin: '4px 0 0' }}>2 minutos. Atualize o peso e as medidas e veja o antes e depois.</p>
            </div>
            <button className="btn sm" onClick={startQuiz}>Reavaliar</button>
          </div>
        </section>
      )}

      <section className="card hero">
        <div className="row">
          <div>
            <p className="small" style={{ margin: 0, opacity: 0.8 }}>Spirulina de hoje</p>
            <h2 style={{ margin: '2px 0 0' }}>{done}/{sl.length} {sl.length === 1 ? 'toma' : 'tomas'} · {dt(totalCaps)}</h2>
          </div>
          {ev && (
            <div style={{ textAlign: 'right' }}>
              <p className="small" style={{ margin: 0, opacity: 0.8 }}>Índice</p>
              <b className="idx-mini">{indexOf(ev.sc)}</b>
            </div>
          )}
        </div>
        <div className="slots">
          {sl.map((s, i) => (
            <div className="slot" key={s.l}>
              <div>
                <h3>{s.l}</h3>
                <p className="small mute" style={{ margin: 0 }}>{dt(s.n)}{i === 0 ? ` · lembrete às ${S.reminder}` : ''}</p>
              </div>
              <button className={`tick ${doses[i] ? 'on' : ''}`} onClick={() => toggleDose(i)} aria-pressed={!!doses[i]} aria-label={`Marcar toma: ${s.l}`}>
                <Icon name="ok" color="#00140d" width={3} />
              </button>
            </div>
          ))}
        </div>
        {inAdaptation(S) && <p className="small" style={{ margin: '12px 0 0', opacity: 0.85 }}>Semana de adaptação: está a tomar metade da dose.</p>}
      </section>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Hidratação</h2>
          <span className="small mute">{litres(w)} de {litres(goalW)} L</span>
        </div>
        <div className="glasses">
          {Array.from({ length: Math.max(goalW, w) }, (_, i) => (
            <button key={i} className="glass" onClick={() => setWater(w === i + 1 ? i : i + 1)} aria-label={`Copo ${i + 1}`}>
              <Glass on={i < w} />
            </button>
          ))}
        </div>
        <Bar pct={(w / goalW) * 100} variant="water" />
        <div className="row">
          <p className="small mute" style={{ margin: 0 }}>
            {w >= goalW ? 'Meta cumprida hoje.' : `Faltam ${goalW - w} copos de 250 ml.`} Meta: 35 ml por kg.
          </p>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => setWater(w - 1)} aria-label="Retirar um copo">−</button>
            <button className="btn sm" onClick={() => setWater(w + 1)}>+ 1 copo</button>
          </div>
        </div>
      </section>

      <ActivityCard />

      <section className="card">
        <h2>Hábitos de hoje</h2>
        <div className="habits">
          {HABITS.map(([k, t, icon]) => {
            const on = habitOn(S, l, k);
            return (
              <button
                key={k}
                className={`habit ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  if ((k === 'passos' && l.steps !== undefined) || (k === 'sono' && l.sleepH !== undefined)) return toast(k === 'sono' ? 'Este hábito marca-se pelas horas de sono do check-in.' : 'Este hábito marca-se pelos passos que registou.');
                  updateToday((d) => { d.hab = { ...d.hab, [k]: !d.hab?.[k] }; });
                }}
              >
                <Icon name={icon} />
                {t}
              </button>
            );
          })}
        </div>
      </section>

      {!l.e && (
        <section className="card">
          <div className="row">
            <div>
              <h2 style={{ margin: 0 }}>Como se sente hoje?</h2>
              <p className="mute small" style={{ margin: '4px 0 0' }}>30 segundos: energia, sono, disposição e treino.</p>
            </div>
            <button className="btn ghost sm" onClick={() => go('check')}>Check-in</button>
          </div>
        </section>
      )}

      <button className="card recipe-day" onClick={() => go('recipes')}>
        <RecipeArt r={rd} height={120} />
        <div style={{ padding: '12px 16px 14px' }}>
          <span className="rtag solid">Receita do dia · Spirulina {rd.form}</span>
          <h2 style={{ margin: '8px 0 4px' }}>{rd.title}</h2>
          <span className="small mute">{fmtNum(rd.grams)} g por porção · {rd.minutes} min · ver receitas →</span>
        </div>
      </button>

      <section className="card tip">
        <p className="small gold" style={{ margin: '0 0 4px', fontWeight: 700 }}>Sabia que…</p>
        <p style={{ margin: 0 }}>{tip}</p>
      </section>

      <WeekCard go={go} />

      <div className="stats">
        <div className="stat"><b>{streak(S)}</b><span>dias seguidos</span></div>
        <div className="stat"><b>{adherence(S)}%</b><span>adesão 14 dias</span></div>
        <div className="stat"><b>{st.days}</b><span>dias de stock</span></div>
      </div>

      {low && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>Reposição</h2>
            <span className="mute small">{c.format === 'caps' ? st.left : fmtNum(st.left / 2)} de {stockText(S.stockCaps, c.format)}</span>
          </div>
          <Bar pct={st.pct} variant="low" />
          <p className="small">O seu stock acaba em {st.days} dias. Encomende já para não interromper o ritual.</p>
          <div className="row" style={{ justifyContent: 'flex-start' }}>
            <a className="btn sm" href={SHOP_URL} target="_blank" rel="noopener">Encomendar</a>
            <button className="btn ghost sm" onClick={openBottle}><Icon name="qr" /> Ler QR do frasco</button>
          </div>
        </section>
      )}
    </>
  );
}

