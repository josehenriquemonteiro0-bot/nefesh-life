import { useState } from 'react';
import { SLIDES } from '../domain/content';
import { Icon } from './Icon';

export function Intro({ hasPlan, onDone }: { hasPlan: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    setLeaving(true);
    window.setTimeout(onDone, 450);
  };
  const cls = `intro ${leaving ? 'out' : ''}`;

  if (step === 0)
    return (
      <div className={cls} role="dialog" aria-label="Boas-vindas">
        <div className="inner">
          <div className="mark"><i /><i /><i /><img src="/brand/mark.png" alt="" /></div>
          <img className="word" src="/brand/wordmark.png" alt="nefesh" />
          <p className="rise d1 life">LIFE</p>
          <h1 className="rise d1">Bem-vindo ao seu ritual de Spirulina</h1>
          <p className="rise d2">Nutrição inteligente, produzida em Portugal e feita à sua medida.</p>
        </div>
        <div className="actions rise d2"><button className="btn full" onClick={() => setStep(1)}>Começar</button></div>
      </div>
    );

  const [icon, title, text] = SLIDES[step - 1];
  const last = step === SLIDES.length;
  return (
    <div className={cls} role="dialog" aria-label="Boas-vindas">
      <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="skip" onClick={close}>Saltar</button>
      </div>
      <div className="inner" key={step}>
        <div className="feat"><Icon name={icon} color="#00FE8A" width={1.4} /></div>
        <h1 className="rise">{title}</h1>
        <p className="rise">{text}</p>
      </div>
      <div className="actions">
        <div className="dotsx">{SLIDES.map((_, i) => <i key={i} className={i === step - 1 ? 'on' : ''} />)}</div>
        <button className="btn full" onClick={() => (last ? close() : setStep(step + 1))}>
          {last ? (hasPlan ? 'Entrar' : 'Fazer a minha avaliação') : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
