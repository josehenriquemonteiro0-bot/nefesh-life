import { DecimalInput } from '../components/DecimalInput';
import { useEffect, useRef } from 'react';
import { QUIZ as QUESTIONS } from '../domain/onboarding';
import type { Answers } from '../domain/types';

export interface QuizState {
  draft: Answers;
  qi: number;
}

export function Quiz({ state, setState, onCancel }: { state: QuizState; setState: (s: QuizState) => void; onCancel: () => void }) {
  const { draft, qi } = state;
  const q = QUESTIONS[qi];
  const v = draft[q.id];
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (q.kind === 'text') inputRef.current?.focus();
  }, [qi, q.kind]);

  const set = (patch: Partial<Answers>, advance = false) => setState({ draft: { ...draft, ...patch }, qi: advance ? qi + 1 : qi });
  const next = () => {
    // garante o valor por omissão no campo numérico mesmo sem mexer no slider
    if (q.kind === 'num' && v === undefined) set({ [q.id]: q.def }, true);
    else if (q.kind === 'num') set({ [q.id]: Math.max(q.min, Math.min(q.max, v as number)) }, true);
    else setState({ draft, qi: qi + 1 });
  };
  const last = qi === QUESTIONS.length - 1;

  let body: JSX.Element;
  let showNext = false;
  let canNext = true;
  if (q.kind === 'text') {
    showNext = true;
    body = (
      <input
        ref={inputRef}
        className="field"
        maxLength={24}
        placeholder={q.placeholder}
        value={(v as string) || ''}
        autoComplete="given-name"
        onChange={(e) => set({ [q.id]: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && next()}
      />
    );
  } else if (q.kind === 'num') {
    showNext = true;
    const step = q.step ?? 1;
    const val = (v as number) ?? q.def;
    const clamp = (n: number) => Math.max(q.min, Math.min(q.max, Math.round(n / step) * step));
    body = (
      <>
        <div className="num-exact">
          <button className="btn ghost" aria-label="Menos" onClick={() => set({ [q.id]: clamp(val - step) })}>−</button>
          <label className="num-box">
            <DecimalInput
              decimals={step < 1}
              value={val}
              aria-label={q.t}
              onValue={(n) => n !== undefined && set({ [q.id]: n })}
              onBlur={() => set({ [q.id]: clamp(val) })}
            />
            <span className="mute">{q.unit}</span>
          </label>
          <button className="btn ghost" aria-label="Mais" onClick={() => set({ [q.id]: clamp(val + step) })}>+</button>
        </div>
        <input type="range" min={q.min} max={q.max} step={step} value={val} aria-label={`${q.t} (deslizar)`} onChange={(e) => set({ [q.id]: +e.target.value })} />
        {q.hint && <p className="small mute">{q.hint}</p>}
      </>
    );
  } else if (q.kind === 'measures') {
    showNext = true;
    const female = draft.sexo !== 'm';
    const fields: [keyof Answers, string, string][] = [
      ['cintura', 'Cintura', 'À altura do umbigo, sem apertar.'],
      ['pescoco', 'Pescoço', 'Logo abaixo da maçã de Adão.'],
      ...(female ? [['anca', 'Anca', 'Na parte mais larga das nádegas.'] as [keyof Answers, string, string]] : []),
    ];
    body = (
      <>
        <p className="small mute">{q.hint}</p>
        <div className="measures">
          {fields.map(([k, label, how]) => (
            <label key={k} className="measure">
              <span><b>{label}</b><span className="small mute">{how}</span></span>
              <span className="measure-in">
                <DecimalInput
                  placeholder="—"
                  value={draft[k] as number | undefined}
                  aria-label={`${label} em cm`}
                  onValue={(n) => set({ [k]: n } as Partial<Answers>)}
                />
                cm
              </span>
            </label>
          ))}
        </div>
        <button className="link small inline" style={{ marginTop: 12 }} onClick={() => setState({ draft: { ...draft, cintura: undefined, pescoco: undefined, anca: undefined }, qi: qi + 1 })}>
          Não tenho fita métrica, saltar
        </button>
      </>
    );
  } else if (q.kind === 'scale') {
    body = (
      <>
        <div className="scale">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`opt ${v === n ? 'on' : ''}`} onClick={() => set({ [q.id]: n }, true)}>{n}</button>
          ))}
        </div>
        <div className="scale-l"><span>{q.labels[0]}</span><span>{q.labels[1]}</span></div>
      </>
    );
  } else {
    const sel = (v as string[] | undefined) || [];
    if (q.multi) {
      showNext = true;
      canNext = sel.length > 0;
    }
    body = (
      <div className="opts">
        {q.o.map(([k, t]) => {
          const on = q.multi ? sel.includes(k) : v === k;
          return (
            <button
              key={k}
              className={`opt ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => {
                if (!q.multi) return set({ [q.id]: k }, true);
                let a = k === 'nenhuma' ? ['nenhuma'] : sel.filter((x) => x !== 'nenhuma');
                if (k !== 'nenhuma') a = a.includes(k) ? a.filter((x) => x !== k) : [...a, k];
                set({ [q.id]: a });
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <p className="mute small" style={{ margin: 0 }}>Pergunta {qi + 1} de {QUESTIONS.length}</p>
      <div className="prog"><i style={{ width: `${(qi / QUESTIONS.length) * 100}%` }} /></div>
      <h1>{q.t}</h1>
      {qi === 0 && !draft.goal && <p className="mute" style={{ marginTop: -6 }}>Em cerca de 1 minuto: o seu Índice NEFESH e uma dose de Spirulina feita para si, explicada passo a passo.</p>}
      {q.kind === 'options' && q.multi && <p className="mute small">Pode escolher mais do que uma.</p>}
      {body}
      <div className="row" style={{ marginTop: 22 }}>
        {qi ? (
          <button className="btn ghost" onClick={() => setState({ draft, qi: qi - 1 })}>Voltar</button>
        ) : (
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
        )}
        {showNext && (
          <button className="btn" onClick={next} disabled={!canNext}>{last ? 'Ver o meu resultado' : 'Continuar'}</button>
        )}
      </div>
    </>
  );
}
