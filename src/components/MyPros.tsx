import { useState } from 'react';
import type { Nav, Tab } from '../App';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { applyProPlan, codeLooksValid, normCode, proApi, syncNutriShare, syncShare } from '../domain/pro';
import { syncWellShare } from '../domain/proWell';
import { todayKey } from '../domain/dates';
import type { AppState } from '../domain/types';
import { isNutriKind } from '../domain/proNutriClient';
import { useStore } from '../state/store';
import { ChatThread } from './ProChat';

type Area = 'nutri' | 'well' | 'personal';
type Opt = 'body' | 'labs' | 'sleep';
const SHARE: Record<Area, { key: 'nutriShare' | 'wellShare' | 'proShare'; sync: (S: AppState, on: boolean) => Promise<void>; opts: Opt[]; what: string }> = {
  nutri: { key: 'nutriShare', sync: syncNutriShare, opts: ['body', 'labs', 'sleep'], what: 'adesão ao plano e alterações, calorias e proteína, água, fome, jejum, sono, energia, stress, treino e peso' },
  well: { key: 'wellShare', sync: syncWellShare, opts: ['sleep', 'labs'], what: 'sono, energia, stress, água, treino, passos e peso' },
  personal: { key: 'proShare', sync: syncShare, opts: ['body'], what: 'energia, sono, stress, passos, água, alimentação (calorias e proteína), treino, peso e dias de Spirulina' },
};
const OPT_LABEL: Record<Opt, [string, string]> = {
  body: ['As medidas e avaliações do corpo', '% de gordura, massa magra, perímetros'],
  labs: ['As análises clínicas', 'as que registou em Cuidados'],
  sleep: ['O diário do sono', 'só números: horários, tempo até adormecer, despertares, qualidade'],
};

