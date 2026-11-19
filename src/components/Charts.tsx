import { useLayoutEffect, useRef, useState } from 'react';
import { AREAS } from '../domain/content';
import type { Scores } from '../domain/types';

/** Radar de cinco eixos do Índice NEFESH, com a avaliação anterior a tracejado. */
export function Radar({ sc, prev }: { sc: Scores; prev?: Scores | null }) {
  const cx = 180, cy = 140, R = 92;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / AREAS.length;
    return [cx + (Math.cos(a) * R * v) / 100, cy + (Math.sin(a) * R * v) / 100];
  };
  const poly = (f: (i: number) => number) => AREAS.map((_, i) => pt(i, f(i)).join(',')).join(' ');
  return (
    <svg className="radar" viewBox="-24 0 408 290" role="img" aria-label="Radar do Índice NEFESH">
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} points={poly(() => r)} fill="none" stroke={`rgba(255,255,255,${r === 100 ? 0.18 : 0.08})`} />
      ))}
      {AREAS.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,.08)" />;
      })}
      {prev && <polygon points={poly((i) => prev[AREAS[i][0]])} fill="none" stroke="#C9A85C" strokeWidth={1.5} strokeDasharray="4 4" />}
      <polygon points={poly((i) => sc[AREAS[i][0]])} fill="rgba(0,254,138,.18)" stroke="#00FE8A" strokeWidth={2} strokeLinejoin="round" />
      {AREAS.map(([k, t], i) => {
        const [x, y] = pt(i, sc[k]);
        const [lx, ly] = pt(i, 128);
        const anc = Math.abs(lx - cx) < 8 ? 'middle' : lx < cx ? 'end' : 'start';
        return (
          <g key={k}>
            <circle cx={x} cy={y} r={3.5} fill="#00FE8A" />
            <text x={lx} y={ly + (i === 0 ? -2 : 5)} textAnchor={anc} fill="#eef3f0" fontSize={13} fontWeight={600}>{t}</text>
            <text x={lx} y={ly + (i === 0 ? 14 : 21)} textAnchor={anc} fill="#97a69f" fontSize={12}>{sc[k]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export interface Series {
  color: string;
  values: (number | undefined)[];
}

/** Gráfico de linhas 1–5, que se adapta à largura do contentor. */
export function LineChart({ series, days }: { series: Series[]; days: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 320, h: 220 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 320, h: el.clientHeight || 220 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w: W, h: H } = size;
  const pl = 22, pr = 8, pt = 10, pb = 22;
  const x = (i: number) => pl + ((W - pl - pr) * i) / (days - 1);
  const y = (v: number) => pt + ((H - pt - pb) * (5 - v)) / 4;
  return (
    <div className="fig">
      <svg ref={ref} role="img" aria-label="Gráfico de energia, sono e disposição">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="#23302a" />
            <text x={4} y={y(v) + 4} fill="#97a69f" fontSize={11}>{v}</text>
          </g>
        ))}
        <text x={x(0)} y={H - 4} fill="#97a69f" fontSize={11}>há {days} dias</text>
        <text x={x(days - 1)} y={H - 4} fill="#97a69f" fontSize={11} textAnchor="end">hoje</text>
        {series.map(({ color, values }) => {
          let d = '';
          const dots: JSX.Element[] = [];
          values.forEach((v, i) => {
            if (!v) return;
            d += (d ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
            if (days <= 14) dots.push(<circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill={color} />);
          });
          return (
            <g key={color}>
              <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
              {dots}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Colunas diárias (água, passos) relativas a uma meta. */
export function Columns({ values, goal, variant, label }: { values: number[]; goal: number; variant?: 'steps'; label: (v: number) => string }) {
  return (
    <>
      <div className="cols">
        {values.map((v, i) => (
          <i key={i} className={[variant, v >= goal ? 'full' : ''].filter(Boolean).join(' ')} style={{ height: `${Math.min(100, (v / goal) * 100)}%` }} title={label(v)} />
        ))}
      </div>
      <div className="cols-l">
        <span>há {values.length} dias</span>
        <span>hoje</span>
      </div>
    </>
  );
}

export function Ring({ value, goal, label }: { value: number; goal: number; label: string }) {
  const p = Math.min(1, value / goal), R = 44, C = 2 * Math.PI * R;
  return (
    <svg className="r" viewBox="0 0 104 104" role="img" aria-label={`${value} ${label}`}>
      <circle cx={52} cy={52} r={R} stroke="rgba(255,255,255,.1)" strokeWidth={9} fill="none" />
      <circle cx={52} cy={52} r={R} stroke="#C9A85C" strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 52 52)" />
      <text x={52} y={52} textAnchor="middle" fill="#eef3f0" fontFamily="Sora" fontWeight={700} fontSize={19}>{value.toLocaleString('pt-PT')}</text>
      <text x={52} y={69} textAnchor="middle" fill="#97a69f" fontSize={11}>{label}</text>
    </svg>
  );
}

export function Glass({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 32">
      <path d="M4 3h16l-2 25.5a1.5 1.5 0 0 1-1.5 1.4h-9A1.5 1.5 0 0 1 6 28.5z" fill={on ? 'url(#wg)' : 'none'} stroke={on ? '#5ec8f2' : '#3a4a44'} strokeWidth={1.6} />
      {on && <path d="M7 9h10" stroke="rgba(255,255,255,.5)" strokeWidth={1.4} strokeLinecap="round" />}
    </svg>
  );
}

export function Bar({ pct, variant }: { pct: number; variant?: 'low' | 'water' }) {
  return (
    <div className={`bar ${variant ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
