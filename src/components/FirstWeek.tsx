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
      <section className="card challenge">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🎯 Desafio da semana: resultado</p>
        <h2 style={{ margin: '4px 0 6px' }}>{m.title}</h2>
        <p className="small" style={{ margin: 0 }}>
          Fez o desafio em <b>{r.days} de 7 dias</b>.{' '}
          {r.after !== null && (r.before !== null
            ? r.better
              ? <>O seu {m.metric} melhorou: <b className="neon">{fmtMetric(c.area, r.before)} → {fmtMetric(c.area, r.after)}</b>. 🎉</>
              : <>O seu {m.metric}: {fmtMetric(c.area, r.before)} → {fmtMetric(c.area, r.after)}. Ainda não mexeu: vale a pena mais uma semana.</>
            : <>O seu {m.metric} esta semana: <b>{fmtMetric(c.area, r.after)}</b>.</>)}
        </p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
          <button className="btn sm" onClick={() => update((d) => { d.challenge = newChallenge(d, undefined, c.area); })}>Próximo desafio</button>
          <button className="btn ghost sm" onClick={() => update((d) => { d.challenge = newChallenge(d); d.challenge.area = c.area; })}>Repetir este</button>
        </div>
      </section>
    );
  }
  return (
    <section className="card challenge">
      <div className="row">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🎯 Desafio da semana · {AREA_NAME[c.area].toLowerCase()}</p>
        <span className="small mute">dia {st.day} de 7</span>
      </div>
      <h2 style={{ margin: '4px 0 4px' }}>{m.title}</h2>
      <p className="small mute" style={{ margin: 0 }}>{m.text} A Spirulina entra como apoio, todos os dias.</p>
      <div className="plan-dots" aria-label={`${c.done.length} de 7 dias feitos`}>{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < c.done.length ? 'done' : i === st.day - 1 ? 'now' : ''} />)}</div>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', marginTop: 10 }}>
        <button className={`btn ${st.doneToday ? 'ghost' : ''} sm`} onClick={() => { update((d) => markChallenge(d)); if (!st.doneToday) toast('Desafio de hoje feito. 💪'); }}>{st.doneToday ? '✓ Feito hoje' : 'Fiz hoje'}</button>
        {(c.area === 'sono' || c.area === 'energia') && (
          <button className="link small inline" onClick={() => { if (c.area === 'sono') requestMeditation('478'); go('mente'); }}>{c.area === 'sono' ? 'Respiração 4-7-8' : 'Respiração guiada'}</button>
        )}
        {c.area === 'movimento' && <button className="link small inline" onClick={() => go('treino')}>Caminhada com GPS</button>}
      </div>
    </section>
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
    <section className="card journey">
      <div className="row">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Dia {j.day} da sua primeira semana</p>
        <button className="x" aria-label="Fechar" onClick={close}>×</button>
      </div>
      <h2 style={{ margin: '4px 0 4px' }}>{j.title}</h2>
      <p className="small" style={{ margin: 0 }}>{j.text}</p>
      {w && (
        <div className="week-grid" style={{ marginTop: 8 }}>
          <div><span className="small mute">Spirulina</span><b>{w.spirulina}/7 dias</b></div>
          <div><span className="small mute">Água na meta</span><b>{w.water}/7 dias</b></div>
          <div><span className="small mute">Check-ins</span><b>{w.checkins}/7</b></div>
          {w.sleep !== null && <div><span className="small mute">Sono médio</span><b>{fmtNum(w.sleep)} h</b></div>}
        </div>
      )}
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', marginTop: 10 }}>
        {j.kind === 'receita' && <button className="btn sm" onClick={() => go('recipes')}>Ver receitas</button>}
        {j.kind === 'pilar' && <button className="btn sm" onClick={close}>Aceito o desafio</button>}
        {j.kind === 'ciencia' && openScience && <button className="btn sm" onClick={openScience}>A ciência por trás</button>}
        {j.kind === 'ciencia' && j.video && <a className="btn ghost sm" href={j.video} target="_blank" rel="noreferrer">▶ Ver o vídeo</a>}
        {j.kind === 'comunidade' && <button className="btn sm" onClick={() => go('social')}>Abrir a Comunidade</button>}
        {j.kind === 'semana' && <button className="btn sm" onClick={startQuiz}>Fazer a reavaliação</button>}
        {j.kind === 'semana' && <button className="link small inline" onClick={() => go('evo')}>Ver evolução</button>}
      </div>
    </section>
  );
}