/** Partilha com um profissional: ligar/desligar e o que vai, num só sítio. */
function ShareBox({ area, pro }: { area: Area; pro: string }) {
  const { S, update, toast } = useStore();
  const cfg = SHARE[area];
  const cur = (S[cfg.key] ?? { on: false }) as { on: boolean; at?: string } & Partial<Record<Opt, boolean>>;
  const [busy, setBusy] = useState(false);
  const set = async (patch: Partial<typeof cur>, msg: string) => {
    const next = { ...cur, ...patch };
    setBusy(true);
    try {
      await cfg.sync({ ...S, [cfg.key]: next } as AppState, next.on);
      update((d) => { (d as unknown as Record<string, unknown>)[cfg.key] = next.on ? { ...next, at: todayKey() } : { on: false }; });
      toast(msg);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="pro-share" style={{ marginTop: 8 }}>
      <label className="check"><input type="checkbox" disabled={busy} checked={!!cur.on} onChange={(e) => set({ on: e.target.checked }, e.target.checked ? `${pro} passa a ver o seu resumo.` : `Deixou de partilhar. ${pro} já não vê o resumo.`)} />
        <span className="small"><b>Partilhar os meus dados com {pro}</b><br /><span className="mute">Últimos 14 dias, só números: {cfg.what}. Nunca o diário escrito, notas, ciclo ou medicação. Atualiza uma vez por dia. Pode desligar quando quiser e o que estava partilhado é apagado.</span></span>
      </label>
      {cur.on && cfg.opts.map((o) => (
        <label key={o} className="check" style={{ marginTop: 8 }}><input type="checkbox" disabled={busy} checked={!!cur[o]} onChange={(e) => set({ [o]: e.target.checked }, e.target.checked ? `Passa a ir no resumo: ${OPT_LABEL[o][0].toLowerCase()}.` : `Deixa de ir no resumo: ${OPT_LABEL[o][0].toLowerCase()}.`)} />
          <span className="small"><b>Incluir {OPT_LABEL[o][0].toLowerCase()}</b> <span className="mute">({OPT_LABEL[o][1]})</span></span></label>
      ))}
    </div>
  );
}

/**
 * Os meus profissionais (em Cuidados): um só sítio para o código de qualquer profissional da NEFESH
 * (personal, nutricionista, médico ou terapeuta de práticas integrativas). A app reconhece a área
 * pelo código e liga-o ao lugar certo; aqui ficam todos, com a conversa e o atalho para o plano.
 */
export function MyProsCard({ go }: { go: Nav }) {
  const { S, update, toast } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [chat, setChat] = useState<{ code: string; pro: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [shareOf, setShareOf] = useState<string | null>(null);

  const links: { code: string; pro: string; area: string; plan: string; tab: Tab; has: boolean; kind: Area; sharing: boolean }[] = [];
  if (S.nutriLink) links.push({ ...S.nutriLink, area: 'Nutricionista ou médico(a)', plan: 'Plano alimentar', tab: 'nutri', has: !!S.nutriPlan, kind: 'nutri', sharing: !!S.nutriShare?.on });
  if (S.wellLink) links.push({ ...S.wellLink, area: 'Práticas integrativas', plan: 'Plano de bem-estar', tab: 'mente', has: !!S.wellPlan, kind: 'well', sharing: !!S.wellShare?.on });
  if (S.proLink) links.push({ ...S.proLink, area: 'Personal', plan: 'Treino', tab: 'treino', has: !!S.trainPlan, kind: 'personal', sharing: !!S.proShare?.on });

  const use = async () => {
    setErr('');
    if (!codeLooksValid(code)) return setErr('O código tem este formato: NP-XXXX-XXXX.');
    setBusy(true);
    try {
      const r = await proApi<{ code: string; pro: string; kind?: string; plan: ParsedWorkoutPlan | null; version: number }>('aluno/ligar', { code: normCode(code) });
      update((d) => applyProPlan(d, r));
      const where = isNutriKind(r.kind) ? 'o plano alimentar fica em Saúde → Nutrição' : r.kind === 'integrativo' ? 'o plano de bem-estar fica em Saúde → Mente' : 'o treino fica em Saúde → Treino';
      toast(`Ligado a ${r.pro}: ${where}.`);
      setCode('');
      setAdding(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Os meus profissionais</h2>
      {links.length === 0 && <p className="small mute" style={{ marginTop: 0 }}>O seu médico, nutricionista, terapeuta ou personal acompanha-o pelo NEFESH Life Pro e envia-lhe um código. Escreva-o aqui: a app reconhece a área e põe o plano no sítio certo. Depois pode partilhar com ele os seus dados (sono, energia, análises…), só se quiser.</p>}
      {links.map((l) => (
        <div key={l.code} className="pro-ask" style={{ marginTop: 8 }}>
          <p className="small" style={{ margin: 0 }}><b data-raw>{l.pro}</b> · <span className="mute">{l.area}</span></p>
          <p className="small mute" style={{ margin: '2px 0 6px' }}>{l.has ? `${l.plan} na app.` : `${l.plan} ainda não enviado: aparece sozinho.`}</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => go(l.tab)}>Abrir {l.plan.toLowerCase()}</button>
            <button className="btn ghost sm" onClick={() => setChat({ code: l.code, pro: l.pro })}>💬 Conversa</button>
            <button className="btn ghost sm" onClick={() => setShareOf(shareOf === l.code ? null : l.code)} aria-expanded={shareOf === l.code}>🔒 Partilhar dados</button>
          </div>
          <p className="small" style={{ margin: '6px 0 0' }}>{l.sharing ? <span className="neon">✓ {l.pro} vê o seu resumo</span> : <span className="mute">Não partilha os seus dados com {l.pro}.</span>}</p>
          {shareOf === l.code && <ShareBox area={l.kind} pro={l.pro} />}
        </div>
      ))}
      {chat && <ChatThread code={chat.code} me="aluno" other={chat.pro} asSheet onClose={() => setChat(null)} />}
      {links.length > 0 && !adding ? (
        <button className="link small inline" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ Usar o código de outro profissional</button>
      ) : (
        <>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap', marginTop: 10 }}>
            <input className="field sm" style={{ flex: 1, textTransform: 'uppercase' }} placeholder="NP-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do profissional" autoCapitalize="characters" />
            <button className="btn sm" disabled={busy || !code.trim()} onClick={use}>{busy ? 'A ligar…' : 'Usar'}</button>
          </div>
          {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
        </>
      )}
    </section>
  );
}
