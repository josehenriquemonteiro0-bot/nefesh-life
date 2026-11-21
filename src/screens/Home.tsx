import { testDays } from '../testDate';
import { CARD_LABEL, homeVisibility, insightProgress, journeyCard } from '../domain/firstWeek';
import { askAccount, nextLaterQuestion } from '../domain/onboarding';
import { getAuth } from '../domain/account';
import { ChallengeCard, JourneyDayCard } from '../components/FirstWeek';
import { QUIZ } from '../domain/onboarding';
import { AccountAskCard, LaterQuestionCard } from '../components/LaterQuestion';
import { useMemo } from 'react';
import { Bar, Glass, Ring } from '../components/Charts';
import { Icon } from '../components/Icon';
import { GLASS_ML, HABITS, PROS, SHOP_URL, STEP_GOAL, TIPS, whatsappLink } from '../domain/content';
import { daysSince, fmtNum, greeting, longToday, todayKey } from '../domain/dates';
import { planFor, inAdaptation, indexOf, slotsFor } from '../domain/plan';
import { adherence, habitOn, reorderText, stock } from '../domain/stats';
import { nextAction } from '../domain/nextAction';
import { useStore } from '../state/store';
import { useDoseToggle } from '../state/doses';
import { requestListen } from '../domain/voice';
import { weeklyReport } from '../domain/weekReport';
import { doseText, stockText } from '../domain/lots';
import { DataCard } from '../components/DataCard';
import { syncedLabel, useAuth } from '../domain/account';
import { SpirulinaCheck } from '../components/SpirulinaCheck';
import { HealthShotButton } from '../components/HealthShot';
import { SourceTag } from '../components/SourceTag';
import { setSource } from '../domain/sources';
import { activityStreak, dayScore } from '../domain/points';
import { LEAGUES, unreadCount, useSocial } from '../domain/social';
import { nextReassessment, spirulinaInsight, weeklySummary } from '../domain/progress';
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

export function ActivityCard({ openHealth }: { openHealth: () => void }) {
  const { S, todayLog: l, updateToday } = useStore();
  const steps = l.steps ?? 0;
  const p = Math.min(1, steps / STEP_GOAL);
  const setSteps = (raw: string) => {
    const v = raw.trim() === '' ? undefined : Number(raw.replace(/\D/g, ''));
    updateToday((d) => {
      if (v === undefined || Number.isNaN(v)) delete d.steps;
      else d.steps = Math.max(0, Math.min(100000, Math.round(v)));
      setSource(d, 'steps', null);
    });
  };
  return (
    <section className="card" data-tour="passos">
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
      {l.steps !== undefined && <p style={{ margin: '10px 0 0' }}><SourceTag l={l} f="steps" /></p>}
      {S.health2 ? (
        <p className="small mute" style={{ margin: '10px 0 0' }}>
          Ligado ao app Saúde · últimos dados {syncedLabel(S.health2.lastAt)}.{' '}
          <button className="link small inline" onClick={openHealth}>gerir</button>
        </p>
      ) : (
        <>
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={openHealth}><Icon name="steps" /> Ligar ao app Saúde e Apple Watch</button>
          <HealthShotButton compact />
          <p className="small mute" style={{ margin: '8px 0 0' }}>Ou escreva os passos aqui. As horas de sono registam-se no check-in.</p>
        </>
      )}
    </section>
  );
}

/** Faixa no topo: sequência, pontos de hoje e liga (abre a Comunidade). */
function StatusStrip({ go }: { go: Nav }) {
  const { S } = useStore();
  const auth = useAuth();
  const joined = !!auth && !!S.community;
  const { state: st } = useSocial(joined ? 120_000 : Infinity);
  const pts = st?.verify ? st.verify.points : dayScore(S, todayKey()).points;
  const streakN = useMemo(() => activityStreak(S), [S]);
  const me = st?.league?.find((m) => m.me);
  const unread = unreadCount(st);
  return (
    <button className="status-strip" data-tour="strip" onClick={() => go('social')} aria-label="Abrir a Comunidade">
      <span><b>🔥 {streakN}</b><small>{streakN === 1 ? 'dia de ritual' : 'dias de ritual'}</small></span>
      <span><b>⭐ {pts}</b><small>pontos hoje</small></span>
      {joined ? (
        <span><b>🏆 {me ? `${me.rank}.º` : '—'}</b><small>liga {LEAGUES[st?.me?.league ?? 0]}</small></span>
      ) : (
        <span><b>🏆</b><small>entrar na liga</small></span>
      )}
      {unread > 0 && <i className="badge-new">{unread}</i>}
    </button>
  );
}

