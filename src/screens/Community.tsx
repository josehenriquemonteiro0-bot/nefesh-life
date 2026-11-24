import { useEffect, useMemo, useState } from 'react';
import { Bar } from '../components/Charts';
import { useAuth } from '../domain/account';
import { todayKey } from '../domain/dates';
import { HABIT_POINTS, activityStreak, dayScore, levelOf, totalPoints, weekPayload, weekTotal, type Flag } from '../domain/points';
import {
  CHALLENGES, CIRCLE_KINDS, DURATIONS, LEVELS, REACTIONS, REPLIES, acceptInvite, acceptPartner, circleOf, clearInvite, inviteUrl, pendingInvite, resetInviteText, createTeam, endPartner, feedText, invitePartner, joinTeam, leaveTeam, react, replyTo, LEAGUES, LEAGUE_COLORS, MESSAGES, addFriend, createChallenge, evolutionRanking, inviteText, join, leaveChallenge,
  blockPerson, leaveCommunity, markSeen, refresh, removeFriend, unblockPerson, resultSeen, sendMessage, suggestFor, unreadCount, useSocial, type CircleKind, type Member, type SocialState,
} from '../domain/social';
import { pushPoints } from '../state/socialSync';
import { SpirulinaCheck } from '../components/SpirulinaCheck';
import { Moments } from '../components/Moments';
import { HealthShotButton } from '../components/HealthShot';
import { useStore } from '../state/store';
import { whatsappShare } from '../domain/content';
import { drawShareCard, shareImage } from '../domain/shareCard';
import { PrizeRanking } from '../components/Prize';

type View = 'mural' | 'liga' | 'equipa' | 'amigos' | 'desafios';

const FLAG_ICON: Record<string, string> = { s: '🌿', a: '💧', c: '📝', m: '🍽️', t: '💪', p: '👟', n: '😴' };

function Face({ nick, avatar, size = 36 }: { nick: string; avatar?: string | null; size?: number }) {
  return (
    <span className="face" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {avatar ? <img src={avatar} alt="" /> : nick.trim()[0]?.toUpperCase()}
    </span>
  );
}

