import { useEffect, useState } from 'react';
import { answerLater, askAccount, nextLaterQuestion, noteLaterShown, skipLater } from '../domain/onboarding';
import { getAuth } from '../domain/account';
import { todayKey } from '../domain/dates';
import type { Answers } from '../domain/types';
import { useStore } from '../state/store';
import { DecimalInput } from './DecimalInput';

/**
 * Pergunta do dia (a partir do 2.º dia): uma das perguntas que saíram da avaliação inicial,
 * na altura certa. Uma resposta = um toque; pode pedir mais uma (até 3 por dia) ou adiar.
 */
export function LaterQuestionCard() {
  const { S, update, toast } = useStore();
  const [m, setM] = useState<Partial<Answers>>({});
  const nx = nextLaterQuestion(S);
  // regista a pergunta de hoje: se ficar sem resposta, amanhã passa para a seguinte
  useEffect(() => {
    if (nx) update((d) => noteLaterShown(d, nx.id));
  }, [nx?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!nx) return null;
  const { q } = nx;
  const save = (patch: Partial<Answers>) => {
    update((d) => answerLater(d, patch));
    setM({});
    toast(nx.left > 1 ? 'Obrigado! O seu plano ficou mais preciso.' : 'Perfil completo. O seu Índice deixa de ser provisório. 🌿');
  };
  let body: JSX.Element | null = null;
  if (q.kind === 'options')
    body = (
      <div className="chips">
        {q.o.map(([k, t]) => <button key={k} className="chip" onClick={() => save({ [q.id]: k } as Partial<Answers>)}>{t}</button>)}
      </div>
    );
  else if (q.kind === 'scale')
    body = (
      <>
        <div className="scale">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} className="opt" onClick={() => save({ [q.id]: n } as Partial<Answers>)}>{n}</button>)}
        </div>
        <div className="scale-l"><span>{q.labels[0]}</span><span>{q.labels[1]}</span></div>
      </>
    );
  else if (q.kind === 'measures') {
    const fields: [keyof Answers, string][] = [['cintura', 'Cintura'], ['pescoco', 'Pescoço'], ...(S.ans?.sexo !== 'm' ? [['anca', 'Anca'] as [keyof Answers, string]] : [])];
    body = (
      <>
        <p className="small mute" style={{ margin: '0 0 8px' }}>{q.hint}</p>
        <div className="measures">
          {fields.map(([k, label]) => (
            <label key={k} className="measure">
              <span><b>{label}</b></span>
              <span className="measure-in"><DecimalInput placeholder="—" value={m[k] as number | undefined} aria-label={`${label} em cm`} onValue={(n) => setM({ ...m, [k]: n })} />cm</span>
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
          <button className="btn sm" disabled={!m.cintura} onClick={() => save(m)}>Guardar</button>
          <button className="link small inline" onClick={() => save({ medidasSaltadas: true })}>Não tenho fita métrica</button>
        </div>
      </>
    );
  }
  return (
    <div className="today-part later-q">
      <div className="row">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>💬 Pergunta do dia</p>
        <span className="small mute">{nx.left === 1 ? 'falta 1' : `faltam ${nx.left}`}</span>
      </div>
      <h3 style={{ margin: '6px 0 10px' }}>{q.t}</h3>
      {body}
      <button className="link small inline" style={{ marginTop: 8 }} onClick={() => update((d) => skipLater(d, q.id))}>Agora não</button>
    </div>
  );
}

/** Pedido de conta a partir do 3.º dia, com um motivo concreto. */
export function AccountAskCard({ openSignup, streak }: { openSignup: () => void; streak: number }) {
  const { S, update } = useStore();
  if (!askAccount(S, !!getAuth())) return null;
  return (
    <div className="today-part">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🔒 {streak >= 2 ? `Proteja a sua sequência de ${streak} dias` : 'Proteja o seu plano'}</p>
      <p className="small mute" style={{ margin: '4px 0 8px' }}>Com uma conta, não perde nada se trocar ou perder o telemóvel. Demora 30 segundos.</p>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
        <button className="btn sm" onClick={openSignup}>Criar conta</button>
        <button className="link small inline" onClick={() => update((d) => { d.accountAsk = todayKey(); })}>Agora não</button>
      </div>
    </div>
  );
}
