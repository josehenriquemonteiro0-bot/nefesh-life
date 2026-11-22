import { useState } from 'react';
import { bodyEvolution, bodySeries, lastAssessment } from '../domain/bodyLog';
import { fmtNum, shortDate } from '../domain/dates';
import type { AppState } from '../domain/types';

const sign = (v: number) => `${v > 0 ? '+' : ''}${fmtNum(v)}`;
const withUnit = (v: number, u: string) => `${fmtNum(v)}${u === '%' ? '%' : u ? ` ${u}` : ''}`;

/** Peso, composição corporal, perímetros e outros dados das avaliações: primeira medição → mais recente. */
export function BodyEvolution({ S, print = false }: { S: AppState; print?: boolean }) {
  const [all, setAll] = useState(false);
  const series = bodySeries(S);
  const rows = bodyEvolution(series);
  if (!rows.length || (rows.length === 1 && rows[0].diff === null && !lastAssessment(series))) return null;
  const last = lastAssessment(series);
  const source = last ? `Última avaliação: ${shortDate(last.date)}${last.por ? ` (${last.por})` : last.fonte === 'relatorio' ? ' (relatório anexado)' : ''}.` : '';
  const shown = print || all ? rows : rows.slice(0, 8);
  const table = (
    <table className={print ? 'pr-table' : 'cmp'}>
      <thead><tr><th /><th>início</th><th>agora</th><th>diferença</th></tr></thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.key}>
            <td>{r.label}</td>
            <td>{r.diff === null ? '—' : <>{withUnit(r.first, r.unit)}<br /><span className={print ? '' : 'small mute'}>{shortDate(r.firstDate)}</span></>}</td>
            <td><b>{withUnit(r.last, r.unit)}</b><br /><span className={print ? '' : 'small mute'}>{shortDate(r.lastDate)}</span></td>
            <td className={!print && r.diff ? (r.diff > 0 ? 'up' : 'down') : ''}>{r.diff === null ? '—' : r.diff === 0 ? '=' : sign(r.diff)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (print)
    return (
      <section>
        <h3>Corpo: medidas e avaliações</h3>
        {table}
        {source && <p className="pr-small">{source}</p>}
      </section>
    );
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Corpo: medidas e avaliações</h2>
      {source && <p className="small mute" style={{ marginTop: 0 }}>{source}</p>}
      {table}
      {rows.length > 8 && <button className="link small inline" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? 'Mostrar menos' : `Ver todas as medidas (${rows.length})`}</button>}
    </section>
  );
}
