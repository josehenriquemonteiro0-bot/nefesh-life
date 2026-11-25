import { useState } from 'react';
import { INTAKE_Q, INTEG, INTEG_GROUPS } from '../domain/proInteg';
import { intakeDraft, sendIntake, sendSymptoms, type IntakeAnswers } from '../domain/proWell';
import { useStore } from '../state/store';

const EMPTY: IntakeAnswers = { sexo: '', idade: null, integ: {} };

/**
 * Pré-anamnese: o paciente responde em casa, com calma, antes da consulta. O terapeuta recebe-a
 * no NEFESH Life Pro e junta-a à ficha, e a consulta fica para o que importa.
 */
export function IntakeForm({ code, pro, sentAt, onSent, onClose }: { code: string; pro: string; sentAt: string | null; onSent: (at: string) => void; onClose: () => void }) {
  const { toast } = useStore();
  const [a, setA] = useState<IntakeAnswers>(() => intakeDraft(code) ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ motivo: true, saude: true });
  const answered = Object.values(a.integ).filter((v) => v?.trim()).length;
  const send = async () => {
    setBusy(true); setErr('');
    try {
      const r = await sendIntake(code, a);
      toast(`Ficha enviada a ${pro}. 🌿`);
      onSent(r.at);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const chip = (on: boolean, label: string, f: () => void) => <button key={label} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={f}>{label}</button>;
  return (
    <div className="pro-share">
      <p className="small" style={{ margin: '0 0 6px' }}><b>📝 Ficha de saúde para {pro}</b></p>
      <p className="small mute" style={{ margin: '0 0 8px' }}>Responda com calma, com as suas palavras. Tudo é opcional: o que não souber, deixe em branco. Pode usar o 🎤 do teclado para ditar.{sentAt ? ` Já enviou a ${new Date(sentAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}: pode corrigir e reenviar.` : ''}</p>
      <div className="chips">{chip(a.sexo === 'f', 'Mulher', () => setA({ ...a, sexo: a.sexo === 'f' ? '' : 'f' }))}{chip(a.sexo === 'm', 'Homem', () => setA({ ...a, sexo: a.sexo === 'm' ? '' : 'm' }))}</div>
      <label className="small" style={{ display: 'block', marginTop: 8 }}>Idade
        <input className="field sm" inputMode="numeric" style={{ width: 90, marginLeft: 8 }} value={a.idade ?? ''} onChange={(e) => { const n = parseInt(e.target.value, 10); setA({ ...a, idade: Number.isFinite(n) ? n : null }); }} />
      </label>
      {INTEG_GROUPS.filter(([g]) => g !== 'terapeuta').map(([g, title]) => (
        <div key={g} style={{ marginTop: 12 }}>
          <button className="link small inline" onClick={() => setOpen({ ...open, [g]: !open[g] })} aria-expanded={!!open[g]}><b>{open[g] ? '▾' : '▸'} {title}</b></button>
          {open[g] && INTEG.filter(([k, gg]) => gg === g && k !== 'observacoes').map(([k]) => (
            <label key={k} className="small" style={{ display: 'block', marginTop: 6 }}>{INTAKE_Q[k as keyof typeof INTAKE_Q]}
              <textarea className="field" rows={2} maxLength={600} value={a.integ[k] ?? ''} onChange={(e) => setA({ ...a, integ: { ...a.integ, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
      ))}
      <p className="small mute" style={{ margin: '10px 0 0' }}>🔒 Só {pro} vê estas respostas. São dados de saúde: envie só se quiser.</p>
      {err && <p className="small warn-t" style={{ margin: '6px 0 0' }}>{err}</p>}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
        <button className="btn sm" disabled={busy || answered === 0} onClick={send}>{busy ? 'A enviar…' : `Enviar a ${pro}`}</button>
        <button className="btn ghost sm" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

/** Uma vez por semana: como estiveram os sintomas que o terapeuta quer acompanhar (0 = nada, 10 = muito forte). */
export function SymptomCheck({ track, pro, onDone }: { track: string[]; pro: string; onDone: () => void }) {
  const { S, toast } = useStore();
  const [v, setV] = useState<(number | null)[]>(() => track.map(() => null));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setBusy(true); setErr('');
    try { await sendSymptoms(S, v, note); toast(`Enviado a ${pro}. Obrigado! 🌿`); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="pro-share">
      <p className="small" style={{ margin: '0 0 2px' }}><b>📊 Como estiveram estes sintomas nesta semana?</b></p>
      <p className="small mute" style={{ margin: '0 0 8px' }}>0 = nada · 10 = muito forte. {pro} vê a evolução de semana para semana.</p>
      {track.map((t, i) => (
        <div key={t} style={{ margin: '8px 0' }}>
          <div className="row"><span className="small" data-raw>{t}</span><b className="small">{v[i] ?? '–'}</b></div>
          <div className="sym-scale" role="radiogroup" aria-label={t}>
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} role="radio" aria-checked={v[i] === n} className={v[i] === n ? 'on' : ''} onClick={() => setV(v.map((x, j) => (j === i ? (x === n ? null : n) : x)))}>{n}</button>
            ))}
          </div>
        </div>
      ))}
      <input className="field sm" style={{ width: '100%', boxSizing: 'border-box' }} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quer dizer alguma coisa? (opcional)" aria-label="Nota para o terapeuta" />
      {err && <p className="small warn-t" style={{ margin: '6px 0 0' }}>{err}</p>}
      <button className="btn sm" style={{ marginTop: 8 }} disabled={busy || v.every((x) => x === null)} onClick={send}>{busy ? 'A enviar…' : 'Enviar'}</button>
    </div>
  );
}
