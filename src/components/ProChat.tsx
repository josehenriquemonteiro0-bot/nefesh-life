import { useEffect, useRef, useState } from 'react';
import { proApi } from '../domain/pro';

export interface ChatMsg { id: number; from: 'pro' | 'aluno'; text: string; ref: string; at: string }

const hhmm = (iso: string) => new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Conversa personal ↔ aluno. `me` é quem está a escrever; as mensagens podem referir um treino
 * (ex.: "Treino A · 22/11"). Atualiza sozinha enquanto está aberta.
 */
export function ChatThread({ code, me, other, initialRef = '', onClose, asSheet = false }: { code: string; me: 'pro' | 'aluno'; other: string; initialRef?: string; onClose: () => void; asSheet?: boolean }) {
  const [list, setList] = useState<ChatMsg[] | null>(null);
  const [text, setText] = useState('');
  const [ref, setRef] = useState(initialRef);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const readPath = me === 'pro' ? 'aluno/mensagens' : 'aluno/conversa';
  const writePath = me === 'pro' ? 'aluno/mensagem' : 'aluno/escrever';
  useEffect(() => {
    let on = true;
    const load = () => proApi<{ messages: ChatMsg[] }>(readPath, { code }).then((r) => on && setList(r.messages)).catch((e) => on && setErr((e as Error).message));
    load();
    const id = window.setInterval(load, 20000);
    return () => { on = false; window.clearInterval(id); };
  }, [code, readPath]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [list?.length]);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const r = await proApi<{ messages: ChatMsg[] }>(writePath, { code, text, ref });
      setList(r.messages);
      setText('');
      setRef('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const body = (
    <>
      <div className="row">
        <h2 style={{ margin: 0 }}>💬 {other}</h2>
        <button className="btn ghost sm" onClick={onClose}>{asSheet ? 'Fechar' : '← Voltar'}</button>
      </div>
      <div className="chat-list" aria-live="polite">
        {!list && !err && <p className="small mute">A carregar…</p>}
        {list && !list.length && <p className="small mute">{me === 'pro' ? `Ainda sem mensagens. Escreva a ${other} sobre o treino.` : `Escreva a ${other} sobre o treino: dúvidas, dores, como correu.`}</p>}
        {list?.map((m) => (
          <div key={m.id} className={`chat-msg ${m.from === me ? 'mine' : ''}`}>
            {m.ref && <span className="chat-ref">↪ {m.ref}</span>}
            <span>{m.text}</span>
            <span className="chat-at">{hhmm(m.at)}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      {ref && <p className="small chat-ref" style={{ margin: '8px 0 0' }}>↪ Sobre: {ref} <button className="link small inline" onClick={() => setRef('')}>tirar</button></p>}
      <div className="row chat-input" style={{ gap: 8, flexWrap: 'nowrap', marginTop: 8 }}>
        <textarea className="field" rows={2} style={{ flex: 1 }} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem…" aria-label="Mensagem" />
        <button className="btn sm" disabled={busy || !text.trim()} onClick={send}>{busy ? '…' : 'Enviar'}</button>
      </div>
      {err && <p className="small warn-t">{err}</p>}
      <p className="small mute" style={{ margin: '6px 0 0' }}>{me === 'pro' ? 'O aluno recebe um aviso no telemóvel (se tiver as notificações ativas).' : `${other} recebe um aviso no telemóvel. Em caso de dor forte, pare o treino e procure um médico.`}</p>
    </>
  );
  if (asSheet)
    return (
      <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="sheet" role="dialog" aria-modal="true" aria-label={`Conversa com ${other}`}>{body}</div>
      </div>
    );
  return body;
}
