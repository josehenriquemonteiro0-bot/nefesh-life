import { useState } from 'react';
import type { PrizeState } from '../domain/social';

/**
 * Ranking semanal global (separador Liga): só interação entre a comunidade e os amigos.
 * Não anuncia prémios nem cupões (decisão da NEFESH, 24/11/2026). Ofertas da loja, quando houver,
 * seguem por e-mail, à parte do ranking.
 */
export function PrizeRanking({ p }: { p: PrizeState }) {
  const [rules, setRules] = useState(false);
  const me = p.me;
  return (
    <section className="card prize-card">
      <div className="row">
        <h2 style={{ margin: 0 }}>🏆 Ranking da semana</h2>
        <span className="small mute">fecha domingo</span>
      </div>
      <p className="small" style={{ margin: '4px 0 10px' }}>Toda a comunidade NEFESH, a puxar uns pelos outros nos hábitos de cada dia.</p>
      {!p.top.length && <p className="small mute">Ainda sem pontos esta semana.</p>}
      <ol className="rank">
        {p.top.map((m) => (
          <li key={m.rank} className={m.me ? 'me' : ''}>
            <b className="pos">{m.rank}</b>
            <span className="face" style={{ width: 36, height: 36, fontSize: 15 }}>{m.avatar ? <img src={m.avatar} alt="" /> : m.nick.trim()[0]?.toUpperCase()}</span>
            <span className="who">{m.nick}{m.me ? ' (eu)' : ''}</span>
            <b>{m.points}</b>
          </li>
        ))}
      </ol>
      <div className="prize-me">
        <p className="small" style={{ margin: 0 }}>
          {me.rank ? <>Está em <b>{me.rank}.º</b> com <b>{me.points}</b> pontos.</> : 'Ainda não tem pontos esta semana.'}
        </p>
      </div>
      <button className="link small inline" onClick={() => setRules(!rules)}>{rules ? 'Fechar' : 'Como contam os pontos?'}</button>
      {rules && (
        <ul className="small mute" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Conta a consistência nos hábitos: check-in, água, refeições, treino, passos e sono, com um máximo de pontos por dia.</li>
          <li>Desempate: mais dias com check-in; depois, quem chegou primeiro à pontuação.</li>
          <li>O ranking recomeça todas as segundas-feiras. Participar é gratuito.</li>
          <li>A Apple não é patrocinadora nem participa deste ranking.</li>
        </ul>
      )}
    </section>
  );
}
