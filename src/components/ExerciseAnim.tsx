import { useEffect, useState } from 'react';
import { ANIMS, complete, type Joint, type Pose } from '../domain/exerciseAnims';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Segmentos do corpo: [de, para, membro afastado?] */
const SEGMENTS: [Joint, Joint, boolean][] = [
  ['hip', 'kF', true], ['kF', 'aF', true],
  ['neck', 'eF', true], ['eF', 'hF', true],
  ['hip', 'kN', false], ['kN', 'aN', false],
  ['neck', 'eN', false], ['eN', 'hN', false],
];

function Anim2({ attr, a, b, dur }: { attr: string; a: number; b: number; dur: number }) {
  if (a === b) return null;
  return <animate attributeName={attr} values={`${a};${b};${a}`} keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur={`${dur}s`} repeatCount="indefinite" />;
}

function Line({ p, q, a, b, dur, far }: { p: Joint; q: Joint; a: Pose; b: Pose; dur: number; far: boolean }) {
  const [x1, y1] = a[p]!;
  const [x2, y2] = a[q]!;
  const [bx1, by1] = b[p]!;
  const [bx2, by2] = b[q]!;
  const still = reduceMotion();
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} className={far ? 'fig far' : 'fig'}>
      {!still && (
        <>
          <Anim2 attr="x1" a={x1} b={bx1} dur={dur} />
          <Anim2 attr="y1" a={y1} b={by1} dur={dur} />
          <Anim2 attr="x2" a={x2} b={bx2} dur={dur} />
          <Anim2 attr="y2" a={y2} b={by2} dur={dur} />
        </>
      )}
    </line>
  );
}

/** Figura animada de um exercício (vetorial, sem vídeo, funciona sem internet). */
export function ExerciseAnim({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' }) {
  const anim = ANIMS[id];
  if (!anim) return null;
  const a = complete(anim.a);
  const b = complete(anim.b);
  const dur = anim.dur;
  const still = reduceMotion();
  // tronco: pescoço → (meio das costas) → anca
  const spine: Joint[] = a.mid ? ['neck', 'mid', 'hip'] : ['neck', 'hip'];
  return (
    <figure className={`exanim ${size}`}>
      <svg viewBox="0 0 120 100" role="img" aria-label={`Animação: ${anim.cue}`}>
        <line x1="4" y1="93" x2="116" y2="93" className="ground" />
        {anim.props?.includes('mat') && <rect x="10" y="91.5" width="100" height="3" rx="1.5" className="mat" />}
        {anim.props?.includes('door') && <path d="M70 92 V6 H96 V92" className="door" />}
        {SEGMENTS.map(([p, q, far]) => <Line key={p + q} p={p} q={q} a={a} b={b} dur={dur} far={far} />)}
        {spine.slice(1).map((q, i) => <Line key={`s${q}`} p={spine[i]} q={q} a={a} b={b} dur={dur} far={false} />)}
        <circle cx={a.head![0]} cy={a.head![1]} r="7" className="head">
          {!still && (
            <>
              <Anim2 attr="cx" a={a.head![0]} b={b.head![0]} dur={dur} />
              <Anim2 attr="cy" a={a.head![1]} b={b.head![1]} dur={dur} />
            </>
          )}
        </circle>
        {anim.props?.includes('bag') && (
          <rect x={a.hN![0] - 5} y={a.hN![1]} width="10" height="9" rx="2" className="bag">
            {!still && (
              <>
                <Anim2 attr="x" a={a.hN![0] - 5} b={b.hN![0] - 5} dur={dur} />
                <Anim2 attr="y" a={a.hN![1]} b={b.hN![1]} dur={dur} />
              </>
            )}
          </rect>
        )}
      </svg>
      {size === 'md' && <figcaption className="small mute">{anim.cue}</figcaption>}
    </figure>
  );
}

/** Rotina de vários movimentos (mobilidade, alongamento): um bonequinho de cada vez, avança sozinho. */
export function RoutineAnim({ steps }: { steps: { anim: string; label: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduceMotion()) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % steps.length), 6000);
    return () => window.clearTimeout(t);
  }, [i, steps.length]);
  const s = steps[i];
  return (
    <div className="routine">
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <button className="btn ghost sm" aria-label="Movimento anterior" onClick={() => setI((i - 1 + steps.length) % steps.length)}>‹</button>
        <p className="small" style={{ margin: 0, flex: 1, textAlign: 'center' }}><b>{i + 1} de {steps.length}</b> · {s.label}</p>
        <button className="btn ghost sm" aria-label="Movimento seguinte" onClick={() => setI((i + 1) % steps.length)}>›</button>
      </div>
      <ExerciseAnim key={s.anim + i} id={s.anim} />
      <div className="plan-dots" style={{ justifyContent: 'center' }}>{steps.map((_, k) => <i key={k} className={k === i ? 'now' : k < i ? 'done' : ''} />)}</div>
    </div>
  );
}