/** Ecrã de entrada: alcunha, foto e escolha de aparecer no ranking de evolução. */
function Join({ onJoined }: { onJoined: () => void }) {
  const { S, update, toast } = useStore();
  const [nick, setNick] = useState(S.ans?.name?.split(' ')[0] ?? '');
  const [evo, setEvo] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <h1>Comunidade NEFESH</h1>
      <p className="mute">Ganhe pontos com os seus hábitos, suba de liga todas as semanas e incentive os seus amigos.</p>
      {pendingInvite() && (
        <section className="card due">
          <p className="small" style={{ margin: 0 }}>💌 Recebeu um convite{pendingInvite()?.cid ? ' para o NEFESH 21 Day Reset' : ''}. Entre na comunidade e fica logo ligado a quem o convidou.</p>
        </section>
      )}
      <section className="card" data-tour="comunidade">
        <div className="row" style={{ justifyContent: 'flex-start', gap: 12 }}>
          <Face nick={nick || '?'} avatar={S.avatar} size={52} />
          <label className="afield" style={{ flex: 1 }}>
            <span>Alcunha (é o que os outros veem)</span>
            <input value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} placeholder="ex.: Zé" />
          </label>
        </div>
        {!S.avatar && <p className="small mute">Pode pôr uma foto no Perfil.</p>}
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={evo} onChange={(e) => setEvo(e.target.checked)} />
          <span className="small">Mostrar a evolução do meu Índice NEFESH no ranking de evolução (ex.: de 60 para 80).</span>
        </label>
        <p className="small mute" style={{ margin: '10px 0 0' }}>
          Participa nas ligas semanais com todas as pessoas da NEFESH Life. Os outros só veem a alcunha, a foto, os pontos, a sequência e o nível. Os amigos veem também que hábitos cumpriu hoje. Peso, medidas e restantes dados de saúde nunca são partilhados.
        </p>
        <button
          className="btn full"
          style={{ marginTop: 14 }}
          disabled={busy || nick.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            try {
              await join(nick.trim(), S.avatar, evo);
              update((d) => { d.community = { nick: nick.trim(), since: todayKey() }; });
              await pushPoints({ ...S, community: { nick: nick.trim(), since: todayKey() } }, true);
              await refresh();
              toast('Bem-vindo à comunidade!');
              onJoined();
            } catch (e) {
              toast((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Entrar na comunidade
        </button>
      </section>
    </>
  );
}

/** Pontos de hoje, por hábito. */
function TodayPoints({ st }: { st: SocialState }) {
  const { S } = useStore();
  const d = dayScore(S, todayKey());
  const [open, setOpen] = useState(false);
  const v = st.verify;
  const official = v ? v.points : d.points;
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Hoje: {official} pontos</h2>
        <button className="link small inline" onClick={() => setOpen((x) => !x)}>{open ? 'fechar' : 'como ganho pontos?'}</button>
      </div>
      {v && (
        <p className="small mute" style={{ margin: '4px 0 0' }}>
          ✅ {v.verified} verificados · ☑️ {v.declared} declarados (máximo 50)
        </p>
      )}
      {v?.review && <p className="small key-warn">A sua conta está em verificação pela equipa NEFESH. Enquanto isso, os seus pontos não aparecem no ranking dos outros.</p>}
      {d.halved && <p className="small key-warn">🌿 Ainda sem Spirulina hoje: os outros hábitos estão a valer metade. Tome a sua dose para os pontos contarem por inteiro.</p>}
      <div className="flags">
        {HABIT_POINTS.map((h) => {
          const got = d.parts[h.flag as Flag];
          return (
            <span key={h.flag} className={`flag ${got >= h.full ? 'on' : got ? 'half' : ''}`} title={h.label}>
              {FLAG_ICON[h.flag]} {got ? `+${got}` : h.full}{got ? (v?.v.includes(h.flag) ? ' ✅' : ' ☑️') : ''}
            </span>
          );
        })}
      </div>
      <HealthShotButton compact />
      {open && (
        <ul className="small plan-list" style={{ marginTop: 10 }}>
          {HABIT_POINTS.map((h) => (
            <li key={h.flag}>{FLAG_ICON[h.flag]} {h.label}: {h.full} pontos{h.part ? ` (${h.partLabel}: ${h.part})` : ''}</li>
          ))}
          <li>✅ Verificados contam por inteiro: Spirulina dentro do stock dos frascos registados (e com foto nos dias de verificação), fotos do prato e dados do app Saúde ou do relógio (pelo atalho ou por captura de ecrã lida pela IA).</li>
          <li>☑️ Declarados (marcados à mão) contam até 50 pontos por dia no total.</li>
          <li>🌿 A Spirulina é a chave do dia: sem nenhuma toma, os outros hábitos valem metade.</li>
          <li>🔥 A sequência conta os dias seguidos com o ritual da Spirulina. Com 7 dias, +5% por dia; com 30, +10% (máximo 100 por dia). Um dia falhado por semana conta como descanso.</li>
          <li>📈 Reavaliação nesta semana: +20, mais 5 por cada ponto que o Índice NEFESH subir, ou +30 por manter um Índice de 70 ou mais.</li>
          <li>🏅 Desafio da semana cumprido: +50.</li>
        </ul>
      )}
    </section>
  );
}

function FeedItemRow({ f }: { f: NonNullable<SocialState['feed']>[number] }) {
  const { toast } = useStore();
  const [replying, setReplying] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const counts = f.reactions ?? (f.cheers ? { '👏': f.cheers } : {});
  return (
    <li className="feed-item">
      <div className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Face nick={f.nick} avatar={f.avatar} size={34} />
        <span style={{ flex: 1 }}>
          {feedText(f)}
          <small className="mute"> · {new Date(f.created).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</small>
        </span>
      </div>
      {(f.replies ?? []).length > 0 && (
        <ul className="replies">{f.replies!.map((r, i) => <li key={i}><b>{r.nick}:</b> {REPLIES[r.kind]}</li>)}</ul>
      )}
      <div className="react-row">
        {REACTIONS.map((k) => (
          <button
            key={k}
            className={`chip cheer ${f.myReaction === k ? 'on' : ''}`}
            disabled={f.me}
            onClick={() => act(() => react(f.id, k))}
            aria-label={`Reagir ${k}`}
          >
            {k} {counts[k] || ''}
          </button>
        ))}
        {!f.me && <button className="link small inline" onClick={() => setReplying((v) => !v)}>{replying ? 'fechar' : 'responder'}</button>}
      </div>
      {replying && (
        <div className="msg-pick">
          {Object.entries(REPLIES).map(([k, t]) => (
            <button key={k} className="chip" onClick={() => { setReplying(false); act(() => replyTo(f.id, k)); }}>{t}</button>
          ))}
          {f.uid && <button className="link small inline" style={{ color: 'var(--warn)' }} onClick={() => confirm(`Bloquear ${f.nick}? Deixam de ver as fotos, as conquistas e as mensagens um do outro. Pode desbloquear na Comunidade.`) && act(() => blockPerson(f.uid!))}>bloquear {f.nick}</button>}
        </div>
      )}
    </li>
  );
}

function FeedView({ st }: { st: SocialState }) {
  const feed = st.feed ?? [];
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Mural</h2>
      {!feed.length && <p className="small mute">Ainda sem conquistas. Os 7 dias seguidos de ritual são a primeira!</p>}
      <ul className="feed-list">{feed.map((f) => <FeedItemRow key={f.id} f={f} />)}</ul>
    </section>
  );
}

/** Equipa de melhores amigos: meta de ritual da semana em conjunto e ranking de equipas. */
function TeamView({ st }: { st: SocialState }) {
  const { toast } = useStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ckind, setCkind] = useState<CircleKind>('amigos');
  const t = st.team;
  const ck = circleOf(t?.kind);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <>
      {t ? (
        <section className="card hero">
          <p className="small" style={{ margin: 0, opacity: 0.8 }}>O meu Circle · {ck[2]} {ck[1]}</p>
          <h2 style={{ margin: '4px 0 6px' }}>{t.name}</h2>
          <p className="small" style={{ margin: '0 0 8px' }}>Meta da semana: <b>{t.goal} dias de ritual</b> somados por todos ({t.members.length} × 5)</p>
          <Bar pct={(t.done / Math.max(1, t.goal)) * 100} />
          <p className="small" style={{ margin: '6px 0 0' }}>{t.done >= t.goal ? 'Meta cumprida! 🎉' : `${t.done} de ${t.goal} dias · faltam ${t.goal - t.done}`}</p>
          <ol className="rank team-rank">
            {t.members.map((m, i) => (
              <li key={m.id} className={m.me ? 'me' : ''}>
                <b className="pos">{i + 1}</b>
                <Face nick={m.nick} avatar={m.avatar} />
                <span className="who">{m.nick}{m.me ? ' (eu)' : ''}<small>🌿 {m.ritualDays} dias esta semana{m.today ? ' · hoje ✓' : ''}</small></span>
                <b>{m.points}</b>
              </li>
            ))}
          </ol>
          <p className="small" style={{ margin: '10px 0 0' }}>Código da equipa: <code className="key" style={{ display: 'inline-block' }}>{t.code}</code></p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 8 }}>
            <a className="btn sm" href={whatsappShare(`Entra no meu Circle "${t.name}" na NEFESH Life 🌿\nComunidade → Circle → Entrar com o código ${t.code}${st.me?.code ? `\n${inviteUrl(st.me.code)}` : ''}`)} target="_blank" rel="noopener">Convidar para o Circle</a>
            <button className="btn ghost sm" onClick={() => confirm('Sair do Circle?') && run(leaveTeam, 'Saiu do Circle.')}>Sair</button>
          </div>
        </section>
      ) : (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Circles: o seu grupo privado</h2>
          <p className="small mute" style={{ marginTop: 0 }}>Família, amigos, casal ou equipa: até 8 pessoas com uma meta em comum, 5 dias de ritual por pessoa, todas as semanas. Só quem está no Circle vê os hábitos de cada um. O Circle entra no ranking pela média de pontos.</p>
          <div className="chips" role="group" aria-label="Tipo de Circle" style={{ marginBottom: 10 }}>
            {CIRCLE_KINDS.map(([k, t, icon]) => (
              <button key={k} type="button" className={`chip sm ${ckind === k ? 'on' : ''}`} aria-pressed={ckind === k} onClick={() => setCkind(k)}>{icon} {t}</button>
            ))}
          </div>
          <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); run(() => createTeam(name, ckind), 'Circle criado. Convide as suas pessoas!'); }}>
            <input className="field sm" value={name} onChange={(e) => setName(e.target.value)} placeholder={ckind === 'familia' ? 'ex.: Família Silva' : ckind === 'casal' ? 'ex.: Nós dois' : 'Nome do Circle'} maxLength={30} aria-label="Nome do Circle" />
            <button className="btn sm" disabled={name.trim().length < 2}>Criar</button>
          </form>
          <form className="row" style={{ gap: 8, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); run(() => joinTeam(code), 'Entrou no Circle!'); }}>
            <input className="field sm" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código do Circle" maxLength={8} aria-label="Código do Circle" />
            <button className="btn ghost sm" disabled={code.trim().length < 4}>Entrar</button>
          </form>
        </section>
      )}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Ranking de Circles</h2>
        {!(st.teams ?? []).length && <p className="small mute">Ainda não há Circles. Seja o primeiro!</p>}
        <ol className="rank">
          {(st.teams ?? []).map((x) => (
            <li key={x.rank} className={x.mine ? 'me' : ''}>
              <b className="pos">{x.rank}</b>
              <span className="who">{x.name}<small>{x.members} {x.members === 1 ? 'pessoa' : 'pessoas'}</small></span>
              <b>{x.avg}<small className="mute"> /pessoa</small></b>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/** Parceiro de ritual: sequência a dois, só avança quando os dois tomam a Spirulina. */
function PartnerCard({ st }: { st: SocialState }) {
  const { toast } = useStore();
  const p = st.partner;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  if (!p)
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>🤝 Parceiro de ritual</h2>
        <p className="small mute" style={{ margin: 0 }}>Escolha um amigo para fazerem o ritual juntos: a sequência a dois só avança nos dias em que os dois tomam a Spirulina. Convide-o em "outras mensagens", na lista de amigos.</p>
      </section>
    );
  if (p.status === 'recebido')
    return (
      <section className="card due">
        <h2 style={{ marginTop: 0 }}>🤝 {p.nick} quer ser o seu parceiro de ritual</h2>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <button className="btn sm" onClick={() => run(acceptPartner, 'Agora são parceiros de ritual!')}>Aceitar</button>
          <button className="btn ghost sm" onClick={() => run(endPartner, 'Convite recusado.')}>Agora não</button>
        </div>
      </section>
    );
  if (p.status === 'enviado')
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>🤝 Convite enviado a {p.nick}</h2>
        <p className="small mute">Fica ativo quando {p.nick} aceitar.</p>
        <button className="link small inline" onClick={() => run(endPartner, 'Convite cancelado.')}>cancelar convite</button>
      </section>
    );
  return (
    <section className="card hero">
      <p className="small" style={{ margin: 0, opacity: 0.8 }}>🤝 Parceiro de ritual</p>
      <div className="row" style={{ marginTop: 6 }}>
        <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><Face nick={p.nick} avatar={p.avatar} /><b>{p.nick}</b></span>
        <b style={{ font: '600 24px Sora' }}>🔥 {p.streak}</b>
      </div>
      <p className="small" style={{ margin: '6px 0 0' }}>
        {p.streak === 1 ? '1 dia de ritual juntos.' : `${p.streak} dias de ritual juntos.`} Hoje: você {p.todayMe ? '✓' : '—'} · {p.nick} {p.todayThem ? '✓' : '—'}
      </p>
      {!p.todayThem && p.todayMe && <p className="small" style={{ margin: '4px 0 0' }}>Falta {p.nick}: mande-lhe um lembrete na lista de amigos.</p>}
      <button className="link small inline" style={{ marginTop: 8 }} onClick={() => confirm('Terminar a parceria de ritual?') && run(endPartner, 'Parceria terminada.')}>terminar parceria</button>
    </section>
  );
}

/** Lembrete de grupo ao fim do dia: amigos que ainda não fizeram o ritual. */
function GroupReminder({ st }: { st: SocialState }) {
  const { toast } = useStore();
  const [sent, setSent] = useState(false);
  const missing = (st.friends ?? []).filter((f) => !f.today.includes('s'));
  if (new Date().getHours() < 17 || !missing.length || sent) return null;
  return (
    <section className="card due">
      <h2 style={{ marginTop: 0 }}>🌙 {missing.length === 1 ? `${missing[0].nick} ainda não fez` : `${missing.length} amigos ainda não fizeram`} o ritual hoje</h2>
      <p className="small mute" style={{ marginTop: 0 }}>{missing.map((f) => f.nick).join(', ')}</p>
      <button
        className="btn sm"
        onClick={async () => {
          const r = await Promise.allSettled(missing.map((f) => sendMessage(f.id, 'lembrete_spirulina')));
          setSent(true);
          toast(`Lembrete enviado a ${r.filter((x) => x.status === 'fulfilled').length} ${missing.length === 1 ? 'amigo' : 'amigos'}.`);
        }}
      >
        Lembrar {missing.length === 1 ? missing[0].nick : 'todos'}
      </button>
    </section>
  );
}

function LeagueView({ st }: { st: SocialState }) {
  const list = st.league ?? [];
  const n = list.length;
  const up = Math.max(1, Math.ceil(n * 0.2));
  const down = n >= 8 ? n - Math.floor(n * 0.2) : Infinity;
  const lg = st.me?.league ?? 0;
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}><span className="lg-dot" style={{ background: LEAGUE_COLORS[lg] }} />Liga {LEAGUES[lg]}</h2>
        <span className="small mute">termina domingo</span>
      </div>
      {!n && <p className="small mute">Ainda sem pontos esta semana. Cumpra um hábito para entrar na liga.</p>}
      <ol className="rank">
        {list.map((m, i) => (
          <li key={m.id ?? i} className={`${m.me ? 'me' : ''} ${i < up && lg < LEAGUES.length - 1 ? 'up' : ''} ${i >= down ? 'down' : ''}`}>
            <b className="pos">{m.rank}</b>
            <Face nick={m.nick} avatar={m.avatar} />
            <span className="who">{m.nick}{m.me ? ' (eu)' : ''}<small>{m.streak ? `🔥 ${m.streak}` : ''}</small></span>
            <b>{m.points}</b>
          </li>
        ))}
      </ol>
      <p className="small mute" style={{ margin: '8px 0 0' }}>
        {lg < LEAGUES.length - 1 ? `${up === 1 ? 'O primeiro sobe' : `Os ${up} primeiros sobem`} para a liga ${LEAGUES[lg + 1]} (com pelo menos 150 pontos).` : 'Está na liga mais alta.'}
        {n >= 8 ? ' Os últimos descem.' : ''} Quem fizer menos de 50 pontos desce.
      </p>
    </section>
  );
}

