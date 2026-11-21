import { bestStreak, reorderText, stock, streakBreak } from '../domain/stats';
import { whatsappLink } from '../domain/content';
import { indexTrend } from '../domain/liveIndex';
import { useEffect, type ReactNode } from 'react';
import { AREAS, TIPS } from '../domain/content';
import { daysSince, keyDaysAgo, todayKey } from '../domain/dates';
import { CARD_LABEL, challengeState, homeVisibility, insightProgress, journeyCard, markChallenge, newChallenge } from '../domain/firstWeek';
import { askAccount, nextLaterQuestion } from '../domain/onboarding';
import { getAuth } from '../domain/account';
import { nextAction } from '../domain/nextAction';
import { planFor, slotsFor } from '../domain/plan';
import { RECIPES } from '../domain/recipes';
import { activityStreak } from '../domain/points';
import { nextReassessment } from '../domain/progress';
import { weeklyReport } from '../domain/weekReport';
import { useStore } from '../state/store';
import { useDoseToggle } from '../state/doses';
import { ChallengeCard, JourneyDayCard } from './FirstWeek';
import { AccountAskCard, LaterQuestionCard } from './LaterQuestion';
import { Icon } from './Icon';
import type { Nav } from '../App';

const RINGS = [
  { key: 'spirulina', color: 'var(--neon)', label: 'Spirulina' },
  { key: 'agua', color: 'var(--water)', label: 'Água' },
  { key: 'desafio', color: 'var(--gold)', label: 'Desafio' },
] as const;

