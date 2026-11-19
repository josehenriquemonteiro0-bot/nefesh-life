import { useRef, useState } from 'react';
import { APP_VERSION, whatsappLink } from '../domain/content';
import { backupFileName, makeBackup, readBackup } from '../domain/backup';
import { blankState } from '../domain/sample';
import { useStore } from '../state/store';
import { PrivacyText } from './Consent';

/** Os meus dados: cópia de segurança, recuperação, privacidade e opinião. */
export function DataCard() {
  const { S, replace, toast } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

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
      <p className="small mute">Os seus dados ficam só neste telemóvel. Se apagar a app, perdem-se: guarde uma cópia de vez em quando (no iCloud, no e-mail ou no WhatsApp).</p>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button className="btn sm" onClick={save}>Guardar cópia</button>
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
            if (!confirm('Apagar todos os seus dados deste telemóvel? Esta ação não pode ser desfeita.')) return;
            replace({ ...blankState(), intro: false });
            toast('Dados apagados.');
          }}
        >
          Apagar todos os dados
        </button>
      </div>
    </section>
  );
}
