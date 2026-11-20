import { useState } from 'react';
import { SHOP_URL } from '../domain/content';
import { couponSeen, refresh, useSocial, type PrizeCoupon, type PrizeState } from '../domain/social';
import { shortDate } from '../domain/dates';
import { useStore } from '../state/store';

const fmt = (d: string) => d.split('-').reverse().join('/');

function CopyCode({ code }: { code: string }) {
  const { toast } = useStore();
  return (
    <button
      className="coupon-code"
      onClick={() => navigator.clipboard?.writeText(code).then(() => toast('Código copiado.'), () => toast(code))}
      aria-label={`Copiar o código ${code}`}
    >
      {code} <span className="small">copiar</span>
    </button>
  );
}

/** Ranking semanal global com o prémio NEFESH15 (separador Liga). */
export function PrizeRanking({ p }: { p: PrizeState }) {
  const [rules, setRules] = useState(false);
  const me = p.me;
  return (
    <section className="card prize-card">
      <div className="row">
        <h2 style={{ margin: 0 }}>🏆 Ranking da semana</h2>
        <span className="small mute">fecha domingo</span>
      </div>
      <p className="small" style={{ margin: '4px 0 10px' }}>
        Toda a comunidade NEFESH. Os {p.winners} primeiros ganham um cupão de <b>{p.percent}%</b> na loja online.
      </p>
      {!p.top.length && <p className="small mute">Ainda sem pontos esta semana.</p>}
      <ol className="rank">
        {p.top.map((m) => (
          <li key={m.rank} className={`${m.me ? 'me' : ''} ${m.eligible && m.rank <= p.winners ? 'up' : ''}`}>
            <b className="pos">{m.rank}</b>
            <span className="face" style={{ width: 36, height: 36, fontSize: 15 }}>{m.avatar ? <img src={m.avatar} alt="" /> : m.nick.trim()[0]?.toUpperCase()}</span>
            <span className="who">{m.nick}{m.me ? ' (eu)' : ''}{!m.eligible && <small>ainda sem as condições do prémio</small>}</span>
            <b>{m.points}</b>
          </li>
        ))}
      </ol>
      <div className="prize-me">
        <p className="small" style={{ margin: 0 }}>
          {me.rank ? <>Está em <b>{me.rank}.º</b> com <b>{me.points}</b> pontos{me.prizeRank && me.prizeRank <= p.winners ? ' — em lugar de prémio! 🎉' : ''}.</> : 'Ainda não tem pontos esta semana.'}
        </p>
        <ul className="prize-check small">
          <li className={me.daysIn >= p.rules.minDays ? 'ok' : ''}>{me.daysIn >= p.rules.minDays ? '✓' : '○'} {p.rules.minDays} dias na comunidade ({Math.min(me.daysIn, p.rules.minDays)}/{p.rules.minDays})</li>
          <li className={me.checkins >= p.rules.minCheckins ? 'ok' : ''}>{me.checkins >= p.rules.minCheckins ? '✓' : '○'} Check-in em {p.rules.minCheckins} dos 7 dias ({me.checkins}/{p.rules.minCheckins})</li>
        </ul>
        {me.reasons.filter((r) => /cupão|revisão/.test(r)).map((r) => <p key={r} className="small mute" style={{ margin: '4px 0 0' }}>{r[0].toUpperCase() + r.slice(1)}.</p>)}
      </div>
      <button className="link small inline" onClick={() => setRules(!rules)}>{rules ? 'Fechar as regras' : 'Como funciona o prémio?'}</button>
      {rules && (
        <ul className="small mute" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Conta a consistência: Spirulina, check-in, água, movimento e desafios, com um máximo de pontos por dia.</li>
          <li>Pode ganhar quem está há {p.rules.minDays} dias ou mais na comunidade e fez check-in em pelo menos {p.rules.minCheckins} dos 7 dias.</li>
          <li>Desempate: mais dias com check-in; depois, quem chegou primeiro à pontuação.</li>
          <li>O ranking fecha ao domingo. Na segunda-feira de manhã, os {p.winners} primeiros recebem um código único de {p.percent}%, de uso único, válido {p.rules.validDays} dias, na app e por e-mail.</li>
          <li>No máximo 1 cupão a cada {p.rules.cooldownWeeks} semanas, para dar oportunidade a mais pessoas.</li>
        </ul>
      )}
    </section>
  );
}

function CouponCard({ c, percent }: { c: PrizeCoupon; percent: number }) {
  return (
    <div className={`coupon ${c.expired || c.status === 'usado' ? 'off' : ''}`}>
      <p className="small" style={{ margin: 0 }}>🏆 {c.rank}.º lugar · semana de {shortDate(c.week)}</p>
      <p style={{ margin: '4px 0', font: '600 18px Sora' }}>{percent}% de desconto na loja NEFESH</p>
      <CopyCode code={c.code} />
      <p className="small mute" style={{ margin: '6px 0 0' }}>
        {c.status === 'usado' ? 'Já usado.' : c.expired ? `Expirou a ${fmt(c.expires)}.` : `Uso único · válido até ${fmt(c.expires)} · não acumulável com outras promoções.`}
      </p>
      {!c.expired && c.status !== 'usado' && <a className="btn sm" style={{ marginTop: 8 }} href={SHOP_URL} target="_blank" rel="noopener">Usar no site</a>}
    </div>
  );
}

/** Celebração quando ganhou um cupão (até ser visto). */
export function PrizeWin({ p }: { p: PrizeState }) {
  const c = p.coupons.find((x) => !x.seen && !x.expired);
  if (!c) return null;
  return (
    <section className="card hero prize-win">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Parabéns! 🎉</p>
      <h2 style={{ margin: '4px 0 6px' }}>Ficou em {c.rank}.º lugar no ranking da semana</h2>
      <p className="small" style={{ margin: '0 0 10px' }}>A sua consistência valeu um cupão de {p.percent}% na loja NEFESH. Vai recebê-lo também por e-mail. Fica guardado no Perfil, em "Os meus benefícios".</p>
      <CouponCard c={c} percent={p.percent} />
      <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={async () => { await couponSeen().catch(() => undefined); refresh(); }}>Guardar nos benefícios</button>
    </section>
  );
}

/** Perfil → Os meus benefícios. */
export function Benefits() {
  const { S } = useStore();
  const { state } = useSocial(120_000);
  const p = state?.prize;
  if (!S.community || !p) return null;
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Os meus benefícios</h2>
      {!p.coupons.length ? (
        <p className="small mute" style={{ margin: 0 }}>Fique entre os {p.winners} primeiros do ranking da semana e ganhe um cupão de {p.percent}% na loja NEFESH. Veja como em Comunidade → Liga.</p>
      ) : (
        <div className="coupons">{p.coupons.map((c) => <CouponCard key={c.code} c={c} percent={p.percent} />)}</div>
      )}
    </section>
  );
}
