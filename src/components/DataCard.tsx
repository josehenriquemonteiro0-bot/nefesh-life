import { useRef, useState } from 'react';
import { APP_VERSION, whatsappLink } from '../domain/content';
import { backupFileName, makeBackup, readBackup } from '../domain/backup';
import { blankState } from '../domain/sample';
import { clearFiles } from '../domain/files';
import { useStore } from '../state/store';
import { PrivacyText } from './Consent';
import { getAuth, logout, useAuth } from '../domain/account';

/** Chaves locais da app (além dos dados principais) que também são apagadas. */
const EXTRA_KEYS = ['nefesh-life-coach', 'nefesh-life-convite', 'nefesh-life-frasco', 'nefesh-life-reposicao', 'nefesh-life-usos-premium', 'nefesh-life-consentimentos', 'nefesh-life-foto-comunidade', 'nefesh-life-ping'];

/** Resumo legível do que está guardado (direito de acesso). */
function MyData() {
  const { S } = useStore();
  const auth = useAuth();
  const days = Object.keys(S.logs);
  const count = (f: (l: (typeof S.logs)[string]) => boolean) => days.filter((k) => f(S.logs[k])).length;
  const a = S.ans ?? {};
  const rows: [string, string][] = [
    ['Avaliação', S.ans ? `objetivo, idade ${a.idade ?? '—'}, ${a.peso ?? '—'} kg, ${a.altura ?? '—'} cm, sono, energia, hábitos${(a.safe ?? []).filter((x) => x !== 'nenhuma').length ? ', situações de saúde indicadas' : ''}` : 'ainda não feita'],
    ['Reavaliações', `${S.evals.length}`],
    ['Dias com registos', `${days.length}${days.length ? ` (de ${days.sort()[0].split('-').reverse().join('/')} a hoje)` : ''}`],
    ['Tomas de Spirulina', `${count((l) => (l.doses ?? []).some(Boolean))} dias`],
    ['Check-ins', `${count((l) => !!l.e)}`],
    ['Água, sono e passos', `${count((l) => !!l.water)} / ${count((l) => l.sleepH !== undefined)} / ${count((l) => l.steps !== undefined)} dias`],
    ['Refeições no diário', `${count((l) => Object.values(l.meals ?? {}).some((m) => (m ?? []).length > 0))} dias`],
    ['Treinos', `${count((l) => (l.workouts ?? []).length > 0)} dias`],
    ['Planos de profissionais', [S.plans?.nutri && 'alimentar', S.plans?.treino && 'de treino'].filter(Boolean).join(' e ') || 'nenhum'],
    ['Frascos registados', `${(S.bottles ?? []).length}`],
    ['Conta', auth ? auth.email : 'sem conta (só neste telemóvel)'],
    ['Comunidade', S.community ? `alcunha "${S.community.nick}"` : 'não participa'],
    ['Conversa com o Coach', 'só neste telemóvel'],
  ];
  return (
    <table className="mydata small">
      <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
    </table>
  );
}

/** Os meus dados: ver, corrigir, exportar, recuperar e apagar (RGPD/LGPD), privacidade e opinião. */
export function DataCard({ startQuiz }: { startQuiz?: () => void }) {
  const { S, replace, toast } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showData, setShowData] = useState(false);
  const auth = useAuth();

  const save = async () => {
    const name = backupFileName();
    const blob = new Blob([makeBackup(S)], { type: 'application/json' });
    const f = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: 'Cópia NEFESH Life' });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Cópia guardada.');
  };

  const restore = async (f: File) => {
    try {
      const next = readBackup(await f.text());
      if (!confirm('Substituir os dados deste telemóvel pela cópia escolhida?')) return;
      replace(next);
      toast('Dados recuperados.');
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <section className="card">
      <h2>Os meus dados</h2>
      <p className="small mute">
        {auth
          ? `Os seus dados estão neste telemóvel e na sua conta (${auth.email}). Também pode guardar uma cópia em ficheiro.`
          : 'Os seus dados ficam só neste telemóvel. Se apagar a app, perdem-se: crie uma conta no Perfil ou guarde uma cópia de vez em quando (no iCloud, no e-mail ou no WhatsApp).'}
      </p>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginBottom: 8 }}>
        <button className="btn ghost sm" onClick={() => setShowData((v) => !v)}>{showData ? 'Fechar' : 'Ver os meus dados'}</button>
        {startQuiz && S.ans && <button className="btn ghost sm" onClick={startQuiz}>Corrigir a avaliação</button>}
      </div>
      {showData && (
        <div style={{ marginBottom: 10 }}>
          <MyData />
          <p className="small mute" style={{ margin: '6px 0 0' }}>Para corrigir um registo, toque nele no ecrã respetivo (diário, sono, check-in) ou peça ao Coach. A cópia em ficheiro tem todos os dados, em formato legível (JSON).</p>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button className="btn sm" onClick={save}>Exportar os meus dados</button>
        <button className="btn ghost sm" onClick={() => file.current?.click()}>Recuperar cópia</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) restore(f);
            e.target.value = '';
          }}
        />
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 10 }}>
        <a className="btn ghost sm" href={whatsappLink(`Olá NEFESH! A minha opinião sobre a app NEFESH Life (versão ${APP_VERSION}):\n\n`)} target="_blank" rel="noopener">Dar a minha opinião</a>
        <button className="btn ghost sm" onClick={() => setShowPrivacy((v) => !v)}>{showPrivacy ? 'Fechar privacidade' : 'Privacidade'}</button>
      </div>
      {showPrivacy && <div style={{ marginTop: 12 }}><PrivacyText /></div>}
      <div className="row" style={{ marginTop: 14 }}>
        <span className="small mute">Versão {APP_VERSION}</span>
        <button
          className="link small inline"
          style={{ color: 'var(--warn)' }}
          onClick={() => {
            if (!confirm(`Apagar todos os seus dados deste telemóvel? Esta ação não pode ser desfeita.${getAuth() ? '\n\nPara apagar também a conta e os dados na nuvem, use primeiro "Apagar conta" em Conta.' : ''}`)) return;
            if (getAuth()) logout();
            replace({ ...blankState(), intro: false });
            clearFiles().catch(() => undefined);
            try {
              EXTRA_KEYS.forEach((k) => localStorage.removeItem(k));
            } catch {
              /* sem armazenamento */
            }
            toast('Dados apagados.');
          }}
        >
          Apagar todos os dados
        </button>
      </div>
    </section>
  );
}
