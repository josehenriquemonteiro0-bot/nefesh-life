import { useState } from 'react';
import { proApi, type ProStudent } from '../domain/pro';
import { OBJETIVOS, cleanProfile, type StudentProfile } from '../domain/proProfile';
import { useStore } from '../state/store';

const EMPTY: StudentProfile = { sexo: '', idade: null, altura: null, peso: null, objetivo: '', nivel: '', dias: null, lesoes: '', notas: '' };

/** Perfil detalhado do aluno, registado pelo profissional. */
export function ProfileEditor({ student, onClose, onSaved }: { student: Pick<ProStudent, 'code' | 'name' | 'profile'>; onClose: () => void; onSaved: (p: StudentProfile | null) => void }) {
  const { toast } = useStore();
  const [p, setP] = useState<StudentProfile>(student.profile ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<StudentProfile>) => setP({ ...p, ...patch });
  const n = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);
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
      <section className="card pro-profile">
        <p className="small lbl">Sexo</p>
        <div className="chips">{chip(p.sexo === 'f', 'Mulher', () => set({ sexo: p.sexo === 'f' ? '' : 'f' }))}{chip(p.sexo === 'm', 'Homem', () => set({ sexo: p.sexo === 'm' ? '' : 'm' }))}</div>
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 10 }}>
          <label className="small">Idade<input className="field sm" inputMode="numeric" value={p.idade ?? ''} onChange={(e) => set({ idade: n(e.target.value) })} placeholder="anos" /></label>
          <label className="small">Altura<input className="field sm" inputMode="numeric" value={p.altura ?? ''} onChange={(e) => set({ altura: n(e.target.value) })} placeholder="cm" /></label>
          <label className="small">Peso<input className="field sm" inputMode="decimal" value={p.peso ?? ''} onChange={(e) => set({ peso: n(e.target.value) })} placeholder="kg" /></label>
        </div>
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