/** Acompanhamento por profissionais de saúde parceiros. */
export function ProsCard({ go }: { go: Nav }) {
  const { S } = useStore();
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Acompanhamento profissional</h2>
      <p className="small mute" style={{ marginTop: 0 }}>
        Nutricionistas, médicos, profissionais de exercício e psicólogos parceiros da NEFESH ajustam o plano ao seu caso.
      </p>
      <div className="pro-avs">
        {PROS.map((p) => (
          <span key={p.i} title={p.n}><i>{p.i}</i>{({ NU: 'Nutricionista', MI: 'Médico', PE: 'Exercício', PS: 'Psicólogo' } as Record<string, string>)[p.i] ?? p.n}</span>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 12 }}>
        <a className="btn sm" href={whatsappLink(`Olá NEFESH! Gostava de ter acompanhamento profissional${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}.`)} target="_blank" rel="noopener">Pedir acompanhamento</a>
        <button className="btn ghost sm" onClick={() => go('pros')}>Ver profissionais</button>
      </div>
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
      {(() => {
        const r = spirulinaInsight(S);
        return r.comparable && r.energyDiff! > 0 ? (
          <p className="small" style={{ margin: '8px 0 0' }}>🌿 Nos dias com ritual, a sua energia foi <b className="neon">{fmtNum(r.energyDiff!)} pontos mais alta</b>.</p>
        ) : null;
      })()}
      <div className="week-grid">
        {items.map(([k, v]) => (
          <div key={k}><span className="small mute">{k}</span><b>{v}</b></div>
        ))}
      </div>
    </section>
  );
}

/** Hidratação: copos de hoje (também em Nutrição). */
export function WaterCard() {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const goalW = planFor(S).water;
  const w = l.water || 0;
  const setWater = (n: number) => {
    updateToday((t) => { t.water = Math.max(0, n); });
    if (n === goalW && w < goalW) toast('Meta de água cumprida.');
  };
  return (
    <section className="card" data-tour="agua">
        <div className="row">
          <h2 style={{ margin: 0 }}>Hidratação</h2>
          <span className="small mute">{litres(w)} de {litres(goalW)} L</span>
        </div>
        <div className="water-row">
          <Glass on={w > 0} />
          <div style={{ flex: 1 }}>
            <Bar pct={(w / goalW) * 100} variant="water" />
            <p className="small mute" style={{ margin: '4px 0 0' }}>
              {w} de {goalW} copos · {w >= goalW ? 'meta cumprida hoje' : `faltam ${goalW - w}`}
            </p>
          </div>
        </div>
        <div className="row">
          <p className="small mute" style={{ margin: 0 }}>Copos de 250 ml · meta de 35 ml por kg.</p>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => setWater(w - 1)} aria-label="Retirar um copo">−</button>
            <button className="btn sm" onClick={() => setWater(w + 1)}>+ 1 copo</button>
          </div>
        </div>
      </section>
  );
}

/** Hábitos de hoje (também em Mente). */
export function HabitsCard() {
  const { S, todayLog: l, updateToday, toast } = useStore();
  return (
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
                  if (k === 'sono' && l.sleepH !== undefined) return toast('Este hábito marca-se pelas horas de sono do check-in.');
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
  );
}

