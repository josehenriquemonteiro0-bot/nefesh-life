import { useRef, useState } from 'react';
import { compressImage } from '../domain/photo';
import { PHOTO_LABEL, REACTIONS, deletePhoto, photoUrl, react, refresh, reportPhoto, sharePhoto, type PhotoMoment, type SocialState } from '../domain/social';
import { useStore } from '../state/store';

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`;
};

function MomentCard({ p }: { p: PhotoMoment }) {
  const { toast } = useStore();
  const [menu, setMenu] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
      refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="moment">
      <img src={photoUrl(p.id)} alt={`${PHOTO_LABEL[p.kind]} de ${p.nick}`} loading="lazy" />
      <div className="moment-info">
        <b>{p.nick}</b>
        <span className="small mute">{PHOTO_LABEL[p.kind]} · {ago(p.created)}</span>
      </div>
      <div className="react-row" style={{ margin: '6px 0 0' }}>
        {REACTIONS.map((k) => (
          <button key={k} className={`chip cheer ${p.myReaction === k ? 'on' : ''}`} disabled={p.me} onClick={() => act(() => react(p.fid, k))} aria-label={`Reagir ${k}`}>
            {k} {p.reactions[k] || ''}
          </button>
        ))}
        <button className="link small inline" onClick={() => setMenu((v) => !v)} aria-label="Mais opções">⋯</button>
      </div>
      {menu && (
        <div className="msg-pick">
          {p.me ? (
            <button className="chip" onClick={() => confirm('Apagar esta foto?') && act(() => deletePhoto(p.id), 'Foto apagada.')}>Apagar a minha foto</button>
          ) : (
            <button className="chip" onClick={() => confirm('Denunciar esta foto? Deixa de a ver e a equipa NEFESH é avisada.') && act(() => reportPhoto(p.id), 'Obrigado. A foto foi escondida e denunciada.')}>Denunciar</button>
          )}
        </div>
      )}
    </div>
  );
}

/** Momentos de hoje: fotos de toda a comunidade que desaparecem ao fim de 24 horas. */
export function Moments({ st }: { st: SocialState }) {
  const { toast } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PhotoMoment['kind'] | null>(null);
  const [busy, setBusy] = useState(false);
  const photos = st.photos ?? [];
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>📸 Momentos de hoje</h2>
        <span className="small mute">desaparecem em 24 h</span>
      </div>
      {!kind ? (
        <button className="btn sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => setKind('treino')}>{busy ? 'A rever a foto…' : 'Partilhar um momento'}</button>
      ) : (
        <div style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: '0 0 6px' }}>O que quer partilhar?</p>
          <div className="msg-pick" style={{ marginTop: 0 }}>
            {(Object.keys(PHOTO_LABEL) as PhotoMoment['kind'][]).map((k) => (
              <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{PHOTO_LABEL[k]}</button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 10 }}>
            <button className="btn sm" onClick={() => file.current?.click()}>Escolher ou tirar foto</button>
            <button className="btn ghost sm" onClick={() => setKind(null)}>Cancelar</button>
          </div>
          <p className="small mute" style={{ margin: '8px 0 0' }}>
            Toda a comunidade vê a foto durante 24 horas. A IA revê cada foto antes de a publicar. Evite fotos com outras pessoas sem a autorização delas.
          </p>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f || !kind) return;
          setBusy(true);
          const k = kind;
          setKind(null);
          try {
            const img = await compressImage(f, 720);
            const r = await sharePhoto(k, img.data);
            toast(r.note);
            if (r.ok) refresh();
          } catch (err) {
            toast((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {photos.length > 0 ? (
        <div className="moments">{photos.map((p) => <MomentCard key={p.id} p={p} />)}</div>
      ) : (
        <p className="small mute" style={{ margin: '10px 0 0' }}>Ainda ninguém partilhou um momento hoje. Seja o primeiro!</p>
      )}
    </section>
  );
}