/** Arco de progresso (0–1) num anel de raio r. */
function Arc({ r, p, color }: { r: number; p: number; color: string }) {
  const c = 2 * Math.PI * r;
  return (
    <>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
      {p > 0 && <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.max(0.001, Math.min(1, p)) * c} ${c}`} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray .6s ease' }} />}
    </>
  );
}

/** Painel do dia: 3 anéis (Spirulina, água, desafio) com o Índice ao centro e a legenda ao lado. */
export function DayPanel({ go }: { go: Nav }) {
  const { S, todayLog: l, update, updateToday, toast } = useStore();
  const sl = slotsFor(S);
  const done = (l.doses ?? []).slice(0, sl.length).filter(Boolean).length;
  const goalW = planFor(S).water;
  const w = l.water ?? 0;
  const ch = challengeState(S);
  const chDone = !!ch?.doneToday;
  const trend = indexTrend(S);
  const streak = activityStreak(S);
  const p = { spirulina: sl.length ? done / sl.length : 0, agua: goalW ? w / goalW : 0, desafio: ch && !ch.ended ? (chDone ? 1 : 0) : 0 };
  const val = {
    spirulina: `${done}/${sl.length}`,
    agua: `${w}/${goalW}`,
    desafio: !ch || ch.ended ? '—' : chDone ? 'feito ✓' : 'a fazer',
  };
  return (
    <section className="card day-panel" data-tour="tomas">
      <div className="rings" role="img" aria-label={`Hoje: Spirulina ${val.spirulina}, água ${val.agua}, desafio ${val.desafio}`}>
        <svg viewBox="0 0 120 120">
          <Arc r={52} p={p.spirulina} color="var(--neon)" />
          <Arc r={40} p={p.agua} color="var(--water)" />
          <Arc r={28} p={p.desafio} color="var(--gold)" />
        </svg>
        <button className="rings-center" onClick={() => go('quiz')} aria-label="Ver o plano e o Índice">
          <b>{trend.now}</b>
          <span>Índice hoje</span>
        </button>
      </div>
      <div className="legend">
        {RINGS.map((r) => (
          <div key={r.key} className="lg-row">
            <i style={{ background: r.color }} />
            <span className="lg-txt"><span className="small mute">{r.label}</span><b className="small">{val[r.key]}</b></span>
            {r.key === 'agua' && <button className="mini-add" aria-label="Mais um copo de água" onClick={() => { updateToday((t) => { t.water = (t.water ?? 0) + 1; }); if (w + 1 === goalW) toast('Meta de água cumprida. 💧'); }}>+1</button>}
            {r.key === 'desafio' && ch && !ch.ended && <button className="mini-add" aria-label={chDone ? 'Desmarcar o desafio de hoje' : 'Marcar o desafio de hoje'} onClick={() => update((d) => markChallenge(d))}>{chDone ? '↺' : '✓'}</button>}
          </div>
        ))}
        <p className="small mute lg-foot">
          🔥 {streak === 0 && bestStreak(S) > 0 ? 'recomece hoje' : `${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'}`}
          {trend.from !== null && trend.from !== trend.now && <> · Índice: início {trend.from}, hoje <b className="ink">{trend.now}</b></>}
        </p>
      </div>
    </section>
  );
}

/** "A seguir": uma só ação, com botão grande e a hora sugerida. */
export function NextActionCard({ go }: { go: Nav }) {
  const { S, todayLog: l, update, updateToday, toast } = useStore();
  const { toggle } = useDoseToggle();
  const na = nextAction(S, l);
  const goalW = planFor(S).water;
  const run = () => {
    if (na.kind === 'dose' && na.slot !== undefined) toggle(na.slot);
    else if (na.kind === 'med' && na.med) updateToday((t) => { t.meds = { ...(t.meds ?? {}), [na.med!]: true }; });
    else if (na.kind === 'agua') {
      updateToday((t) => { t.water = (t.water ?? 0) + 1; });
      if ((l.water ?? 0) + 1 === goalW) toast('Meta de água cumprida. 💧');
    } else if (na.kind === 'desafio') { update((d) => markChallenge(d)); toast('Desafio de hoje feito. 💪'); }
    else if (na.kind === 'refeicao') go('nutri');
    else if (na.kind === 'checkin') go('check');
    else if (na.kind === 'treino') go('treino');
  };
  const label = { dose: 'Tomei', med: 'Tomei', agua: '+ 1 copo', refeicao: 'Registar', checkin: 'Fazer o check-in', treino: 'Treinar', desafio: 'Fiz', feito: '' }[na.kind];
  return (
    <section className="card next-action na-big" data-tour="proxima">
      <div className="row">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>A seguir</p>
        {na.when && <span className="na-when">🕐 {na.when}</span>}
      </div>
      <h2 style={{ margin: '4px 0 2px' }}>{na.title}</h2>
      <p className="small mute" style={{ margin: 0 }}>{na.detail}</p>
      {label && <button className="btn full big" onClick={run}>{label}</button>}
    </section>
  );
}

function Slide({ children, k }: { children: ReactNode; k: string }) {
  return <div className="slide" key={k}>{children}</div>;
}

/** "Hoje para si": carrossel com os conteúdos do dia (substitui os cartões soltos). */
export function TodayCarousel({ go, openScience, startQuiz, openSignup }: { go: Nav; openScience?: () => void; startQuiz: () => void; openSignup?: () => void }) {
  const { S, update } = useStore();
  // o desafio da semana começa sozinho com o primeiro plano
  useEffect(() => {
    if (S.ans && !S.sample && !S.challenge) update((d) => { d.challenge = newChallenge(d); });
  }, [!!S.ans, !!S.challenge]); // eslint-disable-line react-hooks/exhaustive-deps
  const vis = homeVisibility(S);
  const ip = insightProgress(S);
  const newInsight = ip.level >= 2 && ip.level > (S.insightSeen ?? 0) && (!!ip.insight || ip.level >= 10);
  const j = journeyCard(S);
  const q = nextLaterQuestion(S);
  const acct = !!openSignup && askAccount(S, !!getAuth());
  const re = nextReassessment(S);
  const now = new Date();
  const reportDay = (now.getDay() === 0 && now.getHours() >= 18) || now.getDay() === 1;
  const report = reportDay && !S.sample ? weeklyReport(S, now) : null;
  const n = daysSince('2026-01-01');
  const rec = RECIPES[((n % RECIPES.length) + RECIPES.length) % RECIPES.length];
  const tip = TIPS[((n % TIPS.length) + TIPS.length) % TIPS.length];
  // cada cartão com prioridade; no máximo 5, e só 2 a pedir alguma coisa (pergunta, conta, reavaliação)
  const slides: { k: string; el: ReactNode; ask?: boolean }[] = [];
  const br = streakBreak(S);
  if (br)
    slides.push({ k: 'recomecar', el: (
      <>
        <p className="small gold sl-h">🌱 Recomece hoje</p>
        <p style={{ margin: 0 }}>A sua sequência de {br.prev} dias parou ontem. Não faz mal: um dia não apaga o que já fez. Tome a Spirulina hoje e começa uma nova{br.best > br.prev ? ` (a sua melhor marca é ${br.best})` : ''}.</p>
      </>
    ) });
  const st = stock(S);
  if (S.stockCaps > 0 && st.days <= 14 && st.days > 7)
    slides.push({ k: 'reposicao', el: (
      <>
        <p className="small gold sl-h">🛒 Reposição</p>
        <p style={{ margin: 0 }}>A sua Spirulina acaba daqui a cerca de <b>{st.days} dias</b>. Encomende com tempo para o ritual não parar.</p>
        <a className="btn sm" href={whatsappLink(reorderText(S))} target="_blank" rel="noopener">Encomendar</a>
      </>
    ) });
  if (newInsight)
    slides.push({ k: 'insight', el: (
      <>
        <p className="small gold sl-h">💡 Novo insight</p>
        <p style={{ margin: 0 }}>{ip.insight?.text ?? 'O seu resumo de 10 check-ins está pronto.'}</p>
        <button className="btn sm" onClick={() => go('evo')}>Ver na Evolução</button>
      </>
    ) });
  if (q) slides.push({ k: 'pergunta', el: <LaterQuestionCard />, ask: true });
  if (j) slides.push({ k: 'jornada', el: <><p className="small gold sl-h">Dia {j.day} da sua primeira semana</p><JourneyDayCard go={go} openScience={openScience} startQuiz={startQuiz} /></> });
  if (vis.novo || vis.amanha)
    slides.push({ k: 'novo', el: (
      <>
        <p className="small gold sl-h">✨ Novidade</p>
        {vis.novo && <p style={{ margin: 0 }}><b>Novo no Início:</b> {CARD_LABEL[vis.novo]}</p>}
        {vis.amanha && <p className="small mute" style={{ margin: '6px 0 0' }}>Amanhã abre: {CARD_LABEL[vis.amanha]}</p>}
      </>
    ) });
  if (S.challenge) slides.push({ k: 'desafio', el: <ChallengeCard go={go} /> });
  if (report && report.index !== null && S.reportSeen !== report.week)
    slides.push({ k: 'relatorio', el: (
      <>
        <p className="small gold sl-h">📊 Relatório da semana</p>
        <p style={{ margin: 0 }}>Consistência: <b>{report.index}/100</b>. Veja o que a IA percebeu e a prioridade para a próxima semana.</p>
        <button className="btn sm" onClick={() => go('evo')}>Ver</button>
      </>
    ) });
  if (re?.due && !S.sample)
    slides.push({ k: 'reavaliar', ask: true, el: (
      <>
        <p className="small gold sl-h">🔄 Reavaliação dos {re.target} dias</p>
        <p style={{ margin: 0 }}>2 minutos: atualize o peso e veja o Índice antes e depois.</p>
        <button className="btn sm" onClick={startQuiz}>Reavaliar</button>
      </>
    ) });
  if (acct && openSignup) slides.push({ k: 'conta', el: <AccountAskCard openSignup={openSignup} streak={activityStreak(S)} />, ask: true });
  slides.push({ k: 'receita', el: (
    <>
      <p className="small gold sl-h">🥣 Receita do dia</p>
      <p style={{ margin: 0 }}><b>{rec.title}</b></p>
      <p className="small mute" style={{ margin: '2px 0 0' }}>{rec.kind} · {String(rec.grams).replace('.', ',')} g de Spirulina ({rec.form})</p>
      <button className="btn ghost sm" onClick={() => go('recipes')}>Ver receitas</button>
    </>
  ) });
  slides.push({ k: 'dica', el: <><p className="small gold sl-h">Sabia que…</p><p style={{ margin: 0 }}>{tip}</p></> });
  const PRI = ['recomecar', 'insight', 'desafio', 'reavaliar', 'reposicao', 'pergunta', 'jornada', 'novo', 'relatorio', 'conta', 'receita', 'dica'];
  slides.sort((a, b) => PRI.indexOf(a.k) - PRI.indexOf(b.k));
  let asks = 0;
  const shown = slides.filter((x) => (x.ask ? ++asks <= 2 : true)).slice(0, 5);
  return (
    <section className="today-carousel" aria-label="Hoje para si">
      <div className="row" style={{ margin: '0 2px 6px' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Hoje para si</h2>
        <span className="small mute">{shown.length} · deslize →</span>
      </div>
      <div className="carousel">
        {shown.map((s) => <Slide key={s.k} k={s.k}>{s.el}</Slide>)}
      </div>
    </section>
  );
}

/** Energia dos últimos 7 dias (dias sem registo a cinzento). */
export function EnergyWeek({ go }: { go: Nav }) {
  const { S, todayLog: l } = useStore();
  const days = Array.from({ length: 7 }, (_, i) => keyDaysAgo(6 - i));
  const D = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  return (
    <section className="card energy-week" data-tour="checkin">
      <div className="row">
        <h2 style={{ margin: 0, fontSize: 18 }}>Energia · 7 dias</h2>
        {!l.e ? <button className="btn sm" onClick={() => go('check')}>Check-in de hoje</button> : <button className="link small inline" onClick={() => go('evo')}>Evolução →</button>}
      </div>
      <div className="ew-bars" role="img" aria-label={`Energia dos últimos 7 dias: ${days.map((k) => S.logs[k]?.e ?? 'sem registo').join(', ')}`}>
        {days.map((k) => {
          const e = S.logs[k]?.e;
          return (
            <div key={k} className={`ew-col ${k === todayKey() ? 'is-today' : ''}`}>
              <span className={`ew-bar ${e ? '' : 'empty'}`} style={{ height: `${e ? (e / 5) * 100 : 18}%` }}>{e ? <small>{e}</small> : null}</span>
              <i>{D[new Date(`${k}T12:00:00`).getDay()]}</i>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Atalhos: Nutrição, Sono, Mente e Treino. */
export function Shortcuts({ go }: { go: Nav }) {
  const items: [Parameters<Nav>[0], string, Parameters<typeof Icon>[0]['name']][] = [
    ['nutri', 'Nutrição', 'recipes'],
    ['sono', 'Sono', 'moon'],
    ['mente', 'Mente', 'mind'],
    ['treino', 'Treino', 'flame'],
  ];
  return (
    <div className="shortcuts" role="navigation" aria-label="Atalhos">
      {items.map(([t, label, icon]) => (
        <button key={t} onClick={() => go(t)}>
          <span className="sc-ic"><Icon name={icon} /></span>
          <span className="small">{label}</span>
        </button>
      ))}
    </div>
  );
}

export const AREA_LABEL = Object.fromEntries(AREAS);
