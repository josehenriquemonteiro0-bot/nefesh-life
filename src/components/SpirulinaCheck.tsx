import { useRef, useState } from 'react';
import { useAuth } from '../domain/account';
import { todayKey } from '../domain/dates';
import { compressImage } from '../domain/photo';
import { proveSpirulina, refresh, useSocial } from '../domain/social';
import { useStore } from '../state/store';
import { pushPoints } from '../state/socialSync';

/**
 * Dia de verificação (cerca de 1 em cada 7, ao acaso): depois de marcar a toma,
 * a pessoa fotografa a Spirulina. Sem foto, a Spirulina desse dia conta como declarada.
 */
export function SpirulinaCheck() {
  const { S, todayLog, toast } = useStore();
  const auth = useAuth();
  const { state: st } = useSocial(auth && S.community ? 120_000 : Infinity);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const v = st?.verify;
  const tookSome = (todayLog.doses ?? []).some(Boolean);
  if (!auth || !S.community || !v?.checkDay || v.spirulinaPhoto || !tookSome) return null;
  return (
    <section className="card due">
      <h2 style={{ marginTop: 0 }}>📸 Hoje é dia de verificação</h2>
      <p className="small mute" style={{ marginTop: 0 }}>
        De vez em quando pedimos uma foto da sua Spirulina (cápsulas na mão, pó no copo ou o frasco). Assim os pontos de todos são justos. Sem foto, a Spirulina de hoje conta como declarada.
      </p>
      {note && <p className="small key-warn">{note}</p>}
      <button className="btn sm" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'A verificar…' : 'Fotografar a minha Spirulina'}</button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            const img = await compressImage(f, 768);
            const r = await proveSpirulina(img.data, img.media_type);
            setNote(r.ok ? null : r.note);
            if (r.ok) {
              toast('Spirulina verificada ✅');
              await pushPoints(S, true);
            }
            await refresh();
          } catch (err) {
            setNote((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <p className="small mute" style={{ margin: '8px 0 0' }}>A foto é analisada e não fica guardada. Dia {todayKey().split('-').reverse().join('/')}.</p>
    </section>
  );
}
