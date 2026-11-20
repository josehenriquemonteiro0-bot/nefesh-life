import { useEffect, useRef, useState } from 'react';
import { fmtNum } from '../domain/dates';
import { MEALS, type MealKey } from '../domain/foods';
import { PHOTO_API, type PhotoError, analyzePhoto, compressImage, mealForHour, photoEntry, type PhotoResult } from '../domain/photo';
import { useStore } from '../state/store';
import { DecimalInput } from './DecimalInput';
import { Icon } from './Icon';
import { PremiumTag } from './PremiumTag';

const CONF: Record<string, string> = { alta: 'pos-up', media: 'pos-ok', baixa: 'pos-low' };

function PhotoSheet({ onClose }: { onClose: () => void }) {
  const { S, updateToday, toast } = useStore();
  const hide = !!S.hideCalories;
  const file = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<{ data: string; media_type: 'image/jpeg' } | null>(null);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [grams, setGrams] = useState<(number | undefined)[]>([]);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [meal, setMeal] = useState<MealKey>(mealForHour(new Date().getHours()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const pick = async (f?: File) => {
    if (!f) return;
    setError(null);
    setResult(null);
    try {
      setImg(await compressImage(f));
    } catch {
      setError('Não consegui abrir esta imagem. Experimente outra foto.');
    }
  };

  const analyze = async () => {
    if (!img) return;
    setBusy(true);
    setError(null);
    try {
      const r = await analyzePhoto(img, hint);
      setResult(r);
      setGrams(r.items.map((i) => i.grams));
      setKeep(r.items.map(() => true));
    } catch (e) {
      setError((e as PhotoError).message);
    } finally {
      setBusy(false);
    }
  };

  const entries = result ? result.items.map((it, i) => (keep[i] && grams[i] ? photoEntry(it, grams[i]!) : null)).filter((e) => e !== null) : [];
  const total = entries.reduce((t, e) => t + e!.kcal, 0);
  const label = MEALS.find((m) => m[0] === meal)![1];

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Fotografar o prato">
        <div className="row">
          <h2 style={{ margin: 0 }}>Fotografar o prato</h2>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>Fechar</button>
        </div>

        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />

        {!img ? (
          <>
            <p className="small mute">Fotografe o prato de cima, com o prato inteiro à vista. A NEFESH Life estima os alimentos, as quantidades e as calorias, e pode corrigir tudo antes de guardar.</p>
            <button className="btn full" onClick={() => file.current?.click()}><Icon name="recipes" /> Tirar ou escolher foto</button>
          </>
        ) : (
          <div className="photo-prev">
            <img src={`data:${img.media_type};base64,${img.data}`} alt="Fotografia da refeição" />
            {!busy && <button className="btn ghost sm" onClick={() => file.current?.click()}>Outra foto</button>}
          </div>
        )}

        {img && !result && (
          <>
            <input className="field sm" style={{ width: '100%', margin: '12px 0 8px' }} maxLength={300} placeholder="Nota opcional (ex.: arroz integral, comi metade)" value={hint} onChange={(e) => setHint(e.target.value)} aria-label="Nota sobre a refeição" />
            <button className="btn full" disabled={busy} onClick={analyze}>
              {busy ? 'A analisar a refeição…' : 'Analisar'}
            </button>
            {busy && <div className="prog" style={{ margin: '12px 0 0' }}><i className="indeterminate" /></div>}
          </>
        )}

        {error && <p className="small warn-t" style={{ marginTop: 10 }}>{error}</p>}

        {result && !result.is_food && <p className="small" style={{ marginTop: 12 }}>Não encontrei comida nesta foto. {result.note}</p>}

        {result && result.is_food && (
          <>
            <p className="small mute" style={{ margin: '12px 0 8px' }}>
              {result.note}
              {result.remaining !== undefined && ` Restam ${result.remaining} ${result.remaining === 1 ? 'foto' : 'fotos'} hoje.`}
            </p>
            <div className="photo-items">
              {result.items.map((it, i) => {
                const e = keep[i] && grams[i] ? photoEntry(it, grams[i]!) : null;
                return (
                  <div key={i} className={`photo-item ${keep[i] ? '' : 'off'}`}>
                    <label className="row" style={{ gap: 10, flexWrap: 'nowrap', cursor: 'pointer' }}>
                      <input type="checkbox" checked={keep[i]} onChange={(ev) => setKeep(keep.map((k, j) => (j === i ? ev.target.checked : k)))} />
                      <span style={{ flex: 1 }}><b>{it.name}</b></span>
                      <span className={`pos ${CONF[it.confidence]}`}>{it.confidence === 'media' ? 'média' : it.confidence}</span>
                    </label>
                    <div className="row" style={{ marginTop: 6 }}>
                      <span className="measure-in">
                        <DecimalInput value={grams[i]} onValue={(v) => setGrams(grams.map((g, j) => (j === i ? v : g)))} aria-label={`Gramas de ${it.name}`} />g
                      </span>
                      <span className="small mute">{e ? `${hide ? '' : `${e.kcal} kcal · `}P ${fmtNum(e.p)} · H ${fmtNum(e.c)} · G ${fmtNum(e.f)}` : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="seg seg-wide" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', margin: '14px 0' }} role="group" aria-label="Refeição">
              {MEALS.map(([k, n]) => (
                <button key={k} className={meal === k ? 'on' : ''} aria-pressed={meal === k} onClick={() => setMeal(k)}>{n.replace('Pequeno-almoço', 'P. almoço')}</button>
              ))}
            </div>
            <button
              className="btn full"
              disabled={!entries.length}
              onClick={() => {
                updateToday((d) => {
                  d.meals = { ...(d.meals || {}) };
                  d.meals[meal] = [...(d.meals[meal] || []), ...(entries as NonNullable<(typeof entries)[number]>[])];
                });
                toast(`${entries.length} ${entries.length === 1 ? 'alimento adicionado' : 'alimentos adicionados'} ao ${label.toLowerCase()}${hide ? '' : ` (${total} kcal)`}.`);
                onClose();
              }}
            >
              Adicionar ao {label.toLowerCase()}{hide ? '' : ` · ${total} kcal`}
            </button>
            <p className="small mute" style={{ marginTop: 10 }}>Estimativa feita por inteligência artificial a partir da foto. Confira as quantidades: a margem de erro pode ser de 20% ou mais.</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Cartão no diário: abre a câmara, ou indica que a funcionalidade ainda não está ligada. */
export function PhotoMealCard() {
  const [open, setOpen] = useState(false);
  if (!PHOTO_API)
    return (
      <section className="card photo-soon" data-tour="foto-prato">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 200px' }}>
            <h3 style={{ margin: 0 }}>Fotografar o prato <span className="lvl lvl-seguranca" style={{ marginLeft: 6 }}>Em breve</span></h3>
            <p className="small mute" style={{ margin: '4px 0 0' }}>Tire uma foto e a NEFESH Life estima os alimentos e as calorias. Por agora, adicione os alimentos pela lista.</p>
          </div>
          <Icon name="recipes" />
        </div>
      </section>
    );
  return (
    <>
      <button className="card photo-cta" data-tour="foto-prato" onClick={() => setOpen(true)}>
        <Icon name="recipes" />
        <span>
          <b>Fotografar o prato <PremiumTag f="fotoPrato" /></b>
          <span className="small mute">Calorias e macros estimadas a partir de uma foto · até 15 por dia</span>
        </span>
      </button>
      {open && <PhotoSheet onClose={() => setOpen(false)} />}
    </>
  );
}
