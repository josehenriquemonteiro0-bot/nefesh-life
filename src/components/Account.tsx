import { useState } from 'react';
import { AccountError, deleteAccount, login, logout, recover, register, setAuth, syncedLabel, useAuth } from '../domain/account';
import { useStore } from '../state/store';

type Mode = 'criar' | 'entrar' | 'recuperar';

/** Mostra o código de recuperação uma única vez, com opções para o guardar. */
function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const { toast } = useStore();
  const [saved, setSaved] = useState(false);
  const text = `Código de recuperação da NEFESH Life: ${code}`;
  return (
    <>
      <h1>Guarde o seu código de recuperação</h1>
      <p className="mute">Se esquecer a palavra-passe, é com este código que a recupera. Só o mostramos agora.</p>
      <section className="card" style={{ textAlign: 'center' }}>
        <p className="code-big">{code}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <button
            className="btn ghost sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                toast('Código copiado.');
              } catch {
                toast('Selecione o código e copie.');
              }
            }}
          >
            Copiar
          </button>
          {'share' in navigator && (
            <button className="btn ghost sm" onClick={() => navigator.share({ text }).catch(() => undefined)}>Partilhar</button>
          )}
        </div>
        <p className="small mute" style={{ margin: '12px 0 0' }}>Sugestão: guarde-o nas Notas, numa fotografia ou envie-o para si por e-mail.</p>
      </section>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>Guardei o código num sítio seguro.</span>
      </label>
      <button className="btn full" style={{ marginTop: 16 }} disabled={!saved} onClick={onDone}>Continuar</button>
    </>
  );
}

/** Criar conta, entrar ou recuperar a palavra-passe. */
export function AccountScreen({ initial = 'criar', onDone, onSkip, save }: { initial?: Mode; onDone: (r: { updatedAt: string | null; isNew: boolean }) => void; onSkip?: () => void; save?: boolean }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [recovery, setRecovery] = useState<{ code: string; updatedAt: string | null; isNew: boolean } | null>(null);

  if (recovery) return <RecoveryCode code={recovery.code} onDone={() => onDone(recovery)} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.length < 8) return setError('A palavra-passe precisa de pelo menos 8 caracteres.');
    setBusy(true);
    try {
      const r = mode === 'criar' ? await register(email, pw) : mode === 'entrar' ? await login(email, pw) : await recover(email, code, pw);
      setAuth({ email: r.email, token: r.token, cloudAt: null });
      if (r.recovery) setRecovery({ code: r.recovery, updatedAt: r.updatedAt, isNew: mode === 'criar' });
      else onDone({ updatedAt: r.updatedAt, isNew: false });
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'Não foi possível concluir. Tente outra vez.');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'criar' ? (save ? 'Guarde o seu plano' : 'Crie a sua conta') : mode === 'entrar' ? 'Entrar na sua conta' : 'Recuperar a palavra-passe';
  return (
    <>
      <h1>{title}</h1>
      <p className="mute">
        {mode === 'criar'
          ? save
            ? 'O seu plano está pronto. Crie a conta para não o perder se trocar de telemóvel e para entrar na comunidade NEFESH.'
            : 'Com uma conta, o seu plano e o seu progresso ficam guardados na nuvem e voltam se trocar de telemóvel.'
          : mode === 'entrar'
            ? 'Os seus dados voltam para este telemóvel.'
            : 'Use o código de recuperação que guardou quando criou a conta.'}
      </p>
      {mode !== 'recuperar' && (
        <div className="seg acc-seg" role="group" aria-label="Conta" style={{ marginBottom: 14 }}>
          <button type="button" className={mode === 'criar' ? 'on' : ''} aria-pressed={mode === 'criar'} onClick={() => { setMode('criar'); setError(''); }}>Criar conta</button>
          <button type="button" className={mode === 'entrar' ? 'on' : ''} aria-pressed={mode === 'entrar'} onClick={() => { setMode('entrar'); setError(''); }}>Já tenho conta</button>
        </div>
      )}
      <form className="card form" onSubmit={submit}>
        <label className="afield">
          <span>E-mail</span>
          <input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.pt" />
        </label>
        {mode === 'recuperar' && (
          <label className="afield">
            <span>Código de recuperação</span>
            <input autoCapitalize="characters" autoComplete="off" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" />
          </label>
        )}
        <label className="afield">
          <span>{mode === 'recuperar' ? 'Nova palavra-passe' : 'Palavra-passe'}</span>
          <div className="pw">
            <input
              type={show ? 'text' : 'password'}
              autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="pelo menos 8 caracteres"
            />
            <button type="button" className="link small" onClick={() => setShow((v) => !v)}>{show ? 'esconder' : 'mostrar'}</button>
          </div>
        </label>
        {error && <p className="small err" role="alert">{error}</p>}
        <button className="btn full" disabled={busy}>
          {busy ? 'Um momento…' : mode === 'criar' ? 'Criar conta' : mode === 'entrar' ? 'Entrar' : 'Mudar a palavra-passe'}
        </button>
        {mode === 'entrar' && <button type="button" className="link small inline" style={{ marginTop: 12 }} onClick={() => { setMode('recuperar'); setError(''); }}>Esqueci-me da palavra-passe</button>}
        {mode === 'recuperar' && <button type="button" className="link small inline" style={{ marginTop: 12 }} onClick={() => { setMode('entrar'); setError(''); }}>Voltar a entrar</button>}
      </form>
      {mode === 'criar' && <p className="small mute">Guardamos o e-mail e os dados da app num servidor na Cloudflare. A palavra-passe nunca é guardada: só uma impressão cifrada dela.</p>}
      {onSkip && (
        <p style={{ textAlign: 'center' }}>
          <button className="skip" onClick={onSkip}>{save ? 'Agora não' : 'Continuar sem conta'}</button>
        </p>
      )}
    </>
  );
}