function FriendRow({ f }: { f: Member & { id: string; today: string } }) {
  const { toast } = useStore();
  const [more, setMore] = useState(false);
  const sug = suggestFor(f.today);
  const send = async (kind: string) => {
    try {
      await sendMessage(f.id, kind);
      toast(`Enviado a ${f.nick}.`);
      setMore(false);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <li className="friend">
      <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
        <Face nick={f.nick} avatar={f.avatar} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{f.nick}</b>
          <div className="small mute">
            {f.points} pts · {LEAGUES[f.league ?? 0]}{f.streak ? ` · 🔥 ${f.streak}` : ''}
          </div>
          <div className="small">Hoje: {f.today ? f.today.split('').map((x) => FLAG_ICON[x]).join(' ') : <span className="mute">ainda nada</span>}</div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 6, marginTop: 8 }}>
        <button className="btn sm" onClick={() => send(sug)}>{MESSAGES[sug].split(' ').slice(0, 4).join(' ')}…</button>
        <button className="btn ghost sm" onClick={() => setMore((v) => !v)}>{more ? 'fechar' : 'outras mensagens'}</button>
      </div>
      {more && (
        <div className="msg-pick">
          {Object.entries(MESSAGES).map(([k, t]) => (
            <button key={k} className="chip" onClick={() => send(k)}>{t}</button>
          ))}
          <button className="chip" onClick={async () => { try { await invitePartner(f.id); toast(`Convite de parceiro de ritual enviado a ${f.nick}.`); refresh(); } catch (e) { toast((e as Error).message); } }}>🤝 Convidar para parceiro de ritual</button>
          <button
            className="link small inline"
            style={{ color: 'var(--warn)' }}
            onClick={async () => {
              if (!confirm(`Remover ${f.nick} dos amigos?`)) return;
              await removeFriend(f.id).catch(() => undefined);
              refresh();
            }}
          >
            remover amigo
          </button>
          <button
            className="link small inline"
            style={{ color: 'var(--warn)' }}
            onClick={async () => {
              if (!confirm(`Bloquear ${f.nick}? Deixam de ser amigos e de ver as fotos, as conquistas e as mensagens um do outro. Pode desbloquear mais abaixo.`)) return;
              try { await blockPerson(f.id); toast(`${f.nick} foi bloqueado(a).`); } catch (e) { toast((e as Error).message); }
              refresh();
            }}
          >
            bloquear
          </button>
        </div>
      )}
    </li>
  );
}

