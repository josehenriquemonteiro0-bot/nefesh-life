import { useState } from 'react';
import { applyProposal, matchFriends, proposalText } from '../domain/assistant';
import type { CoachMsg } from '../domain/coach';
import { patternsOf, recentNotes } from '../domain/patterns';
import { CHALLENGES, LEVELS, createChallenge, refresh, useSocial } from '../domain/social';
import { shortDate } from '../domain/dates';
import { useStore } from '../state/store';

/** "O que sei sobre si": padrões (esconder), factos (apagar, acrescentar) e relatos recentes. */
export function MemoryPanel() {
  const { S, update, toast } = useStore();
  const [fact, setFact] = useState('');
  const patterns = patternsOf(S);
  const facts = S.memory?.facts ?? [];
  const notes = recentNotes(S, 21);
  const hidden = S.memory?.hidden ?? [];
  return (
    <section className="card memory-panel">
      <h2 style={{ marginTop: 0 }}>🧠 O que sei sobre si</h2>
      <p className="small mute" style={{ marginTop: 0 }}>Calculado neste telemóvel a partir dos seus registos, mais o que me pediu para lembrar. Uso isto para as minhas sugestões. Pode esconder ou apagar o que quiser.</p>
      {patterns.length === 0 && facts.length === 0 && <p className="small mute">Ainda estou a conhecê-lo: com 3 ou 4 semanas de registos começo a ver padrões (dias em que falha o treino, sono ao fim de semana, o que mais come…).</p>}
      {patterns.map((p) => (
        <div key={p.id} className="mem-row">
          <span className="small">📈 {p.text}</span>
          <button className="link small inline" onClick={() => update((d) => { d.memory = { ...(d.memory ?? {}), hidden: [...(d.memory?.hidden ?? []), p.id] }; })}>esconder</button>
        </div>
      ))}
      {facts.map((f) => (
        <div key={f.id} className="mem-row">
          <span className="small">📌 {f.text}</span>
          <button className="link small inline" onClick={() => update((d) => { d.memory = { ...(d.memory ?? {}), facts: (d.memory?.facts ?? []).filter((x) => x.id !== f.id) }; })}>apagar</button>
        </div>
      ))}
      <form
        className="row"
        style={{ gap: 8, marginTop: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          const t = fact.trim();
          if (!t) return;
          update((d) => { d.memory = { ...(d.memory ?? {}), facts: [...(d.memory?.facts ?? []), { id: `${Date.now().toString(36)}`, text: t, at: new Date().toISOString() }].slice(-30) }; });
          setFact('');
          toast('Vou lembrar-me.');
        }}
      >
        <input className="field sm" value={fact} onChange={(e) => setFact(e.target.value)} placeholder="Algo que devo saber (ex.: trabalho por turnos)" maxLength={120} aria-label="Algo que devo saber" />
        <button className="btn ghost sm" disabled={!fact.trim()}>Juntar</button>
      </form>
      {notes.length > 0 && (
        <details className="small" style={{ marginTop: 10 }}>
          <summary>Relatos guardados ({notes.length})</summary>
          {notes.map((n) => (
            <div key={`${n.day}-${n.idx}`} className="mem-row">
              <span>{shortDate(n.day)}: {n.text}</span>
              <button className="link small inline" onClick={() => update((d) => { const l = d.logs[n.day]; if (l?.notes) l.notes = l.notes.filter((_, j) => j !== n.idx); })}>apagar</button>
            </div>
          ))}
        </details>
      )}
      {hidden.length > 0 && <button className="link small inline" style={{ marginTop: 8 }} onClick={() => update((d) => { d.memory = { ...(d.memory ?? {}), hidden: [] }; })}>Mostrar os padrões escondidos ({hidden.length})</button>}
    </section>
  );
}

/** Cartão de confirmação: lembretes, consultas ou desafio, preparados pelo assistente. */
export function ProposalCard({ m, onDone }: { m: CoachMsg; onDone: (s: 'feito' | 'cancelado') => void }) {
  const { S, update, toast } = useStore();
  const { state } = useSocial(120_000);
  const friends = state?.friends ?? [];
  const items = m.proposals ?? [];
  const ch = items.find((a) => a.type === 'desafio');
  const [pick, setPick] = useState<string[]>(() => (ch ? matchFriends(ch.friends ?? [], friends) : []));
  const [busy, setBusy] = useState(false);
  if (m.proposalStatus === 'feito')
    return (
      <div style={{ margin: '8px 0 0' }}>
        {(m.proposals ?? []).map((a, k) => (
          <p key={k} className="small neon" style={{ margin: '2px 0 0' }}>✓ {a.type === 'desafio' ? `🏅 ${CHALLENGES[a.challenge!]?.title ?? 'Desafio'} criado` : proposalText(a)}</p>
        ))}
      </div>
    );
  if (m.proposalStatus === 'cancelado') return <p className="small mute" style={{ margin: '8px 0 0' }}>Cancelado.</p>;
  const isReset = ch?.challenge === 'reset21';
  const confirm = async () => {
    setBusy(true);
    try {
      const simple = items.filter((a) => a.type !== 'desafio');
      if (simple.length) update((d) => { for (const a of simple) applyProposal(d, a); });
      if (ch) {
        await createChallenge(isReset ? `reset21:21:${ch.level ?? 'firme'}` : `${ch.challenge}:${ch.value}:${ch.level ?? 'firme'}`, isReset ? [] : pick);
        refresh();
      }
      toast(ch ? 'Desafio criado! Os amigos já o veem na Comunidade.' : simple.some((a) => a.type === 'lembrete') ? 'Combinado: vou lembrá-lo à hora certa.' : 'Guardado.');
      onDone('feito');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="proposal">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Preparei isto. Confirma?</p>
      {items.filter((a) => a.type !== 'desafio').map((a, k) => <p key={k} className="small" style={{ margin: '6px 0 0' }}>{proposalText(a)}</p>)}
      {ch && (
        <>
          <p className="small" style={{ margin: '6px 0 0' }}>
            🏅 {CHALLENGES[ch.challenge!]?.title ?? 'Desafio'}{isReset ? '' : ` · ${ch.value} dias`} · nível {LEVELS.find(([k]) => k === (ch.level ?? 'firme'))?.[1].toLowerCase()}
          </p>
          {!isReset && (
            !S.community ? (
              <p className="small mute" style={{ margin: '6px 0 0' }}>Entre na Comunidade para criar desafios com amigos.</p>
            ) : !friends.length ? (
              <p className="small mute" style={{ margin: '6px 0 0' }}>Ainda não tem amigos na app: convide-os em Comunidade → Amigos.</p>
            ) : (
              <div style={{ marginTop: 6 }}>
                {friends.map((f) => (
                  <label className="check" key={f.id}>
                    <input type="checkbox" checked={pick.includes(f.id)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, f.id] : p.filter((x) => x !== f.id)))} />
                    <span className="small">{f.nick}</span>
                  </label>
                ))}
              </div>
            )
          )}
        </>
      )}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
        <button className="btn sm" disabled={busy || (!!ch && !isReset && (!S.community || !pick.length))} onClick={confirm}>{busy ? 'A guardar…' : ch ? 'Criar e convidar' : 'Confirmar'}</button>
        <button className="btn ghost sm" onClick={() => onDone('cancelado')}>Cancelar</button>
      </div>
    </div>
  );
}
