import { useRef, useState } from 'react';
import { organizeIntegNotes, proApi, readExamFile, type IntegOrganized, type ProStudent } from '../domain/pro';
import { INTEG, INTEG_GROUPS, INTEG_KEYS, examOut, integText, type Exam, type IntegKey } from '../domain/proInteg';
import { cleanProfile, type StudentProfile } from '../domain/proProfile';
import { useStore } from '../state/store';
import { useLongDictation } from './ProAI';
import { NumField } from './ProProfile';

const EMPTY: StudentProfile = { sexo: '', idade: null, altura: null, peso: null, objetivo: '', nivel: '', dias: null, lesoes: '', notas: '' };
const joinText = (x: string, t: string) => `${x}${x && !/\s$/.test(x) ? ' ' : ''}${t.trim()}`;
const dmy = (d: string) => (d ? d.split('-').reverse().join('/') : 'sem data');
const FLAG = { alto: '↑ acima', baixo: '↓ abaixo', normal: '', '': '' } as const;

/** Exames de um paciente: uma tabela por exame, com os valores fora da referência em destaque. */
function ExamCard({ e, onRemove }: { e: Exam; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const out = e.items.filter((i) => i.flag === 'alto' || i.flag === 'baixo');
  const shown = all ? e.items : out;
  return (
    <div className="pro-exam">
      <button className="link small inline" onClick={() => setOpen(!open)} aria-expanded={open} style={{ textAlign: 'left' }}>
        {open ? '▾' : '▸'} <b>{e.title || 'Exame'}</b> · {dmy(e.date)}{e.lab ? ` · ${e.lab}` : ''} · {e.items.length} {e.items.length === 1 ? 'valor' : 'valores'}{out.length ? <span className="warn-t"> · {out.length} fora da referência</span> : ''}
      </button>
      {open && (
        <>
          {e.note && <p className="small" style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>📝 <b>Conclusão do laudo:</b> {e.note}</p>}
          {e.items.length > 0 && (
            <>
              <div className="chips" style={{ margin: '6px 0' }}>
                <button className={`chip sm ${!all ? 'on' : ''}`} aria-pressed={!all} onClick={() => setAll(false)}>Fora da referência ({out.length})</button>
                <button className={`chip sm ${all ? 'on' : ''}`} aria-pressed={all} onClick={() => setAll(true)}>Todos ({e.items.length})</button>
              </div>
              {shown.length === 0 && <p className="small mute" style={{ margin: '4px 0' }}>Nenhum valor fora da referência do laboratório.</p>}
              <table className="pro-exam-t">
                <tbody>
                  {shown.map((i, k) => (
                    <tr key={k} className={i.flag === 'alto' || i.flag === 'baixo' ? 'out' : ''}>
                      <td data-raw>{i.name}</td>
                      <td data-raw><b>{i.value}</b>{i.unit ? ` ${i.unit}` : ''}{FLAG[i.flag] ? <span className="warn-t"> {FLAG[i.flag]}</span> : null}</td>
                      <td className="mute" data-raw>{i.ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <button className="link small inline" style={{ marginTop: 6 }} onClick={() => confirm('Tirar este exame da ficha?') && onRemove()}>Tirar da ficha</button>
        </>
      )}
    </div>
  );
}

/**
 * Ficha do paciente para terapias integrativas: anamnese integrativa (não a de um personal nem a de um
 * nutricionista), exames lidos pela IA e notas da consulta organizadas pela IA nos campos certos.
 */
export function IntegProfileEditor({ student, onClose, onSaved }: { student: Pick<ProStudent, 'code' | 'name' | 'profile'>; onClose: () => void; onSaved: (p: StudentProfile | null) => void }) {
  const { toast } = useStore();
  const [p, setP] = useState<StudentProfile>(student.profile ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<StudentProfile>) => setP((cur) => ({ ...cur, ...patch }));
  const setI = (k: IntegKey, v: string) => setP((cur) => ({ ...cur, integ: { ...(cur.integ ?? {}), [k]: v } }));
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(INTEG_GROUPS.map(([g]) => [g, g === 'motivo' || g === 'saude' || INTEG.some(([k, gg]) => gg === g && student.profile?.integ?.[k])])));

  // notas da consulta → IA → campos
  const [notes, setNotes] = useState('');
  const [org, setOrg] = useState<(IntegOrganized & { filled: IntegKey[]; before: StudentProfile }) | null>(null);
  const [orgBusy, setOrgBusy] = useState(false);
  const [orgErr, setOrgErr] = useState('');
  const mic = useLongDictation((t) => setNotes((x) => joinText(x, t).slice(0, 8000)), (m) => setOrgErr(m));
  const organize = async () => {
    setOrgBusy(true); setOrgErr('');
    try {
      const r = await organizeIntegNotes({ text: notes, integ: p.integ ?? {}, sexo: p.sexo, idade: p.idade, exams: examOut(p.exames).map((i) => `${i.name} ${i.value} ${i.unit} (${i.flag})`).join('; ') });
      const filled = INTEG_KEYS.filter((k) => r.integ[k] && r.integ[k] !== p.integ?.[k]);
      const before = p;
      setP((cur) => ({ ...cur, sexo: cur.sexo || r.sexo, idade: cur.idade ?? r.idade, integ: { ...(cur.integ ?? {}), ...Object.fromEntries(filled.map((k) => [k, r.integ[k]])) } }));
      setOpen((o) => ({ ...o, ...Object.fromEntries(INTEG.filter(([k]) => filled.includes(k)).map(([, g]) => [g, true])) }));
      setOrg({ ...r, filled, before });
      if (filled.length) setNotes('');
      else setOrgErr('Não encontrei nas notas nada novo para a ficha.');
    } catch (e) { setOrgErr((e as Error).message); } finally { setOrgBusy(false); }
  };

  // exames
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [examMsg, setExamMsg] = useState('');
  const readExam = async (f: File) => {
    setReading(true); setExamMsg(''); setErr('');
    try {
      const r = await readExamFile(f);
      if (!r.found || !r.exam) { setExamMsg('Não encontrei resultados de exames neste documento.'); return; }
      const e = r.exam;
      setP((cur) => ({ ...cur, exames: [e, ...(cur.exames ?? []).filter((x) => x.id !== e.id)].sort((a, b) => (b.date || '0000').localeCompare(a.date || '0000')).slice(0, 12) }));
      const out = e.items.filter((i) => i.flag === 'alto' || i.flag === 'baixo').length;
      setExamMsg(`Li ${e.items.length} ${e.items.length === 1 ? 'valor' : 'valores'}${e.note ? ' e a conclusão do laudo' : ''}${out ? `, ${out} fora da referência do laboratório` : ''}. Confira com o documento e toque em Guardar ficha.`);
    } catch (er) { setErr((er as Error).message); } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await proApi<{ profile: StudentProfile | null }>('aluno/perfil', { code: student.code, profile: cleanProfile(p) });
      toast(`Ficha de ${student.name} guardada.`);
      onSaved(r.profile);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const chip = (on: boolean, label: string, f: () => void) => <button key={label} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={f}>{label}</button>;
  const hasText = (g: string) => INTEG.filter(([, gg]) => gg === g).filter(([k]) => p.integ?.[k]?.trim()).length;

  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Pacientes</button>
      <h1 style={{ marginBottom: 4 }}>Ficha de {student.name}</h1>
      <p className="small mute" style={{ marginTop: 0 }}>Anamnese integrativa. Tudo opcional: preencha à mão, dite a consulta ou carregue os exames.</p>

      <section className="card pro-ai">
        <p className="small" style={{ margin: '0 0 8px' }}><b>🎙️ Conte a consulta</b> · fale ou cole as suas notas, em qualquer ordem. A IA põe cada informação no campo certo, avisa dos sinais que pedem médico e diz o que falta perguntar.</p>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
          <button className={`pro-mic ${mic.on ? 'on' : ''}`} onClick={mic.on ? mic.stop : () => { setOrgErr(''); mic.start(); }} disabled={orgBusy || mic.transcribing} aria-label={mic.on ? 'Parar de ouvir' : 'Ditar as notas da consulta'}>{mic.on ? '■' : '🎙️'}</button>
          <span className="small">{mic.on ? <>A ouvir… <b>{mic.clock}</b> · toque em ■ quando acabar</> : mic.transcribing ? 'A passar a texto…' : orgBusy ? 'A organizar na ficha…' : 'Toque para falar (até 2 min de cada vez).'}</span>
        </div>
        {mic.on && mic.partial && <p className="small mute" style={{ margin: '8px 0 0' }}>“{mic.partial}”</p>}
        <textarea className="field" rows={4} maxLength={8000} style={{ marginTop: 10 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex.: Paula, 42 anos, cansada há 6 meses, acorda às 3h, intestino preso, toma levotiroxina e começou hipericão (erva-de-são-joão) por conta própria, quarto com bolor…" aria-label="Notas da consulta" />
        <button className="btn sm" style={{ marginTop: 8 }} disabled={orgBusy || notes.trim().length < 3} onClick={organize}>{orgBusy ? 'A organizar…' : 'Organizar na ficha'}</button>
        {orgErr && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{orgErr}</p>}
        {org && (
          <div className="pro-ask" style={{ marginTop: 10 }}>
            {org.filled.length > 0 && <p className="small neon" style={{ margin: 0 }}>✓ Preenchi {org.filled.length} {org.filled.length === 1 ? 'campo' : 'campos'}: {org.filled.map((k) => INTEG.find((x) => x[0] === k)![2].split(',')[0].toLowerCase()).join(', ')}. Confira abaixo.</p>}
            {org.alerts.length > 0 && (
              <>
                <p className="small warn-t" style={{ margin: '8px 0 2px' }}><b>⚠️ Atenção</b></p>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{org.alerts.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </>
            )}
            {org.ask.length > 0 && (
              <>
                <p className="small" style={{ margin: '8px 0 2px' }}><b>❓ Ainda falta perguntar</b></p>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{org.ask.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </>
            )}
            {org.filled.length > 0 && <button className="link small inline" style={{ marginTop: 6 }} onClick={() => { setP(org.before); setOrg(null); }}>Desfazer</button>}
          </div>
        )}
      </section>

      <section className="card pro-upload">
        <p className="small" style={{ margin: '0 0 8px' }}><b>🧪 Exames do paciente</b> · PDF ou foto: análises de sangue, painel hormonal, vitaminas e minerais, mineralograma, fezes e urina, laudos de imagem. A IA transcreve os valores e marca os que estão fora da referência do próprio laboratório.</p>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readExam(f); }} />
        <button className="btn sm" disabled={reading} onClick={() => fileRef.current?.click()}>{reading ? 'A ler o exame…' : '+ Carregar exame'}</button>
        {examMsg && <p className="small neon" style={{ margin: '8px 0 0' }}>{examMsg}</p>}
        {(p.exames ?? []).map((e) => <ExamCard key={e.id} e={e} onRemove={() => set({ exames: (p.exames ?? []).filter((x) => x.id !== e.id) })} />)}
        <p className="small mute" style={{ margin: '8px 0 0' }}>O documento não fica guardado: só os valores. A leitura dos exames e o diagnóstico são do médico; aqui servem para acompanhar a evolução.</p>
      </section>

      <section className="card pro-profile">
        <p className="small lbl">Sexo</p>
        <div className="chips">{chip(p.sexo === 'f', 'Mulher', () => set({ sexo: p.sexo === 'f' ? '' : 'f' }))}{chip(p.sexo === 'm', 'Homem', () => set({ sexo: p.sexo === 'm' ? '' : 'm' }))}</div>
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 10 }}>
          <label className="small">Idade<NumField value={p.idade} decimal={false} onNum={(v) => set({ idade: v })} placeholder="anos" /></label>
          <label className="small">Altura<NumField value={p.altura} decimal={false} onNum={(v) => set({ altura: v })} placeholder="cm" /></label>
          <label className="small">Peso<NumField value={p.peso} onNum={(v) => set({ peso: v })} placeholder="kg" /></label>
        </div>
        {INTEG_GROUPS.map(([g, title]) => (
          <div key={g} style={{ marginTop: 14 }}>
            <button className="link small inline" onClick={() => setOpen({ ...open, [g]: !open[g] })} aria-expanded={!!open[g]}><b>{open[g] ? '▾' : '▸'} {title}</b>{!open[g] && hasText(g) ? <span className="mute"> · {hasText(g)} preenchido{hasText(g) === 1 ? '' : 's'}</span> : null}</button>
            {open[g] && INTEG.filter(([, gg]) => gg === g).map(([k, , l, ph]) => (
              <label key={k} className="small" style={{ display: 'block', marginTop: 6 }}>{l}
                <textarea className="field" rows={Math.min(8, Math.max(2, Math.ceil((p.integ?.[k]?.length ?? 0) / 30) + 1))} maxLength={600} value={p.integ?.[k] ?? ''} onChange={(e) => setI(k, e.target.value)} placeholder={ph} />
              </label>
            ))}
          </div>
        ))}
      </section>
      <p className="small mute">🔒 Registe só com a autorização do paciente. São dados de saúde: a ficha fica visível apenas para si.</p>
      <button className="btn full" disabled={busy} onClick={save}>{busy ? 'A guardar…' : 'Guardar ficha'}</button>
      {err && <p className="small warn-t">{err}</p>}
    </>
  );
}

/** Resumo da ficha no montador do plano de bem-estar (para ter à vista o que importa). */
export function IntegBrief({ profile }: { profile: StudentProfile | null | undefined }) {
  const [open, setOpen] = useState(false);
  const t = integText(profile);
  if (!t) return null;
  const out = examOut(profile?.exames);
  return (
    <section className="card">
      <button className="link small inline" onClick={() => setOpen(!open)} aria-expanded={open}><b>{open ? '▾' : '▸'} Da ficha</b>{profile?.integ?.queixa ? <span className="mute"> · {profile.integ.queixa.slice(0, 70)}{profile.integ.queixa.length > 70 ? '…' : ''}</span> : null}{out.length ? <span className="warn-t"> · {out.length} {out.length === 1 ? 'valor' : 'valores'} de exames fora da referência</span> : null}</button>
      {open && <p className="small" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{t}</p>}
    </section>
  );
}
