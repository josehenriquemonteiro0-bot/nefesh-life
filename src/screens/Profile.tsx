import { useState } from 'react';
import { Bar } from '../components/Charts';
import { Icon } from '../components/Icon';
import { DataCard } from '../components/DataCard';
import { SHOP_URL, GOAL_LABEL, whatsappLink } from '../domain/content';
import { daysSince, fmtNum } from '../domain/dates';
import { indexOf, planFor } from '../domain/plan';
import { reorderText, stock } from '../domain/stats';
import { lotFor, stockText } from '../domain/lots';
import { nextReassessment } from '../domain/progress';
import { BODY_GOAL_LABEL, bodyGoalOf, bodyOf } from '../domain/body';
import { setCommunityPush } from '../domain/social';
import { disablePush, enablePush, isInstalled, isIOS, pushSupported, updatePush } from '../domain/push';
import { useStore } from '../state/store';
import { Comparison } from './Evolution';
import { AccountCard } from '../components/Account';
import { AvatarEdit } from '../components/Avatar';
import { BottleCodeForm } from '../components/BottleCode';
import { syncedLabel } from '../domain/account';
import { Benefits } from '../components/Prize';
import { PrivacyCard } from '../components/PrivacyCard';

/** Ativar ou desligar as notificações (lembrete da toma, amigos e liga). */
function PushToggle() {
  const { S, update, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (S.notifications)
    return (
      <>
        {S.community && (
          <label className="check" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={S.communityPush !== false}
              onChange={async (e) => {
                const on = e.target.checked;
                update((d) => { d.communityPush = on; });
                try {
                  await setCommunityPush(on);
                  toast(on ? 'Vai receber avisos da comunidade.' : 'Avisos da comunidade desligados.');
                } catch (err) {
                  toast((err as Error).message);
                }
              }}
            />
            <span className="small">
              Avisos da comunidade: o parceiro já tomou, a meta da equipa, conquistas e momentos de amigos, a liga.
              <span className="mute"> No máximo 3 por dia e nunca entre as 22h e as 8h.</span>
            </span>
          </label>
        )}
        <button
          className="link small inline"
          style={{ marginTop: 10 }}
          onClick={async () => {
            await disablePush();
            update((d) => { d.notifications = false; });
            toast('Notificações desligadas.');
          }}
        >
          desligar notificações
        </button>
      </>
    );
  return (
    <>
      <button
        className="btn sm"
        style={{ marginTop: 12 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const err = await enablePush(S.reminder);
          setBusy(false);
          setMsg(err);
          if (!err) {
            update((d) => { d.notifications = true; });
            toast('Notificações ativadas.');
          }
        }}
      >
        <Icon name="bell" /> Ativar notificações
      </button>
      {(msg || (isIOS() && !isInstalled())) && (
        <p className="small key-warn">{msg ?? 'No iPhone, as notificações só funcionam com a app no ecrã principal: no Safari, toque em Partilhar → Adicionar ao ecrã principal.'}</p>
      )}
      {!pushSupported() && !isIOS() && <p className="small mute">Este navegador não permite notificações.</p>}
      <p className="small mute" style={{ margin: '8px 0 0' }}>Recebe o lembrete da Spirulina, as mensagens dos amigos e o aviso de fim da liga ao domingo.</p>
    </>
  );
}

export function Profile({ startQuiz, replayIntro, openBottle, openReport, printReport, openAccount, syncNow, openHealth, openTour }: {
  openTour: () => void;
  openHealth: () => void;
  openAccount: () => void;
  syncNow: () => Promise<void>;
  startQuiz: () => void;
  replayIntro: () => void;
  openBottle: () => void;
  openReport: () => void;
  printReport: () => void;
}) {
  const { S, update, toast } = useStore();
  if (!S.ans) {
    return (
      <>
        <h1>Perfil</h1>
        <section className="card">
          <p className="small mute">Ainda não fez a avaliação.</p>
          <button className="btn" onClick={startQuiz}>Começar a avaliação</button>
        </section>
        <AccountCard openAccount={openAccount} syncNow={syncNow} />
        <DataCard />
      </>
    );
  }
  const c = planFor(S);
  const st = stock(S);
  const low = st.days <= 10;
  const ev = S.evals[S.evals.length - 1];
  const re = nextReassessment(S);
  const lastLot = lotFor([...(S.bottles || [])].reverse().find((b) => b.code)?.code);
  const day = S.planStart ? daysSince(S.planStart) + 1 : 1;

  return (
    <>
      <h1>Perfil</h1>
      <section className="card hero profile-hero">
        <AvatarEdit />
        <div>
          <p className="small" style={{ margin: 0, opacity: 0.8 }}>Dia {day} do ritual</p>
          <h2 style={{ margin: '4px 0 2px' }}>
            {S.ans.name || 'O seu plano'}{' '}
            <button
              className="link small inline"
              onClick={() => {
                const v = window.prompt('Como quer ser tratado(a)?', S.ans?.name ?? '');
                if (v === null) return;
                update((d) => { if (d.ans) d.ans.name = v.trim().slice(0, 40); });
              }}
            >
              alterar
            </button>
          </h2>
          <p className="small" style={{ margin: 0, opacity: 0.85 }}>
            {GOAL_LABEL[S.ans.goal ?? 'energia']} · {BODY_GOAL_LABEL[bodyOf(S.ans)?.corpo ?? bodyGoalOf(S.ans)]}
            {ev ? ` · Índice ${indexOf(ev.sc)}` : ''}
          </p>
        </div>
      </section>

      <AccountCard openAccount={openAccount} syncNow={syncNow} />

      <section className="card">
        <div className="row">
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ margin: 0 }}>App Saúde e relógio</h2>
            <p className="small mute" style={{ margin: '4px 0 0' }}>
              {S.health2 ? `Ligado · últimos dados ${syncedLabel(S.health2.lastAt)}` : 'Passos, sono e exercício do iPhone, Apple Watch e outros relógios.'}
            </p>
          </div>
          <button className={`btn sm ${S.health2 ? 'ghost' : ''}`} onClick={openHealth}>{S.health2 ? 'Gerir' : 'Ligar'}</button>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ margin: 0 }}>Reavaliação</h2>
            <p className="small mute" style={{ margin: '4px 0 0' }}>
              {re?.due
                ? `Chegou a reavaliação dos ${re.target} dias.`
                : re
                  ? `Próxima aos ${re.target} dias: ${re.inDays === 1 ? 'amanhã' : `daqui a ${re.inDays} dias`}.`
                  : 'Aos 7, 15 e 30 dias e depois todos os meses.'}
            </p>
          </div>
          <button className={`btn sm ${re?.due ? '' : 'ghost'}`} onClick={startQuiz}>Reavaliar</button>
        </div>
      </section>

      <Comparison />

      <section className="card">
        <h2>Relatório</h2>
        <p className="small mute" style={{ marginTop: 0 }}>Com o seu plano, a semana, o antes e depois e a execução dos planos do nutricionista e do personal.</p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <button className="btn sm" onClick={printReport}>Guardar em PDF</button>
          <button className="btn ghost sm" onClick={openReport}>Enviar como texto</button>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Spirulina e reposição</h2>
          <span className="mute small">{c.format === 'caps' ? st.left : fmtNum(st.left / 2)} de {stockText(S.stockCaps, c.format)}</span>
        </div>
        <Bar pct={st.pct} variant={low ? 'low' : undefined} />
        <p className={`small ${low ? '' : 'mute'}`}>
          {low ? `O seu stock acaba em ${st.days} ${st.days === 1 ? 'dia' : 'dias'}` : `Ao seu ritmo, o seu stock dura mais ${st.days} dias`}{st.rate < 1 ? ` (toma em ${Math.round(st.rate * 100)}% dos dias; a tomar todos os dias seriam ${st.planDays})` : ''}.{S.notifications ? ' Avisamos por notificação 7 dias antes de acabar.' : ''}
          {lastLot ? ` Lote ${lastLot.code}: ${lastLot.values.filter((v) => v.pos === 'acima').map((v) => v.label).join(', ')} acima da referência.` : ''}
        </p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <a className="btn sm" href={whatsappLink(reorderText(S))} target="_blank" rel="noopener">Encomendar pelo WhatsApp</a>
          <a className="btn ghost sm" href={SHOP_URL} target="_blank" rel="noopener">Loja online</a>
          <button className="btn ghost sm" onClick={openBottle}><Icon name="qr" /> {lastLot ? 'Ver análises' : 'Ler QR do frasco'}</button>
        </div>
        <BottleCodeForm />
      </section>

      <Benefits />

      <section className="card">
        <div className="row">
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ margin: 0 }}>Notificações</h2>
            <p className="mute small" style={{ margin: '4px 0 0' }}>
              {S.notifications
                ? 'Ativas neste telemóvel, mesmo com a app fechada. Lembrete da Spirulina à hora indicada ao lado (se já tiver tomado, não recebe).'
                : 'Receba o lembrete da Spirulina à hora indicada ao lado e os avisos da comunidade, mesmo com a app fechada.'}
            </p>
          </div>
          <input
            type="time"
            value={S.reminder}
            aria-label="Hora do lembrete"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              update((d) => { d.reminder = v; });
              updatePush(v);
              toast(`Lembrete às ${v}.`);
            }}
          />
        </div>
        <PushToggle />
      </section>

      <PrivacyCard />

      <DataCard startQuiz={startQuiz} />

      <p style={{ textAlign: 'center' }}>
        <button className="skip" onClick={openTour}>Ver o tutorial da app</button>
        <button className="skip" onClick={() => update((d) => { d.tipsSeen = {}; })}>Mostrar de novo as dicas</button>
        <button className="skip" onClick={replayIntro}>Rever as boas-vindas</button>
      </p>
    </>
  );
}
