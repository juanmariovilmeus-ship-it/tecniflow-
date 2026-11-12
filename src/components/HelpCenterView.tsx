import React, { useState, useMemo } from 'react';
import { HELP_FAQ_ITEMS, FaqItem } from '../data/helpKnowledge';
import {
  HelpCircle,
  Search,
  Bot,
  Send,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  MessageSquare,
  Clock,
  Layers,
  Wrench
} from 'lucide-react';

export const HelpCenterView: React.FC = () => {
  // Estado do FAQ
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('os-nova');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  // Filtro de FAQ em tempo real
  const filteredFaq = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return HELP_FAQ_ITEMS.filter((item) => {
      const matchCat = selectedCategory === 'todas' || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;

      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Header da Central de Ajuda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-600 flex items-center justify-center font-bold">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Central de Ajuda TecniFlow</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulte as Perguntas Frequentes para aprender a usar o TecniFlow.
              </p>
            </div>
          </div>
        </div>

        <button type="button" className="self-start text-xs text-teal-700 underline" onClick={() => handleCopyText('Preciso de ajuda com o TecniFlow.\nTela em que ocorreu: \nO que tentei fazer: \nO que aconteceu: \nNão incluir senhas ou dados de clientes.', 'support-request')}>
          {copiedId === 'support-request' ? 'Pedido copiado' : 'Copiar pedido de ajuda'}
        </button>
      </div>
        <div className="space-y-6">
          {/* Barra de Pesquisa e Filtros */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por dúvida, termo ou recurso (ex: Nova OS, Kiwify, Logotipo, Status)..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-slate-50/50"
              />
            </div>

            {/* Categorias */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'todas', label: 'Todas as Dúvidas' },
                { id: 'os', label: 'Ordens de Serviço' },
                { id: 'clientes', label: 'Clientes' },
                { id: 'estoque', label: 'Estoque' },
                { id: 'relatorios', label: 'Relatórios' },
                { id: 'assinatura', label: 'Minha Assinatura' },
                { id: 'configuracoes', label: 'Configurações' },
                { id: 'geral', label: 'Acesso e Segurança' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Artigos Accordion */}
          {filteredFaq.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">Nenhum artigo encontrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Não encontramos respostas para "{searchQuery}". Tente outros termos ou utilize o Assistente Virtual.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('todas');
                }}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 underline"
              >
                Limpar filtros de busca
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFaq.map((item) => {
                const isExpanded = expandedFaqId === item.id;
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedFaqId(isExpanded ? null : item.id)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                          {item.categoryLabel}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                          {item.question}
                        </span>
                      </div>
                      <div className="text-slate-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/40">
                        <p className="whitespace-pre-line">{item.answer}</p>
                        <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Informação oficial do sistema TecniFlow</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(item.answer, item.id)}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-teal-600 transition-colors"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-teal-600" />
                                <span className="text-teal-600 font-medium">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar resposta</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </div>
  );
};
