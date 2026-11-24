import { Component, type ReactNode } from 'react';
import { reportCrash } from '../domain/crash';

/** Se um ecrã falhar, mostra uma mensagem em vez de um ecrã em branco, e avisa a equipa (anónimo). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportCrash(error, 'ecra');
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card" role="alert" style={{ margin: 24 }}>
        <h2 style={{ marginTop: 0 }}>Algo correu mal neste ecrã</h2>
        <p className="small">A equipa NEFESH já recebeu um aviso automático (sem os seus dados). Os seus registos estão guardados.</p>
        <button className="btn" onClick={() => location.reload()}>Voltar a abrir</button>
      </div>
    );
  }
}
