import { useEffect, useRef, useState } from 'react';
import { proApi, readAssessmentFile, type ProStudent } from '../domain/pro';
import { MEASURES, OBJETIVOS, cleanProfile, type MeasureKey, type StudentProfile } from '../domain/proProfile';
import { useStore } from '../state/store';

const parseNum = (t: string) => (t.trim() && Number.isFinite(Number(t.replace(',', '.'))) ? Number(t.replace(',', '.')) : null);
const showNum = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

/** Campo numérico que aceita vírgula enquanto se escreve (71,5) e se atualiza quando o documento preenche. */
export function NumField({ value, onNum, placeholder, decimal = true }: { value: number | null | undefined; onNum: (v: number | null) => void; placeholder: string; decimal?: boolean }) {
  const [t, setT] = useState(showNum(value));
  useEffect(() => { if (parseNum(t) !== (value ?? null)) setT(showNum(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input className="field sm" inputMode={decimal ? 'decimal' : 'numeric'} value={t} placeholder={placeholder} onChange={(e) => { setT(e.target.value); onNum(parseNum(e.target.value)); }} />;
}

const EMPTY: StudentProfile = { sexo: '', idade: null, altura: null, peso: null, objetivo: '', nivel: '', dias: null, lesoes: '', notas: '' };

/** Perfil detalhado do aluno, registado pelo profissional. */
export function ProfileEditor({ student, onClose, onSaved }: { student: Pick<ProStudent, 'code' | 'name' | 'profile'>; onClose: () => void; onSaved: (p: StudentProfile | null) => void }) {
  const { toast } = useStore();
  const [p, setP] = useState<StudentProfile>(student.profile ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reading, setReading] = useState(false);
  const [readMsg, setReadMsg] = useState('');
  const [showMeasures, setShowMeasures] = useState(() => !!student.profile?.medidas && Object.keys(student.profile.medidas).length > 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const setM = (k: MeasureKey, v: number | null) => setP((cur) => ({ ...cur, medidas: { ...(cur.medidas ?? {}), [k]: v } }));
  /** documento → junta ao perfil só o que veio (não apaga o que já está) */
  const readDoc = async (f: File) => {
    setReading(true);
    setReadMsg('');
    setErr('');
    try {
      const r = await readAssessmentFile(f);
      if (!r.found || !r.profile) { setReadMsg('Não encontrei dados de avaliação física neste documento.'); return; }
      const got = r.profile;
      const next: StudentProfile = { ...p, medidas: { ...(p.medidas ?? {}) } };
      let count = 0;
      for (const k of ['sexo', 'idade', 'altura', 'peso', 'gordura', 'magra', 'fc', 'dataAval'] as const) {
        const v = got[k];
        if (v !== null && v !== '' && v !== undefined) { (next as unknown as Record<string, unknown>)[k] = v; count++; }
      }
      for (const [k, v] of Object.entries(got.medidas ?? {})) if (v !== null && v !== undefined) { next.medidas![k as MeasureKey] = v; count++; }
      setP(next);
      setShowMeasures(true);
      setReadMsg(count ? `Preenchi ${count} ${count === 1 ? 'campo' : 'campos'} a partir do documento. Confira e toque em Guardar perfil.` : 'O documento não tinha medidas legíveis.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const set = (patch: Partial<StudentProfile>) => setP((cur) => ({ ...cur, ...patch }));
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await proApi<{ profile: StudentProfile | null }>('aluno/perfil', { code: student.code, profile: cleanProfile(p) });
      toast(`Perfil de ${student.name} guardado.`);
      onSaved(r.profile);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const chip = (on: boolean, label: string, f: () => void) => <button key={label} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={f}>{label}</button>;
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Alunos</button>
      <h1 style={{ marginBottom: 4 }}>Perfil de {student.name}</h1>
      <p className="small mute" style={{ marginTop: 0 }}>Tudo opcional. A IA usa estes dados para adaptar as sugestões do treino.</p>
      <section className="card pro-upload">
        <p className="small" style={{ margin: '0 0 8px' }}><b>📄 Já tem uma avaliação física?</b> Carregue o PDF ou uma foto (bioimpedância, ficha da academia…) e as medidas são preenchidas sozinhas.</p>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readDoc(f); }} />
        <button className="btn sm" disabled={reading} onClick={() => fileRef.current?.click()}>{reading ? 'A ler o documento…' : 'Carregar avaliação'}</button>
        {readMsg && <p className="small neon" style={{ margin: '8px 0 0' }}>{readMsg}</p>}
        <p className="small mute" style={{ margin: '8px 0 0' }}>O documento não fica guardado: só os números que confirmar.</p>
      </section>
      <section className="card pro-profile">
        <p className="small lbl">Sexo</p>
        <div className="chips">{chip(p.sexo === 'f', 'Mulher', () => set({ sexo: p.sexo === 'f' ? '' : 'f' }))}{chip(p.sexo === 'm', 'Homem', () => set({ sexo: p.sexo === 'm' ? '' : 'm' }))}</div>
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 10 }}>
          <label className="small">Idade<NumField value={p.idade} decimal={false} onNum={(v) => set({ idade: v })} placeholder="anos" /></label>
          <label className="small">Altura<NumField value={p.altura} decimal={false} onNum={(v) => set({ altura: v })} placeholder="cm" /></label>
          <label className="small">Peso<NumField value={p.peso} onNum={(v) => set({ peso: v })} placeholder="kg" /></label>
        </div>
        <button className="link small inline" style={{ marginTop: 12 }} onClick={() => setShowMeasures(!showMeasures)} aria-expanded={showMeasures}>{showMeasures ? '▾' : '▸'} Avaliação física (perímetros, % de gordura…)</button>
        {showMeasures && (
          <>
            <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 8 }}>
              <label className="small">% gordura<NumField value={p.gordura} onNum={(v) => set({ gordura: v })} placeholder="%" /></label>
              <label className="small">Massa magra<NumField value={p.magra} onNum={(v) => set({ magra: v })} placeholder="kg" /></label>
              <label className="small">FC repouso<NumField value={p.fc} decimal={false} onNum={(v) => set({ fc: v })} placeholder="bpm" /></label>
            </div>
            <p className="small lbl" style={{ marginTop: 10 }}>Perímetros (cm)</p>
            <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
              {MEASURES.map(([k, l]) => (
                <label key={k} className="small">{l}<NumField value={p.medidas?.[k]} onNum={(v) => setM(k, v)} placeholder="cm" /></label>
              ))}
            </div>
            <label className="small" style={{ display: 'block', marginTop: 8 }}>Data da avaliação <input className="field sm" type="date" value={p.dataAval ?? ''} onChange={(e) => set({ dataAval: e.target.value })} /></label>
          </>
        )}
        <p className="small lbl">Objetivo</p>
        <div className="chips">{OBJETIVOS.map((o) => chip(p.objetivo === o, o, () => set({ objetivo: p.objetivo === o ? '' : o })))}</div>
        <p className="small lbl">Experiência com treino</p>
        <div className="chips">
          {chip(p.nivel === 'iniciante', 'Iniciante', () => set({ nivel: p.nivel === 'iniciante' ? '' : 'iniciante' }))}
          {chip(p.nivel === 'intermedio', 'Intermédio', () => set({ nivel: p.nivel === 'intermedio' ? '' : 'intermedio' }))}
          {chip(p.nivel === 'avancado', 'Avançado', () => set({ nivel: p.nivel === 'avancado' ? '' : 'avancado' }))}
        </div>
        <p className="small lbl">Dias disponíveis por semana</p>
        <div className="chips">{[1, 2, 3, 4, 5, 6, 7].map((d) => chip(p.dias === d, String(d), () => set({ dias: p.dias === d ? null : d })))}</div>
        <label className="small" style={{ display: 'block', marginTop: 12 }}>Lesões, dores ou limitações
          <textarea className="field" rows={2} maxLength={300} value={p.lesoes} onChange={(e) => set({ lesoes: e.target.value })} placeholder="ex.: dor no joelho direito; hérnia lombar; nenhuma" />
        </label>
        <label className="small" style={{ display: 'block', marginTop: 8 }}>Outras notas
          <textarea className="field" rows={2} maxLength={300} value={p.notas} onChange={(e) => set({ notas: e.target.value })} placeholder="ex.: treina em casa com halteres; prefere manhãs" />
        </label>
      </section>
      <p className="small mute">🔒 Registe só com a autorização do aluno. O perfil fica visível apenas para si.</p>
      <button className="btn full" disabled={busy} onClick={save}>{busy ? 'A guardar…' : 'Guardar perfil'}</button>
      {err && <p className="small warn-t">{err}</p>}
    </>
  );
}
