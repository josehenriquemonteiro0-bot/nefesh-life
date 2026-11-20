import { useRef } from 'react';
import { Icon } from './Icon';
import { useStore } from '../state/store';

/** Reduz a foto a um quadrado de 192 px (cerca de 10 KB), para caber nos dados e na conta. */
async function squareThumb(file: File, size = 192): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('Não foi possível abrir esta imagem.'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Foto (ou inicial) da pessoa. */
export function AvatarImg({ size = 36 }: { size?: number }) {
  const { S } = useStore();
  const name = S.ans?.name?.trim();
  if (S.avatar) return <img className="avatar-img" src={S.avatar} alt="" width={size} height={size} />;
  return name ? <>{name[0].toUpperCase()}</> : <Icon name="user" />;
}

/** Foto de perfil com opção de mudar ou remover. */
export function AvatarEdit() {
  const { S, update, toast } = useStore();
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="avatar-edit">
      <button className="avatar big" onClick={() => file.current?.click()} aria-label={S.avatar ? 'Mudar a foto' : 'Pôr uma foto'}>
        <AvatarImg size={72} />
        <span className="cam"><Icon name="cam" width={2} /></span>
      </button>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const data = await squareThumb(f);
            update((d) => { d.avatar = data; });
            toast('Foto atualizada.');
          } catch (err) {
            toast((err as Error).message);
          }
        }}
      />
      {S.avatar && <button className="link small inline" onClick={() => update((d) => { delete d.avatar; })}>remover foto</button>}
    </div>
  );
}
