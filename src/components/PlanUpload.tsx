import { useEffect, useRef, useState } from 'react';
import { shortDate, todayKey } from '../domain/dates';
import { ACCEPT_PLAN, MAX_FILE_MB, deleteFile, fileKind, loadFile, saveFile } from '../domain/files';
import { useStore } from '../state/store';
import { Icon } from './Icon';

const TEXT = {
  nutri: {
    ask: 'Tem um plano alimentar do seu nutricionista?',
    hint: 'Carregue-o aqui (PDF, Excel, Word ou fotografia) para o ter sempre à mão na NEFESH Life.',
    title: 'O meu plano alimentar',
    who: 'Nutricionista',
  },
  treino: {
    ask: 'Tem um plano de treino de um profissional?',
    hint: 'Carregue-o aqui (PDF, Excel, Word ou fotografia). Pode segui-lo em vez do plano da NEFESH Life.',
    title: 'O meu plano de treino',
    who: 'Profissional',
  },
} as const;

/** Carregar, abrir e substituir o plano do profissional. O ficheiro fica só no telemóvel. */
export function PlanUpload({ kind }: { kind: 'nutri' | 'treino' }) {
  const { S, update, toast } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [by, setBy] = useState(S.plans?.[kind]?.by ?? '');
  const meta = S.plans?.[kind];
  const t = TEXT[kind];

  // mostra a imagem do plano, se for uma fotografia
  useEffect(() => {
    let url: string | null = null;
    if (meta?.type.startsWith('image/')) {
      loadFile(kind).then((b) => {
        if (b) {
          url = URL.createObjectURL(b);
          setPreview(url);
        }
      });
    } else setPreview(null);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [kind, meta?.at, meta?.type]);

  const pick = async (f?: File) => {
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) return toast(`O ficheiro é maior do que ${MAX_FILE_MB} MB.`);
    try {
      await saveFile(kind, f);
      update((d) => { d.plans = { ...(d.plans || {}), [kind]: { name: f.name, type: f.type || '', size: f.size, at: todayKey(), by: by.trim() || undefined } }; });
      toast('Plano guardado neste telemóvel.');
    } catch {
      toast('Não foi possível guardar o ficheiro neste telemóvel.');
    }
  };

  const openFile = async () => {
    const b = await loadFile(kind).catch(() => undefined);
    if (!b || !meta) return toast('O ficheiro já não está neste telemóvel. Carregue-o de novo.');
    const url = URL.createObjectURL(new File([b], meta.name, { type: meta.type || b.type }));
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    // PDFs e imagens abrem no navegador; folhas de cálculo e documentos são descarregados
    if (!/^(application\/pdf|image\/)/.test(meta.type)) a.download = meta.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const remove = async () => {
    if (!confirm('Remover o plano deste telemóvel?')) return;
    await deleteFile(kind).catch(() => undefined);
    update((d) => { const p = { ...(d.plans || {}) }; delete p[kind]; d.plans = p; });
    toast('Plano removido.');
  };

  // plano montado no NEFESH Life Pro: não há ficheiro (o cartão do profissional mostra-o)
  if (meta?.type === 'nefesh-pro') return null;
  return (
    <section className="card plan-up">
      <input ref={input} type="file" accept={ACCEPT_PLAN} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!meta ? (
        <>
          <h3 style={{ margin: 0 }}>{t.ask}</h3>
          <p className="small mute" style={{ margin: '4px 0 10px' }}>{t.hint}</p>
          <input className="field sm" style={{ width: '100%', marginBottom: 8 }} value={by} onChange={(e) => setBy(e.target.value)} placeholder={`${t.who} (opcional, ex.: Dra. Ana Silva)`} aria-label={`Nome do ${t.who.toLowerCase()}`} />
          <button className="btn sm" onClick={() => input.current?.click()}><Icon name="bottle" /> Carregar o meu plano</button>
        </>
      ) : (
        <>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 180px' }}>
              <h3 style={{ margin: 0 }}>{t.title}</h3>
              <p className="small mute" style={{ margin: '2px 0 0' }}>
                {fileKind(meta.name, meta.type)} · {meta.name}
                <br />
                {meta.by ? `${meta.by} · ` : ''}carregado a {shortDate(meta.at)}
              </p>
            </div>
            <button className="btn sm" onClick={openFile}>Abrir</button>
          </div>
          {preview && <img className="plan-img" src={preview} alt={t.title} onClick={openFile} />}
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 10 }}>
            <button className="btn ghost sm" onClick={() => input.current?.click()}>Substituir</button>
            <button className="btn ghost sm" onClick={remove}>Remover</button>
          </div>
        </>
      )}
      <p className="small mute" style={{ margin: '10px 0 0' }}>O ficheiro fica só neste telemóvel. Não entra na cópia de segurança.</p>
    </section>
  );
}
