import { Bar, Glass, Ring } from '../components/Charts';
import { Icon } from '../components/Icon';
import { GLASS_ML, HABITS, SHOP_URL, STEP_GOAL, TIPS } from '../domain/content';
import { daysSince, fmtNum, greeting, longToday, todayKey } from '../domain/dates';
import { healthProvider } from '../domain/health';
import { calcPlan, inAdaptation, indexOf, slotsFor } from '../domain/plan';
import { adherence, habitOn, stock, streak, took } from '../domain/stats';
import { useStore } from '../state/store';
import { lotFor } from '../domain/lots';
import { recipeOfDay } from '../domain/recipes';
import { enableNotifications, notificationsSupported } from '../reminders';
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

function HealthCard() {
  const { S, update, toast } = useStore();
  if (!S.health)
    return (
      <section className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 220px' }}>
            <h2 style={{ margin: '0 0 6px' }}>Ligar os dados de saúde</h2>
            <p className="small mute" style={{ margin: 0 }}>
              Passos, sono e minutos ativos lidos automaticamente do Apple Saúde ou do Google Health Connect, com a sua autorização.
            </p>
          </div>
          <button
            className="btn sm"
            onClick={() => {
              update((d) => { d.health = true; });
              toast('Dados de saúde ligados (simulação).');
            }}
          >
            Ligar
          </button>
        </div>
      </section>
    );
  const s = healthProvider.steps(0);
  const p = Math.min(1, s / STEP_GOAL);
  return (
    <section className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Atividade</h2>
        <span className="src"><Icon name="pros" />{healthProvider.source}</span>
      </div>
      <div className="health">
        <Ring value={s} goal={STEP_GOAL} label="passos" />
        <div className="hm">
          <div><b>{fmtNum(healthProvider.sleep(0))} h</b><span>sono esta noite</span></div>
          <div><b>{Math.round(s / 110)} min</b><span>ativos hoje</span></div>
          <div><b>{Math.round(p * 100)}%</b><span>meta {STEP_GOAL.toLocaleString('pt-PT')}</span></div>
          <div><b>{fmtNum(Math.round(s * 0.0007 * 10) / 10)} km</b><span>percorridos</span></div>
        </div>
      </div>
      {healthProvider.simulated && (
        <p className="small mute" style={{ margin: '12px 0 0' }}>
          Na app instalada, estes dados chegam do telemóvel e marcam sozinhos os hábitos de passos e sono.
        </p>
      )}
    </section>
  );
}

export function Home({ go, startQuiz, onReset, replayIntro, openBottle }: { go: Nav; startQuiz: () => void; onReset: () => void; replayIntro: () => void; openBottle: () => void }) {
  const { S, update, updateToday, todayLog: l, toast } = useStore();

  if (!S.ans)
    return (
      <>
        <SampleBanner onReset={onReset} />
        <section className="card hero">
          <h1>Descubra o seu Índice NEFESH e a sua dose ideal</h1>
          <p>17 perguntas, cerca de 2 minutos. No fim recebe a sua pontuação de bem-estar e um plano de Spirulina feito para si.</p>
          <button className="btn" onClick={startQuiz}>Começar a avaliação</button>
        </section>
      </>
    );

  const c = calcPlan(S.ans);
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
  const bottles = S.bottles || [];
  const lastLot = lotFor([...bottles].reverse().find((b) => b.code)?.code);
  const rd = recipeOfDay(S.ans.goal, daysSince('2026-01-01'));

  const toggleDose = (i: number) => {
    const next = [...doses];
    next[i] = !next[i];
    updateToday((t) => { t.doses = next; });
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

      <section className="card hero">
        <div className="row">
          <div>
            <p className="small" style={{ margin: 0, opacity: 0.8 }}>Spirulina de hoje</p>
            <h2 style={{ margin: '2px 0 0' }}>{done}/{sl.length} tomas · {totalCaps} cápsulas</h2>
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
                <p className="small mute" style={{ margin: 0 }}>{s.n} cápsulas{i === 0 ? ` · lembrete às ${S.reminder}` : ''}</p>
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

      <HealthCard />

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
                  if (S.health && (k === 'passos' || k === 'sono')) return toast('Este hábito é marcado pelos dados de saúde.');
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

      {lastLot && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>O seu lote</h2>
            <span className="src">Laudo {lastLot.code}</span>
          </div>
          <p className="small mute" style={{ margin: '8px 0 10px' }}>
            {lastLot.values.filter((v) => v.pos === 'acima').map((v) => v.label).join(', ')} acima da referência da literatura.
          </p>
          <button className="btn ghost sm" onClick={openBottle}>Ver análises</button>
        </section>
      )}

      <button className="card recipe-day" style={{ background: `linear-gradient(135deg, ${rd.hue[0]}, ${rd.hue[1]})` }} onClick={() => go('recipes')}>
        <span className="rtag">Receita do dia · Spirulina {rd.form}</span>
        <h2 style={{ margin: '8px 0 4px' }}>{rd.title}</h2>
        <span className="small">{fmtNum(rd.grams)} g por porção · {rd.minutes} min · ver receitas →</span>
      </button>

      <section className="card tip">
        <p className="small gold" style={{ margin: '0 0 4px', fontWeight: 700 }}>Sabia que…</p>
        <p style={{ margin: 0 }}>{tip}</p>
      </section>

      <div className="stats">
        <div className="stat"><b>{streak(S)}</b><span>dias seguidos</span></div>
        <div className="stat"><b>{adherence(S)}%</b><span>adesão 14 dias</span></div>
        <div className="stat"><b>{st.days}</b><span>dias de stock</span></div>
      </div>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Reposição</h2>
          <span className="mute small">{st.left} de {S.stockCaps} cápsulas</span>
        </div>
        <Bar pct={st.pct} variant={low ? 'low' : undefined} />
        <p className={`small ${low ? '' : 'mute'}`}>
          {low
            ? `O seu stock acaba em ${st.days} dias. Encomende já para não interromper o ritual.`
            : `Ao ritmo atual, o seu stock dura mais ${st.days} dias.`}
        </p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <a className="btn sm" href={SHOP_URL} target="_blank" rel="noopener">Encomendar</a>
<button className="btn ghost sm" onClick={openBottle}>
            <Icon name="qr" /> Ler QR do frasco
          </button>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ margin: 0 }}>Lembrete diário</h2>
            <p className="mute small" style={{ margin: '4px 0 0' }}>
              {S.notifications ? 'Notificação ativa neste dispositivo.' : 'Receba uma notificação à hora da sua toma.'}
            </p>
          </div>
          <input
            type="time"
            value={S.reminder}
            aria-label="Hora do lembrete"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              update((d) => { d.reminder = v; });
              toast(`Lembrete às ${v}.`);
            }}
          />
        </div>
        {!S.notifications && notificationsSupported() && (
          <button
            className="btn ghost sm"
            style={{ marginTop: 12 }}
            onClick={async () => {
              const ok = await enableNotifications();
              update((d) => { d.notifications = ok; });
              toast(ok ? 'Notificações ativadas.' : 'As notificações foram bloqueadas no navegador.');
            }}
          >
            <Icon name="bell" /> Ativar notificações
          </button>
        )}
      </section>

      <p style={{ textAlign: 'center' }}>
        <button className="skip" onClick={replayIntro}>Rever as boas-vindas</button>
      </p>
    </>
  );
}

