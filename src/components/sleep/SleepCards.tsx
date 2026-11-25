import { useState } from 'react';
import { DEFAULT_BED, DEFAULT_WAKE, FLAG_QUESTIONS, INTEGRATIVE, PROGRAM, flagAdvice, programDay, sleepPatterns, startProgram, validTime, type SleepFlags } from '../../domain/sleep';
import { canAccess } from '../../domain/features';
import { dayKey, fmtNum, keyDaysAgo } from '../../domain/dates';
import { notePremiumUse } from '../../domain/analytics';
import { isNative } from '../../domain/platform';
import { useStore } from '../../state/store';
import { PremiumLock } from '../Paywall';
import { PremiumTag } from '../PremiumTag';
import type { Practice } from './usePractice';

/** Hora de deitar, hora fixa de acordar e lembretes do sono. */
export function SleepScheduleCard({ onRitual }: { onRitual: () => void }) {
  const { S, update } = useStore();
  const s = S.sleep ?? {};
  const set = (p: Partial<NonNullable<typeof S.sleep>>) => update((d) => { d.sleep = { ...(d.sleep ?? {}), ...p }; });
  const bed = validTime(s.bed) ? s.bed : DEFAULT_BED;
  const wake = validTime(s.wake) ? s.wake : DEFAULT_WAKE;
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>🌙 Ritual da noite</h2>
      </div>
      <p className="small mute" style={{ margin: '6px 0 10px' }}>Uma hora antes de deitar: preparar a casa, esvaziar a cabeça, acalmar o corpo e adormecer com um som que se desliga sozinho.</p>
      <button className="btn" style={{ width: '100%' }} onClick={onRitual}>Começar o ritual da noite</button>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
        <label className="small time-field">
          Hora de deitar
          <input type="time" className="field sm" value={bed} onChange={(e) => validTime(e.target.value) && set({ bed: e.target.value })} />
        </label>
        <label className="small time-field">
          Hora fixa de acordar
          <input type="time" className="field sm" value={wake} onChange={(e) => validTime(e.target.value) && set({ wake: e.target.value })} />
        </label>
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        <label className="small toggle-line"><input type="checkbox" checked={!!s.ritualRemind} onChange={(e) => set({ ritualRemind: e.target.checked })} /> Lembrar-me de começar o ritual (1 hora antes de deitar)</label>
        <label className="small toggle-line"><input type="checkbox" checked={!!s.coffeeRemind} onChange={(e) => set({ coffeeRemind: e.target.checked })} /> Avisar da última cafeína (8 horas antes de deitar)</label>
        <label className="small toggle-line"><input type="checkbox" checked={!!s.lightRemind} onChange={(e) => set({ lightRemind: e.target.checked })} /> Lembrar a luz da manhã (à hora de acordar)</label>
      </div>
      {!isNative() && (s.ritualRemind || s.coffeeRemind || s.lightRemind) && <p className="small mute" style={{ margin: '6px 0 0' }}>Os lembretes tocam na app do iPhone.</p>}
      <p className="small mute" style={{ margin: '8px 0 0' }}>A hora fixa de acordar, todos os dias, é o que mais ajuda o corpo a regular o sono.</p>
    </section>
  );
}

