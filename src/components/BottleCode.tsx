import { useState } from 'react';
import { getAuth } from '../domain/account';
import { todayKey } from '../domain/dates';
import { PRODUCTS, capsEquivalent, type ProductId } from '../domain/lots';
import { registerBottle } from '../domain/social';
import { useStore } from '../state/store';

const PENDING = 'nefesh-life-frasco';

/** Guarda um código recebido por link enquanto a pessoa ainda não entrou na conta. */
export const savePendingCode = (code: string) => {
  try {
    localStorage.setItem(PENDING, code);
  } catch {
    /* sem armazenamento */
  }
};
export const takePendingCode = () => {
  try {
    const c = localStorage.getItem(PENDING);
    localStorage.removeItem(PENDING);
    return c;
  } catch {
    return null;
  }
};

/** Regista um frasco pelo código único: soma ao stock e conta para os pontos verificados. */
export function useRedeemBottle() {
  const { S, update, toast } = useStore();
  return async (raw: string) => {
    const code = raw.trim();
    if (!code) return false;
    if (!getAuth()) {
      toast('Para registar o frasco, entre na sua conta (Perfil → Conta).');
      return false;
    }
    try {
      const r = await registerBottle(code, S.format ?? 'caps');
      if (!r.verified) {
        toast(r.note ?? 'Código não reconhecido.');
        return false;
      }
      const product = ((r as { product?: string }).product ?? S.format ?? 'caps') as ProductId;
      update((d) => {
        d.stockCaps += capsEquivalent(product);
        d.bottles = [...(d.bottles || []), { at: todayKey(), product, code: code.toUpperCase(), url: null }];
      });
      toast(`Frasco verificado ✅ ${PRODUCTS[product].name} adicionado ao stock.`);
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  };
}

/** Campo "Tenho um código de frasco" (código enviado por WhatsApp ou e-mail). */
export function BottleCodeForm() {
  const redeem = useRedeemBottle();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button className="link small inline" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        Tenho um código de frasco
      </button>
    );
  return (
    <form
      className="row"
      style={{ gap: 8, marginTop: 12 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await redeem(code)) {
          setCode('');
          setOpen(false);
        }
        setBusy(false);
      }}
    >
      <input className="field sm" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="NEF-XXXX-XXXX" maxLength={14} aria-label="Código do frasco" autoCapitalize="characters" />
      <button className="btn sm" disabled={busy || code.replace(/[^A-Z0-9]/gi, '').length < 11}>{busy ? 'A verificar…' : 'Registar'}</button>
    </form>
  );
}
