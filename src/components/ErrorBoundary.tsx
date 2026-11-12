import React, { Component, ErrorInfo, ReactNode } from 'react';
import { recordTechnicalError } from '../lib/telemetry';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  resetKey?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  correlationId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      correlationId: '',
    };
  }

  static getDerivedStateFromError(): State {
    const correlationId = crypto.randomUUID();
    return {
      hasError: true,
      correlationId,
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Registra falha técnica estruturada no Supabase sem dados pessoais ou formulários
    recordTechnicalError({
      area: 'ui',
      code: 'UI_RENDER_CRASH',
      severity: 'error',
      correlationId: this.state.correlationId,
    });
  }

  componentDidUpdate(prevProps: Props): void {
    // Ao alternar usuário, empresa ou tela (mudança de resetKey), descarta o erro automaticamente
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.handleReset();
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      correlationId: '',
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Ocorreu uma falha inesperada nesta tela
            </h3>

            <p className="text-sm text-slate-600 mb-4">
              Não foi possível exibir esta tela. Tente novamente. Informações ainda não salvas podem precisar ser preenchidas outra vez.
            </p>

            {this.state.correlationId && (
              <div className="bg-slate-50 border border-slate-200 rounded p-2 mb-6">
                <span className="text-xs text-slate-500 block mb-0.5">Identificador de suporte técnico:</span>
                <code className="text-xs font-mono text-slate-700 select-all font-semibold">
                  {this.state.correlationId}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>

              <button
                type="button"
                onClick={() => {
                  this.handleReset();
                  window.location.hash = '';
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Home className="w-4 h-4" />
                Voltar ao início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
