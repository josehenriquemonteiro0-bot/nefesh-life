import { useEffect, useMemo, useState } from 'react';
import { Bar } from '../components/Charts';
import { useAuth } from '../domain/account';
import { todayKey } from '../domain/dates';
import { HABIT_POINTS, activityStreak, dayScore, levelOf, totalPoints, weekPayload, weekTotal, type Flag } from '../domain/points';
import {
  CHALLENGES, LEAGUES, LEAGUE_COLORS, MESSAGES, addFriend, createChallenge, evolutionRanking, inviteText, join, leaveChallenge,
  leaveCommunity, markSeen, refresh, removeFriend, resultSeen, sendMessage, suggestFor, unreadCount, useSocial, type Member, type SocialState,
} from '../domain/social';
import { pushPoints } from '../state/socialSync';
import { useStore } from '../state/store';
import { whatsappShare } from '../domain/content';

type View = 'liga' | 'amigos' | 'desafios' | 'evolucao';

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
      <section className="card">
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
function TodayPoints() {
  const { S } = useStore();
  const d = dayScore(S, todayKey());
  const [open, setOpen] = useState(false);
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Hoje: {d.points} pontos</h2>
        <button className="link small inline" onClick={() => setOpen((v) => !v)}>{open ? 'fechar' : 'como ganho pontos?'}</button>
      </div>
      {d.halved && <p className="small key-warn">🌿 Ainda sem Spirulina hoje: os outros hábitos estão a valer metade. Tome a sua dose para os pontos contarem por inteiro.</p>}
      <div className="flags">
        {HABIT_POINTS.map((h) => {
          const got = d.parts[h.flag as Flag];
          return (
            <span key={h.flag} className={`flag ${got >= h.full ? 'on' : got ? 'half' : ''}`} title={h.label}>
              {FLAG_ICON[h.flag]} {got ? `+${got}` : h.full}
            </span>
          );
        })}
      </div>
      {open && (
        <ul className="small plan-list" style={{ marginTop: 10 }}>
          {HABIT_POINTS.map((h) => (
            <li key={h.flag}>{FLAG_ICON[h.flag]} {h.label}: {h.full} pontos{h.part ? ` (${h.partLabel}: ${h.part})` : ''}</li>
          ))}
          <li>🌿 A Spirulina é a chave do dia: sem nenhuma toma, os outros hábitos valem metade.</li>
          <li>🔥 A sequência conta os dias seguidos com o ritual da Spirulina. Com 7 dias, +5% por dia; com 30, +10% (máximo 100 por dia). Um dia falhado por semana conta como descanso.</li>
          <li>📈 Reavaliação nesta semana: +20, mais 5 por cada ponto que o Índice NEFESH subir, ou +30 por manter um Índice de 70 ou mais.</li>
          <li>🏅 Desafio da semana cumprido: +50.</li>
        </ul>
      )}
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
    </>
  );
}

function ChallengesView({ st }: { st: SocialState }) {
  const { toast } = useStore();
  const [kind, setKind] = useState('ritual');
  const [pick, setPick] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const o = st.official;
  const friends = st.friends ?? [];
  return (
    <>
      {o && (
        <section className="card hero">
          <p className="small" style={{ margin: 0, opacity: 0.85 }}>Desafio NEFESH da semana</p>
          <h2 style={{ margin: '4px 0' }}>{CHALLENGES[o.kind].icon} {CHALLENGES[o.kind].title}</h2>
          <p className="small" style={{ margin: '0 0 8px' }}>{CHALLENGES[o.kind].text}: {o.target} dias até domingo. Prémio: +{o.bonus} pontos.</p>
          <Bar pct={(o.done / o.target) * 100} />
          <p className="small" style={{ margin: '6px 0 0' }}>{o.done >= o.target ? 'Cumprido! 🎉' : `${o.done} de ${o.target} dias`}</p>
        </section>
      )}

      {(st.challenges ?? []).map((c) => (
        <section className="card" key={c.id}>
          <div className="row">
            <h2 style={{ margin: 0 }}>{CHALLENGES[c.kind]?.icon} {CHALLENGES[c.kind]?.title}</h2>
            <span className="small mute">{c.end < todayKey() ? 'terminado' : `até ${c.end.split('-').reverse().slice(0, 2).join('/')}`}</span>
          </div>
          <p className="small mute">{CHALLENGES[c.kind]?.text}: {c.target} de {c.days} dias</p>
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
          <button className="btn sm" onClick={() => setCreating(true)}>Criar desafio de 7 dias</button>
        ) : (
          <>
            <div className="msg-pick">
              {Object.entries(CHALLENGES).map(([k, c]) => (
                <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{c.icon} {c.title}</button>
              ))}
            </div>
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
                    await createChallenge(kind, pick);
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
  const [view, setView] = useState<View>(() => (new URLSearchParams(location.search).get('amigo') ? 'amigos' : 'liga'));
  const lvl = useMemo(() => levelOf(totalPoints(S)), [S]);
  const streak = useMemo(() => activityStreak(S), [S]);
  const week = useMemo(() => weekTotal(weekPayload(S)), [S]);
  // já participa (por exemplo, noutro telemóvel): volta a ligar o envio de pontos neste
  useEffect(() => {
    if (st?.joined && st.me && !S.community) update((d) => { d.community = { nick: st.me!.nick, since: todayKey() }; });
  }, [st?.joined]);

  if (!auth)
    return (
      <>
        <h1>Comunidade NEFESH</h1>
        <p className="mute">Pontos pelos seus hábitos, ligas semanais, amigos que se incentivam e desafios.</p>
        <section className="card">
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
  if (!st.joined) return <Join onJoined={() => setView('liga')} />;

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
            <div><b>{week}</b><span>pontos na semana</span></div>
            <div><b>🔥 {streak}</b><span>dias de ritual</span></div>
          </div>
        </div>
        <Bar pct={lvl.pct} />
        <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>{lvl.next ? `Faltam ${lvl.toNext.toLocaleString('pt-PT')} pontos para ${lvl.next}.` : 'Chegou ao nível mais alto!'}</p>
      </section>

      <TodayPoints />

      <div className="seg acc-seg four" role="group" aria-label="Comunidade">
        {([['liga', 'Liga'], ['amigos', `Amigos${unreadCount(st) ? ` (${unreadCount(st)})` : ''}`], ['desafios', 'Desafios'], ['evolucao', 'Evolução']] as [View, string][]).map(([k, t]) => (
          <button key={k} className={view === k ? 'on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{t}</button>
        ))}
      </div>

      {view === 'liga' && <LeagueView st={st} />}
      {view === 'amigos' && <FriendsView st={st} />}
      {view === 'desafios' && <ChallengesView st={st} />}
      {view === 'evolucao' && <EvolutionView />}

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
