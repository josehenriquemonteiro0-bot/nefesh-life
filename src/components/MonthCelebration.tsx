import { appUrl } from '../domain/platform';
import { useState } from 'react';
import { daysSince, fmtNum } from '../domain/dates';
import { indexTrend } from '../domain/liveIndex';
import { drawShareCard, shareImage } from '../domain/shareCard';
import { monthSummary } from '../domain/stats';
import { useStore } from '../state/store';

/** O marco dos 30 dias: deve aparecer uma vez, a partir do 30.º dia. */
export const showMonth = (S: ReturnType<typeof useStore>['S']) => !!S.ans && !S.sample && !!S.planStart && daysSince(S.planStart) + 1 >= 30 && !S.month30Seen;

/** Ecrã de celebração do primeiro mês, com o resumo e a partilha (WhatsApp, Instagram). */
export function MonthCelebration() {
  const { S, update } = useStore();
  const [busy, setBusy] = useState(false);
  const m = monthSummary(S);
  const t = indexTrend(S);
  const close = () => update((d) => { d.month30Seen = true; });
  const share = async () => {
    setBusy(true);
    try {
      // a imagem não leva dados de saúde: só o ritual
      const blob = await drawShareCard({
        title: '30 dias de ritual',
        subtitle: 'NEFESH Life · Spirulina',
        progress: { done: m.spirulina, total: 30 },
        stats: [
          ['dias de Spirulina', String(m.spirulina)],
          ['melhor sequência', `${m.best} ${m.best === 1 ? 'dia' : 'dias'}`],
          ['dias com a meta de água', String(m.water)],
        ],
        nick: S.ans?.name ?? '',
        link: appUrl(),
      });
      await shareImage(blob, `Fiz 30 dias de ritual com a Spirulina NEFESH 🌿 ${m.spirulina} ${m.spirulina === 1 ? 'dia' : 'dias'} de Spirulina e uma sequência de ${m.best} ${m.best === 1 ? 'dia' : 'dias'}.`, 'nefesh-30-dias.png');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="breath-overlay month" role="dialog" aria-label="30 dias de ritual">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🎉 Parabéns{S.ans?.name ? `, ${S.ans.name}` : ''}!</p>
      <h1 style={{ margin: 0, textAlign: 'center' }}>30 dias de ritual</h1>
      <div className="month-grid">
        <div><b>{m.spirulina}</b><span>dias de Spirulina</span></div>
        <div><b>{m.best}</b><span>melhor sequência</span></div>
        <div><b>{m.water}</b><span>dias com a meta de água</span></div>
        <div><b>{m.checkins}</b><span>check-ins</span></div>
        <div><b>{m.minutes}</b><span>minutos de atividade</span></div>
        <div><b>{t.from !== null && t.from !== t.now ? `${t.from} → ${t.now}` : t.now}</b><span>Índice NEFESH</span></div>
      </div>
      {m.energyFirst !== null && m.energyLast !== null && (
        <p className="small" style={{ margin: 0, textAlign: 'center' }}>Energia média: {fmtNum(m.energyFirst)} na primeira semana → <b>{fmtNum(m.energyLast)}</b> na última.</p>
      )}
      <button className="btn" disabled={busy} onClick={share}>{busy ? 'A preparar…' : 'Partilhar o meu mês'}</button>
      <button className="link small inline" onClick={close}>Continuar</button>
      <p className="small" style={{ margin: 0, opacity: 0.7, textAlign: 'center' }}>A imagem mostra só o ritual (sem dados de saúde).</p>
    </div>
  );
}