/** "Hoje": o cartão do dia, a novidade, a pergunta do dia e o pedido de conta, num só lugar. */
function TodayCard({ vis, go, openScience, startQuiz, openSignup }: { vis: ReturnType<typeof homeVisibility>; go: Nav; openScience?: () => void; startQuiz: () => void; openSignup?: () => void }) {
  const { S } = useStore();
  const ip = insightProgress(S);
  const newInsight = ip.level >= 2 && ip.level > (S.insightSeen ?? 0) && !!(ip.insight || ip.level >= 10);
  const j = journeyCard(S);
  const q = nextLaterQuestion(S);
  const acct = !!openSignup && askAccount(S, !!getAuth());
  const nov = newInsight || !!vis.novo || !!vis.amanha;
  if (!j && !q && !acct && !nov) return null;
  const day = S.planStart ? daysSince(S.planStart) + 1 : 0;
  return (
    <section className="card today">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Hoje{day >= 1 && day <= 14 ? ` · dia ${day}` : ''}</p>
      {nov && (
        <div className="today-part">
          {newInsight && (
            <div className="row" style={{ gap: 8 }}>
              <p className="small" style={{ margin: 0 }}>💡 <b>O seu novo insight está pronto.</b></p>
              <button className="btn sm" onClick={() => go('evo')}>Ver</button>
            </div>
          )}
          {vis.novo && <p className="small" style={{ margin: newInsight ? '8px 0 0' : 0 }}>✨ <b>Novo no Início:</b> {CARD_LABEL[vis.novo]}</p>}
          {vis.amanha && <p className="small mute" style={{ margin: newInsight || vis.novo ? '6px 0 0' : 0 }}>Amanhã abre: {CARD_LABEL[vis.amanha]}</p>}
        </div>
      )}
      <JourneyDayCard go={go} openScience={openScience} startQuiz={startQuiz} />
      <LaterQuestionCard />
      {openSignup && <AccountAskCard openSignup={openSignup} streak={activityStreak(S)} />}
    </section>
  );
}