/** Cartão da conta no Perfil. */
export function AccountCard({ openAccount, syncNow }: { openAccount: () => void; syncNow: () => Promise<void> }) {
  const auth = useAuth();
  const { toast } = useStore();
  const [deleting, setDeleting] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  if (!auth)
    return (
      <section className="card">
        <h2>Conta</h2>
        <p className="small mute" style={{ marginTop: 0 }}>Crie uma conta para guardar o seu plano e o seu progresso na nuvem. Assim não perde nada se trocar ou perder o telemóvel.</p>
        <button className="btn sm" onClick={openAccount}>Criar conta ou entrar</button>
      </section>
    );

  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Conta</h2>
        <span className="small mute">{auth.email}</span>
      </div>
      <p className="small mute">Guardado na nuvem: {syncedLabel(auth.syncedAt)}. Os ficheiros dos planos (PDF, fotos) ficam só neste telemóvel.</p>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button
          className="btn sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await syncNow();
              toast('Dados guardados na nuvem.');
            } catch (e) {
              toast((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar agora
        </button>
        <button
          className="btn ghost sm"
          onClick={async () => {
            if (!confirm('Sair da conta? Os dados continuam neste telemóvel e na nuvem.')) return;
            await logout();
            toast('Saiu da conta.');
          }}
        >
          Sair
        </button>
        <button className="link small inline" style={{ color: 'var(--warn)' }} onClick={() => setDeleting((v) => !v)}>Apagar conta</button>
      </div>
      {deleting && (
        <div className="reset-confirm" style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: '0 0 8px' }}>Apaga a conta e os dados da nuvem. Os dados deste telemóvel ficam. Confirme com a palavra-passe:</p>
          <div className="row" style={{ gap: 8 }}>
            <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Palavra-passe" style={{ flex: '1 1 140px' }} />
            <button
              className="btn sm danger"
              disabled={busy || !pw}
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteAccount(pw);
                  toast('Conta apagada.');
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Apagar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Escolha quando este telemóvel e a nuvem têm dados diferentes. */
export function ConflictSheet({ cloudAt, localAt, onPick }: { cloudAt: string; localAt?: string; onPick: (v: 'nuvem' | 'local') => void }) {
  return (
    <div className="modal show">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Que dados usar">
        <h2>Que dados quer usar?</h2>
        <p className="small mute">A sua conta e este telemóvel têm dados diferentes. Escolha os que ficam; os outros são substituídos.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn full" onClick={() => onPick('nuvem')}>Os da conta (alterados {syncedLabel(cloudAt)})</button>
          <button className="btn ghost full" onClick={() => onPick('local')}>Os deste telemóvel (alterados {syncedLabel(localAt)})</button>
        </div>
      </div>
    </div>
  );
}
