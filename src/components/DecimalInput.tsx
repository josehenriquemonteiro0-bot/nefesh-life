import { useState, type InputHTMLAttributes } from 'react';

const show = (v?: number) => (v === undefined || Number.isNaN(v) ? '' : String(v).replace('.', ','));

/**
 * Campo numérico que aceita vírgula ou ponto enquanto se escreve
 * (ex.: "72," a caminho de "72,5") e só formata ao sair do campo.
 */
export function DecimalInput({
  value,
  onValue,
  decimals = true,
  ...rest
}: { value?: number; onValue: (v: number | undefined) => void; decimals?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(show(value));
  const [focus, setFocus] = useState(false);
  return (
    <input
      {...rest}
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={focus ? text : show(value)}
      onFocus={(e) => {
        setFocus(true);
        setText(show(value));
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        const t = e.target.value.replace(decimals ? /[^\d.,]/g : /\D/g, '');
        setText(t);
        if (t === '') return onValue(undefined);
        if (/[.,]$/.test(t)) return;
        const n = Number(t.replace(',', '.'));
        if (!Number.isNaN(n)) onValue(n);
      }}
    />
  );
}