export function Home({ go, startQuiz, onReset, openBottle, openLogin, openHealth, openSignup, openScience }: { go: Nav; startQuiz: () => void; onReset: () => void; openBottle: () => void; openLogin: () => void; openHealth: () => void; openSignup?: () => void; openScience?: () => void }) {
  const { S, updateToday, todayLog: l, toast } = useStore();

  if (!S.ans)
    return (
      <>
        <SampleBanner onReset={onReset} />
        <section className="card hero">
          <h1>Descubra o seu Índice NEFESH e a sua dose ideal</h1>
          <p>{QUIZ.length} perguntas, cerca de 1 minuto. No fim recebe a sua pontuação de bem-estar e um plano de Spirulina feito para si.</p>
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
  const low = st.days <= 10;
  const re = nextReassessment(S);
  const vis = homeVisibility(S);
  const firstDays = vis.progressive && day <= 7;

  const { toggle: toggleDose } = useDoseToggle();

  const setWater = (n: number) => {
    updateToday((t) => { t.water = Math.max(0, n); });
    if (n === goalW && w < goalW) toast('Meta de água cumprida.');
  };

  return (
    <>
      <SampleBanner onReset={onReset} />
      {testDays() > 0 && <p className="small warn" style={{ margin: '0 0 6px' }}>🧪 Modo de teste: a data está avançada {testDays()} {testDays() === 1 ? 'dia' : 'dias'} (Perfil → Voltar a hoje).</p>}
      <p className="mute small" style={{ margin: 0 }}>{longToday()} · dia {day} do ritual</p>
      <h1>{greeting()}{S.ans.name ? `, ${S.ans.name}` : ''}</h1>
      {vis.show.has('comunidade') && <StatusStrip go={go} />}

      {(() => {
        const na = nextAction(S, l);
        const run = () => {
          if (na.kind === 'dose' && na.slot !== undefined) toggleDose(na.slot);
          else if (na.kind === 'med' && na.med) updateToday((t) => { t.meds = { ...(t.meds ?? {}), [na.med!]: true }; });
          else if (na.kind === 'agua') setWater(w + 1);
          else if (na.kind === 'refeicao') go('nutri');
          else if (na.kind === 'checkin') go('check');
        };
        const label = { dose: 'Tomei', med: 'Tomei', agua: '+ 1 copo', refeicao: 'Registar', checkin: 'Check-in', treino: 'Treinar', feito: '' }[na.kind];
        return (
          <section className="card next-action" data-tour="proxima">
            <div className="na-text">
              <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>A seguir</p>
              <h2 style={{ margin: '2px 0 2px' }}>{na.title}</h2>
              <p className="small mute" style={{ margin: 0 }}>{na.detail}</p>
            </div>
            {label && na.kind !== 'dose' && <div className="na-actions"><button className="btn sm" onClick={run}>{label}</button></div>}
            <div className="na-spirulina">
              <div className="row">
                <p className="small" style={{ margin: 0, opacity: 0.85 }}>Spirulina de hoje · <b>{done}/{sl.length}</b> · {dt(totalCaps)}</p>
                {ev && <span className="small mute">Índice {indexOf(ev.sc)}</span>}
              </div>
              <div className="slots" data-tour="tomas">
          {sl.map((s, i) => (
            <div className="slot" key={s.l}>
              <div>
                <h3>{s.l}</h3>
                <p className="small mute" style={{ margin: 0 }}>{dt(s.n)}{i === 0 && S.reminder ? ` · lembrete às ${S.reminder}` : ''}</p>
              </div>
              <button className={`tick ${doses[i] ? 'on' : ''}`} onClick={() => toggleDose(i)} aria-pressed={!!doses[i]} aria-label={`Marcar toma: ${s.l}`}>
                <Icon name="ok" color="#00140d" width={3} />
              </button>
            </div>
          ))}
        </div>
        <p className="small" style={{ margin: '8px 0 0', opacity: 0.75 }}>
          Aderência à Spirulina: <b>{adherence(S, 14)}%</b> dos últimos 14 dias
          {inAdaptation(S) ? ' · semana de adaptação: está a tomar metade da dose.' : ''}
        </p>
            </div>

            <button className="btn ghost full talk talk-big" onClick={() => { requestListen(); go('coach'); }} aria-label="Toca para falar com o NEFESH Voice Assistant">
              <Icon name="mic" /> Toca para falar
            </button>
          </section>
        );
      })()}

      <TodayCard vis={vis} go={go} openScience={openScience} startQuiz={startQuiz} openSignup={openSignup} />
      <ChallengeCard go={go} />

      {(() => {
        // relatório semanal pronto (domingo à noite e segunda-feira), até ser aberto
        const now = new Date();
        const show = (now.getDay() === 0 && now.getHours() >= 18) || now.getDay() === 1;
        if (!show || S.sample) return null;
        const r = weeklyReport(S, now);
        if (r.index === null || S.reportSeen === r.week) return null;
        return (
          <section className="card next-action">
            <div className="na-text">
              <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>📊 Relatório da semana</p>
              <h2 style={{ margin: '2px 0 2px' }}>Consistência: {r.index}/100</h2>
              <p className="small mute" style={{ margin: 0 }}>Veja o que a IA percebeu e a sua prioridade para a próxima semana.</p>
            </div>
            <div className="na-actions"><button className="btn sm" onClick={() => go('evo')}>Ver</button></div>
          </section>
        );
      })()}

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



      <SpirulinaCheck />

      {low && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>Reposição</h2>
            <span className="mute small">{c.format === 'caps' ? st.left : fmtNum(st.left / 2)} de {stockText(S.stockCaps, c.format)}</span>
          </div>
          <Bar pct={st.pct} variant="low" />
          <p className="small">{st.days ? `A sua Spirulina acaba em ${st.days} ${st.days === 1 ? 'dia' : 'dias'}${st.rate < 1 ? `, ao seu ritmo (toma em ${Math.round(st.rate * 100)}% dos dias)` : ''}.` : 'A sua Spirulina acabou.'} Encomende já para o ritual não parar: a entrega demora alguns dias.</p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <a className="btn sm" href={whatsappLink(reorderText(S))} target="_blank" rel="noopener">Encomendar pelo WhatsApp</a>
            <a className="btn ghost sm" href={SHOP_URL} target="_blank" rel="noopener">Loja online</a>
            <button className="btn ghost sm" onClick={openBottle}><Icon name="qr" /> Chegou o frasco novo</button>
          </div>
        </section>
      )}

      {vis.show.has('agua') && <WaterCard />}

      {!l.e && (
        <section className="card" data-tour="checkin">
          <div className="row">
            <div>
              <h2 style={{ margin: 0 }}>Como se sente hoje?</h2>
              <p className="mute small" style={{ margin: '4px 0 0' }}>30 segundos: energia, sono, disposição, treino e Spirulina.</p>
            </div>
            <button className="btn ghost sm" onClick={() => go('check')}>Check-in</button>
          </div>
        </section>
      )}

      {vis.show.has('passos') && <ActivityCard openHealth={openHealth} />}

      {vis.show.has('habitos') && <HabitsCard />}

      {vis.show.has('pros') && <ProsCard go={go} />}

      {firstDays ? null : <WeekCard go={go} />}


      {!firstDays && <section className="card tip">
        <p className="small gold" style={{ margin: '0 0 4px', fontWeight: 700 }}>Sabia que…</p>
        <p style={{ margin: 0 }}>{tip}</p>
      </section>}

    </>
  );
}