/** Programa "Dormir melhor em 14 dias" (TCC-I sem restrição do sono). */
export function SleepProgramCard({ onPractice, onRitual, onDiary, onFlags }: { onPractice: (p: Practice) => void; onRitual: () => void; onDiary: () => void; onFlags: () => void }) {
  const { S, update, toast } = useStore();
  const ok = canAccess(S, 'sonoPrograma');
  const st = programDay(S);
  const [view, setView] = useState<number | null>(null);
  if (!ok)
    return (
      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>🗓️ Dormir melhor em 14 dias</h2><PremiumTag f="sonoPrograma" /></div>
        <PremiumLock text="Um passo por dia, com base na terapia cognitivo-comportamental para a insónia (o tratamento recomendado em primeiro lugar): diário, hora fixa de acordar, regra dos 20 minutos, ritual, relaxamento e pensamentos que tiram o sono." />
      </section>
    );
  if (!st)
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>🗓️ Dormir melhor em 14 dias</h2>
        <p className="small" style={{ marginTop: 0 }}>Um passo por dia, com base na terapia cognitivo-comportamental para a insónia, o tratamento recomendado em primeiro lugar. Cada dia: o porquê, o que fazer e uma prática guiada.</p>
        <p className="small mute">Não substitui a avaliação de um profissional. Se ressona com pausas na respiração ou adormece sem querer durante o dia, veja primeiro os sinais de alerta mais abaixo.</p>
        <button className="btn" onClick={() => { notePremiumUse('sonoPrograma'); update((d) => { d.sleep = { ...(d.sleep ?? {}), prog: startProgram() }; }); toast('Programa iniciado. Dia 1: o diário do sono. 🌙'); }}>Começar hoje</button>
      </section>
    );
  const dayN = view ?? st.day;
  const day = PROGRAM[dayN - 1];
  const done = st.done.includes(dayN);
  const run = () => {
    const p = day.practice;
    if (!p) return;
    if (p.kind === 'ritual') onRitual();
    else if (p.kind === 'diario') onDiary();
    else if (p.kind === 'alerta') onFlags();
    else if (p.kind === 'respiracao') onPractice({ kind: 'respiracao', id: p.id as never, minutes: 5 });
    else if (p.id) onPractice({ kind: 'meditacao', id: p.id });
  };
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>🗓️ Dormir melhor · dia {dayN} de 14</h2>
        <span className="small mute">{st.done.length}/14 ✓</span>
      </div>
      <div className="chips" style={{ marginTop: 8, gap: 4 }} role="group" aria-label="Dias do programa">
        {PROGRAM.map((p) => (
          <button key={p.day} className={`chip sm ${p.day === dayN ? 'on' : ''}`} style={{ minWidth: 34, padding: '4px 6px', opacity: p.day > st.day ? 0.45 : 1 }} disabled={p.day > st.day} aria-label={`Dia ${p.day}${st.done.includes(p.day) ? ', concluído' : ''}`} onClick={() => setView(p.day)}>
            {st.done.includes(p.day) ? '✓' : p.day}
          </button>
        ))}
      </div>
      <h3 style={{ margin: '12px 0 4px' }}>{day.title}</h3>
      <p className="small" style={{ margin: 0 }}>{day.why}</p>
      <p className="small" style={{ margin: '10px 0 4px' }}><b>Hoje:</b></p>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        {day.todo.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>
        {day.practice && <button className="btn ghost sm" onClick={run}>▶ {day.practice.label}</button>}
        <button
          className="btn sm"
          disabled={done}
          onClick={() => {
            update((d) => {
              const p = d.sleep?.prog;
              if (p && !p.done.includes(dayN)) d.sleep = { ...d.sleep, prog: { ...p, done: [...p.done, dayN].sort((a, b) => a - b) } };
            });
            toast(dayN === 14 ? 'Programa concluído! Mantenha os hábitos que mais o ajudaram. 🌙' : `Dia ${dayN} concluído. Amanhã há mais um passo. 🌙`);
          }}
        >
          {done ? 'Dia concluído ✓' : `Concluir o dia ${dayN}`}
        </button>
      </div>
      {st.finished && (
        <p className="small mute" style={{ margin: '10px 0 0' }}>
          Terminou o programa.{' '}
          <button className="link small inline" onClick={() => update((d) => { d.sleep = { ...(d.sleep ?? {}), prog: startProgram() }; })}>Recomeçar do dia 1</button>
        </p>
      )}
    </section>
  );
}

