import { useEffect, useRef } from 'react';
import { QUESTIONS } from '../domain/content';
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
    const val = (v as number) ?? q.def;
    body = (
      <>
        <div className="num"><output>{val}</output><span className="mute">{q.unit}</span></div>
        <input type="range" min={q.min} max={q.max} value={val} aria-label={q.t} onChange={(e) => set({ [q.id]: +e.target.value })} />
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
