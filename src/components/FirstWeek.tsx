import { useEffect } from 'react';
import { AREAS } from '../domain/content';
import { fmtNum } from '../domain/dates';
import { MICRO, challengeState, journeyCard, markChallenge, newChallenge } from '../domain/firstWeek';
import { requestMeditation } from '../domain/mind';
import { weeklySummary } from '../domain/progress';
import type { AreaKey } from '../domain/types';
import { useStore } from '../state/store';
import type { Nav } from '../App';

const AREA_NAME = Object.fromEntries(AREAS) as Record<AreaKey, string>;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const fmtMetric = (a: AreaKey, v: number) =>
  a === 'sono' ? `${fmtNum(v)} h` : a === 'movimento' ? `${v} min` : a === 'energia' ? `${fmtNum(v)}/5` : `${v} de 7 dias`;

/** Desafio da semana: uma micro-ação para o pilar mais fraco, com visto diário e o resultado no fim. */
export function ChallengeCard({ go }: { go: Nav }) {
  const { S, update, toast } = useStore();
  // começa sozinho com o primeiro plano
  useEffect(() => {
    if (S.ans && !S.sample && !S.challenge) update((d) => { d.challenge = newChallenge(d); });
  }, [!!S.ans, !!S.challenge]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = challengeState(S);
  if (!st || S.sample) return null;
  const { c } = st;
  const m = MICRO[c.area];
  if (st.ended && st.result) {
    const r = st.result;
    return (
      <div className="challenge-body">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🎯 Desafio da semana: resultado</p>
        <h2 style={{ margin: '4px 0 6px' }}>{m.title}</h2>
        <p className="small" style={{ margin: 0 }}>
          Fez o desafio em <b>{r.days} de 7 dias</b>.{' '}
          {r.after !== null && (r.before !== null
            ? r.better
              ? <>{cap(m.metric)}: <b className="neon">{fmtMetric(c.area, r.before)} → {fmtMetric(c.area, r.after)}</b>. Melhorou! 🎉</>
              : <>{cap(m.metric)}: {fmtMetric(c.area, r.before)} → {fmtMetric(c.area, r.after)}. {r.days >= 4 ? 'Cumpriu o desafio: os resultados às vezes demoram mais de uma semana a aparecer.' : 'Com mais dias de desafio, a diferença aparece: vale a pena mais uma semana.'}</>
            : <>{cap(m.metric)} esta semana: <b>{fmtMetric(c.area, r.after)}</b>.</>)}
        </p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
          <button className="btn sm" onClick={() => update((d) => { d.challenge = newChallenge(d, undefined, c.area); })}>Próximo desafio</button>
          <button className="btn ghost sm" onClick={() => update((d) => { d.challenge = newChallenge(d); d.challenge.area = c.area; })}>Repetir este</button>
        </div>
      </div>
    );
  }
  return (
    <div className="challenge-body">
      <div className="row">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🎯 Desafio da semana · {AREA_NAME[c.area].toLowerCase()}</p>
        <span className="small mute">dia {st.day} de 7</span>
      </div>
      <h2 style={{ margin: '4px 0 4px' }}>{m.title}</h2>
      <div className="plan-dots" aria-label={`${c.done.length} de 7 dias feitos`}>{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < c.done.length ? 'done' : i === st.day - 1 ? 'now' : ''} />)}</div>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', marginTop: 10 }}>
        <button className={`btn ${st.doneToday ? 'ghost' : ''} sm`} onClick={() => { update((d) => markChallenge(d)); if (!st.doneToday) toast('Desafio de hoje feito. 💪'); }}>{st.doneToday ? '✓ Feito hoje' : 'Fiz hoje'}</button>
        {(c.area === 'sono' || c.area === 'energia') && (
          <button className="link small inline" onClick={() => { if (c.area === 'sono') requestMeditation('478'); go('mente'); }}>{c.area === 'sono' ? 'Respiração 4-7-8' : 'Respiração guiada'}</button>
        )}
        {c.area === 'movimento' && <button className="link small inline" onClick={() => go('treino')}>Caminhada com GPS</button>}
      </div>
    </div>
  );
}

/** Cartão do dia da primeira semana (dias 1 a 7). */
export function JourneyDayCard({ go, openScience, startQuiz }: { go: Nav; openScience?: () => void; startQuiz: () => void }) {
  const { S, update } = useStore();
  const j = journeyCard(S);
  if (!j) return null;
  const close = () => update((d) => { d.journeySeen = [...(d.journeySeen ?? []), j.day]; });
  const w = j.kind === 'semana' ? weeklySummary(S) : null;
  return (
    <div className="today-part journey">
      <div className="row">
        <h3 style={{ margin: 0 }}>{j.title}</h3>
        <button className="x" aria-label="Fechar" onClick={close}>×</button>
      </div>
      <p className="small" style={{ margin: 0 }}>{j.text}</p>
      {w && (
        <p className="small" style={{ margin: '8px 0 0' }}>
          🌿 <b>{w.spirulina}/7</b> dias de Spirulina · 💧 <b>{w.water}/7</b> na meta da água · ✅ <b>{w.checkins}/7</b> check-ins{w.sleep !== null ? <> · 🌙 <b>{fmtNum(w.sleep)} h</b> de sono</> : null}
        </p>
      )}
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', marginTop: 10 }}>
        {j.kind === 'receita' && <button className="btn sm" onClick={() => go('recipes')}>Ver receitas</button>}
        {j.kind === 'ciencia' && openScience && <button className="btn sm" onClick={openScience}>A ciência por trás</button>}
        {j.kind === 'ciencia' && j.video && <a className="btn ghost sm" href={j.video} target="_blank" rel="noreferrer">▶ Ver o vídeo</a>}
        {j.kind === 'comunidade' && <button className="btn sm" onClick={() => go('social')}>Abrir a Comunidade</button>}
        {j.kind === 'semana' && !j.done && <button className="btn sm" onClick={startQuiz}>Fazer a reavaliação</button>}
        {j.kind === 'semana' && <button className="link small inline" onClick={() => go('evo')}>Ver evolução</button>}
      </div>
    </div>
  );
}