/** Padrões do sono (Premium): como mudam as noites conforme o dia anterior, e o sono com a energia. */
export function SleepPatternsCard() {
  const { S } = useStore();
  const ok = canAccess(S, 'sonoTendencias');
  const pats = ok ? sleepPatterns(S) : [];
  const d30 = Array.from({ length: 30 }, (_, i) => S.logs[keyDaysAgo(i)]).filter((x) => x?.sleepH !== undefined && x?.e);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const good = mean(d30.filter((x) => x!.sleepH! >= 7).map((x) => x!.e!));
  const bad = mean(d30.filter((x) => x!.sleepH! < 7).map((x) => x!.e!));
  return (
    <section className="card">
      <div className="row"><h2 style={{ margin: 0 }}>🔎 Os padrões do seu sono</h2><PremiumTag f="sonoTendencias" /></div>
      {!ok ? (
        <PremiumLock text="No Premium, a app cruza o seu sono com o treino, os passos, o stress e o ritual da noite, e mostra o que mais ajuda as suas noites." />
      ) : (
        <>
          {good !== null && bad !== null && (
            <p className="small" style={{ margin: '8px 0 0' }}>• Nas noites com 7 horas ou mais, a sua energia no dia seguinte foi <b>{fmtNum(Math.round(good * 10) / 10)}</b> em 5; nas mais curtas, <b>{fmtNum(Math.round(bad * 10) / 10)}</b>.</p>
          )}
          {pats.slice(0, 4).map((p) => <p key={p.id} className="small" style={{ margin: '6px 0 0' }}>• {p.text}</p>)}
          {!pats.length && (good === null || bad === null) && <p className="small mute" style={{ margin: '8px 0 0' }}>Com 2 a 3 semanas de registos do sono, a app começa a mostrar o que muda as suas noites (treino, passos, stress, ritual).</p>}
          <p className="small mute" style={{ margin: '8px 0 0' }}>Observações sobre si, dos últimos 60 dias. Não são uma avaliação clínica.</p>
        </>
      )}
    </section>
  );
}

/** Práticas integrativas, cada uma com a força da evidência e os cuidados. */
export function IntegrativeCard() {
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>🌿 Práticas integrativas</h2>
      <p className="small mute" style={{ marginTop: 0 }}>Complementos que podem ajudar algumas pessoas. Não substituem o médico nem os passos acima.</p>
      {INTEGRATIVE.map((x) => (
        <details key={x.id} className="small" style={{ margin: '8px 0' }}>
          <summary><b>{x.title}</b> <span className="mute">· evidência {x.evidence}</span></summary>
          <p style={{ margin: '6px 0 4px' }}>{x.how}</p>
          <p className="mute" style={{ margin: 0 }}>⚠️ {x.caution}</p>
        </details>
      ))}
    </section>
  );
}

/** Sinais de alerta: quando vale a pena falar com um profissional (encaminhamento, não diagnóstico). */
export function SleepFlagsCard({ id, onPros }: { id?: string; onPros?: () => void }) {
  const { S, update } = useStore();
  const saved = S.sleep?.flags;
  const [f, setF] = useState<SleepFlags>(saved ?? {});
  const [editing, setEditing] = useState(!saved);
  const advice = flagAdvice(saved);
  return (
    <section className="card" id={id}>
      <h2 style={{ marginTop: 0 }}>🩺 Vale a pena falar com um profissional?</h2>
      {editing ? (
        <>
          <p className="small mute" style={{ marginTop: 0 }}>Cinco perguntas rápidas. As respostas ficam só neste telemóvel.</p>
          {FLAG_QUESTIONS.map(([k, q]) => (
            <div key={k} style={{ margin: '8px 0' }}>
              <p className="small" style={{ margin: '0 0 4px' }}>{q}</p>
              <div className="chips">
                <button className={`chip sm ${f[k] === true ? 'on' : ''}`} aria-pressed={f[k] === true} onClick={() => setF({ ...f, [k]: true })}>Sim</button>
                <button className={`chip sm ${f[k] === false ? 'on' : ''}`} aria-pressed={f[k] === false} onClick={() => setF({ ...f, [k]: false })}>Não</button>
              </div>
            </div>
          ))}
          <button className="btn sm" disabled={FLAG_QUESTIONS.some(([k]) => f[k] === undefined)} onClick={() => { update((d) => { d.sleep = { ...(d.sleep ?? {}), flags: { ...f, at: dayKey(new Date()) } }; }); setEditing(false); }}>Ver o resultado</button>
        </>
      ) : advice && advice.length ? (
        <>
          {advice.map((t) => <p key={t} className="small" style={{ margin: '6px 0' }}>• {t}</p>)}
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
            {onPros && <button className="btn sm" onClick={onPros}>Ver profissionais</button>}
            <button className="btn ghost sm" onClick={() => setEditing(true)}>Responder de novo</button>
          </div>
        </>
      ) : (
        <>
          <p className="small" style={{ margin: 0 }}>Pelas suas respostas, não há sinais de alerta. Se o sono continuar difícil durante semanas, ou algo mudar, fale com o seu médico.</p>
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setEditing(true)}>Responder de novo</button>
        </>
      )}
    </section>
  );
}