function FriendsView({ st }: { st: SocialState }) {
  const { toast } = useStore();
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('amigo') ?? '');
  const unread = unreadCount(st);
  useEffect(() => {
    if (unread) markSeen().then(() => setTimeout(refresh, 4000)).catch(() => undefined);
  }, [unread]);
  const me = st.me!;
  const text = inviteText(me.code, me.nick);
  return (
    <>
      <GroupReminder st={st} />
      <PartnerCard st={st} />
      {(st.messages ?? []).length > 0 && (
        <section className="card">
          <h2>Mensagens</h2>
          <ul className="msgs">
            {st.messages!.slice(0, 10).map((m) => (
              <li key={m.id} className={m.seen ? '' : 'new'}>
                <Face nick={m.nick} avatar={m.avatar} size={30} />
                <span><b>{m.nick}</b> {MESSAGES[m.kind] ?? ''}<small className="mute"> · {new Date(m.created).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</small></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Amigos</h2>
        {(st.friends ?? []).length ? (
          <ul className="friends">{st.friends!.map((f) => <FriendRow key={f.id} f={f} />)}</ul>
        ) : (
          <p className="small mute">Ainda não tem amigos na NEFESH Life. Convide alguém ou use o código de um amigo.</p>
        )}
      </section>

      <section className="card">
        <h2>Convidar e adicionar</h2>
        <p className="small" style={{ marginTop: 0 }}>O seu código: <code className="key" style={{ display: 'inline-block' }}>{me.code}</code></p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <a className="btn sm" href={whatsappShare(text)} target="_blank" rel="noopener">Convidar pelo WhatsApp</a>
          {'share' in navigator && <button className="btn ghost sm" onClick={() => navigator.share({ text }).catch(() => undefined)}>Partilhar</button>}
        </div>
        <form
          className="row"
          style={{ gap: 8, marginTop: 14 }}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await addFriend(code);
              toast(`${r.nick} é agora seu amigo.`);
              setCode('');
              refresh();
            } catch (err) {
              toast((err as Error).message);
            }
          }}
        >
          <input className="field sm" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código do amigo" maxLength={8} aria-label="Código do amigo" />
          <button className="btn sm" disabled={code.trim().length < 4}>Adicionar</button>
        </form>
      </section>
      {(st.blocked ?? []).length > 0 && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Pessoas bloqueadas</h3>
          <p className="small mute" style={{ margin: '0 0 8px' }}>Não veem as suas fotos, conquistas nem mensagens, e não o podem adicionar.</p>
          <ul className="plain small">
            {st.blocked!.map((b) => (
              <li key={b.id} className="row">
                <span>{b.nick}</span>
                <button className="link small inline" onClick={async () => { if (!confirm(`Desbloquear ${b.nick}?`)) return; try { await unblockPerson(b.id); toast(`${b.nick} foi desbloqueado(a).`); } catch (e) { toast((e as Error).message); } refresh(); }}>desbloquear</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** NEFESH 21 Day Reset: o desafio principal (a solo ou em equipa por convite) e o cartão para partilhar. */
function ResetCard({ st }: { st: SocialState }) {
  const { S, toast } = useStore();
  const [level, setLevel] = useState<'leve' | 'firme'>('firme');
  const [busy, setBusy] = useState(false);
  const r = (st.challenges ?? []).find((c) => c.kind === 'reset21');
  const code = st.me?.code ?? '';
  const nick = st.me?.nick ?? '';
  const share = async () => {
    if (!r) return;
    const me = r.members.find((m) => m.me);
    setBusy(true);
    try {
      const done = me?.done ?? 0;
      const finished = done >= r.target;
      const blob = await drawShareCard({
        title: 'NEFESH 21 Day Reset',
        subtitle: finished ? 'Concluído! 🎉' : `Dia ${r.day ?? 1} de 21`,
        progress: { done, total: 21 },
        stats: [
          ['dias de Spirulina e água', String(done)],
          ['dias seguidos de ritual', String(activityStreak(S))],
          [r.members.length > 1 ? 'pessoas na equipa' : 'objetivo', r.members.length > 1 ? String(r.members.length) : `${r.target}/21`],
        ],
        nick,
        link: inviteUrl(code, r.id),
      });
      const out = await shareImage(blob, resetInviteText(code, nick, r.id), 'nefesh-21-day-reset.png');
      if (out === 'descarregado') toast('Imagem guardada. Partilhe-a no Instagram ou no WhatsApp.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!r)
    return (
      <section className="card hero reset-card">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Desafio principal</p>
        <h2 style={{ margin: '4px 0 6px' }}>🌿💧 NEFESH 21 Day Reset</h2>
        <p className="small" style={{ margin: '0 0 10px' }}>
          21 dias de Spirulina e meta de água no mesmo dia. Comece a solo ou convide 2 amigos para formarem uma equipa de 3. No fim, partilhe o seu cartão de evolução.
        </p>
        <div className="chips" role="group" aria-label="Nível">
          {LEVELS.map(([k, t]) => (
            <button key={k} className={`chip sm ${level === k ? 'on' : ''}`} aria-pressed={level === k} onClick={() => setLevel(k)}>
              {t} · {k === 'leve' ? '15' : '18'} de 21 dias
            </button>
          ))}
        </div>
        <button
          className="btn full"
          style={{ marginTop: 12 }}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createChallenge(`reset21:21:${level}`, []);
              toast('O seu 21 Day Reset começa hoje! Convide 2 amigos.');
              refresh();
            } catch (e) {
              toast((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Começar o Reset hoje
        </button>
      </section>
    );
  const me = r.members.find((m) => m.me);
  const ended = r.end < todayKey();
  return (
    <section className="card hero reset-card">
      <div className="row">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🌿💧 NEFESH 21 Day Reset</p>
        <span className="small" style={{ opacity: 0.8 }}>{ended ? 'terminado' : `dia ${r.day ?? 1} de 21`}</span>
      </div>
      <h2 style={{ margin: '4px 0 6px' }}>{(me?.done ?? 0) >= r.target ? 'Reset concluído! 🎉' : `${me?.done ?? 0} de ${r.target} dias`}</h2>
      <Bar pct={((me?.done ?? 0) / r.target) * 100} />
      <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>Spirulina e meta de água no mesmo dia · nível {r.level === 'leve' ? 'leve' : 'firme'}</p>
      <ul className="rank" style={{ marginTop: 10 }}>
        {r.members.map((m, i) => (
          <li key={m.id} className={m.me ? 'me' : ''}>
            <b className="pos">{i + 1}</b>
            <Face nick={m.nick} avatar={m.avatar} />
            <span className="who">{m.nick}{m.done >= r.target ? ' 🏅' : ''}</span>
            <b>{m.done}/{r.target}</b>
          </li>
        ))}
      </ul>
      {r.members.length < 3 && !ended && <p className="small" style={{ margin: '8px 0 0' }}>Convide {3 - r.members.length === 1 ? 'mais 1 amigo' : '2 amigos'} para formarem uma equipa de 3. Quem entrar pelo link fica logo no seu Reset.</p>}
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 10 }}>
        {!ended && <a className="btn sm" href={whatsappShare(resetInviteText(code, nick, r.id))} target="_blank" rel="noopener">Convidar amigos</a>}
        <button className="btn ghost sm" disabled={busy} onClick={share}>{busy ? 'A preparar…' : '📸 Partilhar o meu cartão'}</button>
      </div>
      <button className="link small inline" style={{ marginTop: 8 }} onClick={async () => { if (!confirm('Sair do 21 Day Reset?')) return; await leaveChallenge(r.id).catch(() => undefined); refresh(); }}>sair do Reset</button>
    </section>
  );
}

function ChallengesView({ st }: { st: SocialState }) {
  const { toast } = useStore();
  const [kind, setKind] = useState('ritual');
  const [days, setDays] = useState<number>(7);
  const [level, setLevel] = useState<'leve' | 'firme'>('firme');
  const [pick, setPick] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const o = st.official;
  const friends = st.friends ?? [];
  return (
    <>
      <ResetCard st={st} />
      {o && (
        <section className="card">
          <p className="small mute" style={{ margin: 0 }}>Desafio NEFESH da semana</p>
          <h2 style={{ margin: '4px 0' }}>{CHALLENGES[o.kind].icon} {CHALLENGES[o.kind].title}</h2>
          <p className="small" style={{ margin: '0 0 8px' }}>{CHALLENGES[o.kind].text}: {o.target} dias até domingo. Prémio: +{o.bonus} pontos.</p>
          <Bar pct={(o.done / o.target) * 100} />
          <p className="small" style={{ margin: '6px 0 0' }}>{o.done >= o.target ? 'Cumprido! 🎉' : `${o.done} de ${o.target} dias`}</p>
        </section>
      )}

      {(st.challenges ?? []).filter((c) => c.kind !== 'reset21').map((c) => (
        <section className="card" key={c.id}>
          <div className="row">
            <h2 style={{ margin: 0 }}>{CHALLENGES[c.kind]?.icon} {CHALLENGES[c.kind]?.title}</h2>
            <span className="small mute">{c.end < todayKey() ? 'terminado' : `dia ${c.day ?? 1} de ${c.days}`}</span>
          </div>
          <p className="small mute">{CHALLENGES[c.kind]?.text}: {c.target} de {c.days} dias{c.level === 'leve' ? ' · leve' : ''} · até {c.end.split('-').reverse().slice(0, 2).join('/')}</p>
          <ul className="rank">
            {c.members.map((m, i) => (
              <li key={m.id} className={m.me ? 'me' : ''}>
                <b className="pos">{i + 1}</b>
                <Face nick={m.nick} avatar={m.avatar} />
                <span className="who">{m.nick}{m.done >= c.target ? ' 🏅' : ''}</span>
                <b>{m.done}/{c.target}</b>
              </li>
            ))}
          </ul>
          <button className="link small inline" onClick={async () => { await leaveChallenge(c.id).catch(() => undefined); refresh(); }}>sair do desafio</button>
        </section>
      ))}

      <section className="card">
        <h2>Desafiar amigos</h2>
        {!friends.length ? (
          <p className="small mute">Adicione amigos para criar desafios entre vocês.</p>
        ) : !creating ? (
          <button className="btn sm" onClick={() => setCreating(true)}>Criar desafio</button>
        ) : (
          <>
            <div className="msg-pick">
              {Object.entries(CHALLENGES).filter(([k]) => k !== 'reset21').map(([k, c]) => (
                <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{c.icon} {c.title}</button>
              ))}
            </div>
            <p className="small mute">Duração</p>
            <div className="chips" role="group" aria-label="Duração">
              {DURATIONS.map((d) => (
                <button key={d} className={`chip sm ${days === d ? 'on' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} dias</button>
              ))}
            </div>
            <p className="small mute">Nível</p>
            <div className="chips" role="group" aria-label="Nível do desafio">
              {LEVELS.map(([k, t]) => (
                <button key={k} className={`chip sm ${level === k ? 'on' : ''}`} aria-pressed={level === k} onClick={() => setLevel(k)}>{t}</button>
              ))}
            </div>
            <p className="small mute" style={{ margin: '4px 0 8px' }}>{level === 'leve' ? 'Leve: cerca de 3 em cada 4 dias. Bom para começar.' : 'Firme: a meta completa do desafio.'}</p>
            <p className="small mute">Com quem?</p>
            {friends.map((f) => (
              <label className="check" key={f.id}>
                <input type="checkbox" checked={pick.includes(f.id)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, f.id] : p.filter((x) => x !== f.id)))} />
                <span>{f.nick}</span>
              </label>
            ))}
            <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 10 }}>
              <button
                className="btn sm"
                disabled={!pick.length}
                onClick={async () => {
                  try {
                    await createChallenge(`${kind}:${days}:${level}`, pick);
                    toast('Desafio criado. Começa hoje!');
                    setCreating(false);
                    setPick([]);
                    refresh();
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                Lançar desafio
              </button>
              <button className="btn ghost sm" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function EvolutionView() {
  const [list, setList] = useState<Awaited<ReturnType<typeof evolutionRanking>>['ranking'] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    evolutionRanking().then((r) => setList(r.ranking)).catch((e) => setError((e as Error).message));
  }, []);
  return (
    <section className="card">
      <h2>Evolução do Índice NEFESH</h2>
      <p className="small mute" style={{ marginTop: 0 }}>Quanto subiu o Índice desde a primeira avaliação. Quem mantém um Índice alto também aparece.</p>
      {error && <p className="small err">{error}</p>}
      {!list && !error && <p className="small mute">A carregar…</p>}
      {list && !list.length && <p className="small mute">Ainda ninguém se reavaliou. Faça a sua reavaliação no Perfil.</p>}
      <ol className="rank">
        {(list ?? []).map((r) => (
          <li key={r.rank}>
            <b className="pos">{r.rank}</b>
            <Face nick={r.nick} avatar={r.avatar} />
            <span className="who">{r.nick}<small>{r.from} → {r.to}</small></span>
            <b className={r.gain > 0 ? 'neon' : ''}>{r.gain > 0 ? `+${r.gain}` : r.gain === 0 ? '=' : r.gain}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Community({ openAccount }: { openAccount: () => void }) {
  const auth = useAuth();
  const { S, update, toast } = useStore();
  const { state: st, error, loading } = useSocial(20_000);
  const [view, setView] = useState<View>(() => (new URLSearchParams(location.search).get('amigo') ? 'amigos' : 'mural'));
  const lvl = useMemo(() => levelOf(totalPoints(S)), [S]);
  const streak = useMemo(() => activityStreak(S), [S]);
  const week = useMemo(() => weekTotal(weekPayload(S)), [S]);
  // já participa (por exemplo, noutro telemóvel): volta a ligar o envio de pontos neste
  useEffect(() => {
    if (st?.joined && st.me && !S.community) update((d) => { d.community = { nick: st.me!.nick, since: todayKey() }; });
  }, [st?.joined]);
  // convite por link: depois de entrar na comunidade, fica amigo de quem convidou (e no Reset dele)
  useEffect(() => {
    const inv = pendingInvite();
    if (!st?.joined || !inv) return;
    clearInvite();
    acceptInvite(inv.code, inv.cid || undefined)
      .then((r) => {
        if (r.self) return;
        toast(r.joined ? `Entrou no 21 Day Reset de ${r.nick}! 🌿` : `Agora é amigo de ${r.nick} na NEFESH 🌿`);
        setView(r.joined ? 'desafios' : 'amigos');
        refresh();
      })
      .catch((e) => toast((e as Error).message));
  }, [st?.joined]);

  if (!auth)
    return (
      <>
        <h1>Comunidade NEFESH</h1>
        <p className="mute">Pontos pelos seus hábitos, ligas semanais, amigos que se incentivam e desafios.</p>
        <section className="card" data-tour="comunidade">
          <p className="small" style={{ marginTop: 0 }}>Para entrar na comunidade precisa de uma conta (é grátis e leva 30 segundos).</p>
          <button className="btn" onClick={openAccount}>Criar conta ou entrar</button>
        </section>
      </>
    );
  if (!S.ans)
    return (
      <>
        <h1>Comunidade NEFESH</h1>
        <section className="card"><p className="small mute" style={{ margin: 0 }}>Faça primeiro a sua avaliação para começar a ganhar pontos.</p></section>
      </>
    );
  if (error && !st)
    return (
      <>
        <h1>Comunidade NEFESH</h1>
        <section className="card">
          <p className="small err" style={{ marginTop: 0 }}>{error}</p>
          <button className="btn ghost sm" onClick={() => refresh()}>Tentar outra vez</button>
        </section>
      </>
    );
  if (!st) return <><h1>Comunidade NEFESH</h1><p className="mute">{loading ? 'A carregar…' : ''}</p></>;
  if (!st.joined) return <Join onJoined={() => setView(pendingInvite() ? 'desafios' : 'mural')} />;

  const res = st.me?.result;
  return (
    <>
      <div className="row">
        <h1>Comunidade</h1>
        {loading && <span className="small mute">a atualizar…</span>}
      </div>

      {res && (
        <section className={`card ${res.to > res.from ? 'due' : ''}`}>
          <h2 style={{ marginTop: 0 }}>
            {res.to > res.from ? `🎉 Subiu para a liga ${LEAGUES[res.to]}!` : res.to < res.from ? `Desceu para a liga ${LEAGUES[res.to]}` : `Ficou na liga ${LEAGUES[res.to]}`}
          </h2>
          <p className="small mute">Na semana passada ficou em {res.rank}.º de {res.n}, com {res.points} pontos.{res.to < res.from ? ' Esta semana é uma nova oportunidade.' : ''}</p>
          <button className="btn sm" onClick={async () => { await resultSeen().catch(() => undefined); refresh(); }}>Continuar</button>
        </section>
      )}


      <section className="card hero">
        <div className="row">
          <div>
            <p className="small" style={{ margin: 0, opacity: 0.8 }}>Nível</p>
            <h2 style={{ margin: '2px 0 0' }}>{lvl.name}</h2>
          </div>
          <div className="hero-stats">
            <div><b>{st.me?.points ?? week}</b><span>pontos na semana</span></div>
            <div><b>🔥 {streak}</b><span>{streak === 1 ? 'dia de ritual' : 'dias de ritual'}</span></div>
          </div>
        </div>
        <Bar pct={lvl.pct} />
        <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>{lvl.next ? `Faltam ${lvl.toNext.toLocaleString('pt-PT')} pontos para ${lvl.next}.` : 'Chegou ao nível mais alto!'}</p>
      </section>

      <SpirulinaCheck />
      <TodayPoints st={st} />

      <div className="seg acc-seg five" data-tour="comunidade" role="group" aria-label="Comunidade">
        {([['mural', 'Mural'], ['liga', 'Liga'], ['equipa', 'Circle'], ['amigos', `Amigos${unreadCount(st) ? ` (${unreadCount(st)})` : ''}${st.partner?.status === 'recebido' ? ' •' : ''}`], ['desafios', 'Desafios']] as [View, string][]).map(([k, t]) => (
          <button key={k} className={view === k ? 'on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{t}</button>
        ))}
      </div>

      {view === 'mural' && <><Moments st={st} /><FeedView st={st} /></>}
      {view === 'liga' && <>{st.prize && <PrizeRanking p={st.prize} />}<LeagueView st={st} /><EvolutionView /></>}
      {view === 'equipa' && <TeamView st={st} />}
      {view === 'amigos' && <FriendsView st={st} />}
      {view === 'desafios' && <ChallengesView st={st} />}

      <p style={{ textAlign: 'center' }}>
        <button
          className="skip"
          onClick={async () => {
            if (!confirm('Sair da comunidade? Os seus pontos, amigos e mensagens na comunidade são apagados. Os seus dados da app ficam.')) return;
            try {
              await leaveCommunity();
              update((d) => { delete d.community; });
              await refresh();
              toast('Saiu da comunidade.');
            } catch (e) {
              toast((e as Error).message);
            }
          }}
        >
          Sair da comunidade
        </button>
      </p>
    </>
  );
}
