import { usePresentation } from '@/features/simulador/contexts/PresentationContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useSimuladorGrupos } from '@/features/simulador/hooks/useSimuladorGrupos';

const FALLBACK_IMOVEL = [
  { id: 1, term: 100, creditValue: 110000, payment: 368.39 },
  { id: 2, term: 150, creditValue: 150000, payment: 502.35 },
  { id: 3, term: 200, creditValue: 180000, payment: 602.82 },
  { id: 4, term: 200, creditValue: 200000, payment: 689.8 },
  { id: 5, term: 200, creditValue: 400000, payment: 1189.6 },
  { id: 6, term: 200, creditValue: 500000, payment: 1487 },
];
const FALLBACK_VEICULO = [
  { id: 1, term: 60, creditValue: 80000, payment: 671.28 },
  { id: 2, term: 80, creditValue: 90000, payment: 700 },
  { id: 3, term: 80, creditValue: 100000, payment: 839 },
  { id: 4, term: 80, creditValue: 120000, payment: 1006.92 },
  { id: 5, term: 80, creditValue: 150000, payment: 1258.65 },
];

/**
 * Page 3: Escolha do Grupo de Consórcio
 * Lê grupos de simulador_grupos (admin importa via PDF). Fallback para arrays hardcoded se vazio.
 */
export default function Page3Group() {
  const { state, setGroupData, setCurrentPage, calculateScenarios } = usePresentation();
  const { data: dbGrupos = [], isLoading } = useSimuladorGrupos(
    state.assetType === 'Imovel' ? 'Imovel' : 'Veiculo',
    true,
  );

  const groups = dbGrupos.length
    ? dbGrupos.map((g, i) => ({
        id: i + 1,
        term: g.term_months,
        creditValue: Number(g.credit_value),
        payment: Number(g.payment_half),
        administradora: g.administradora,
        adminFeePercent: Number(g.admin_fee_percent ?? 0),
      }))
    : (state.assetType === 'Imovel' ? FALLBACK_IMOVEL : FALLBACK_VEICULO).map((g) => ({
        ...g,
        administradora: null as string | null,
        adminFeePercent: 0,
      }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleSelectGroup = (group: (typeof groups)[0]) => {
    setGroupData(group.term, group.creditValue, group.payment, group.adminFeePercent);
  };

  const handleNext = () => {
    if (state.groupTerm > 0) {
      calculateScenarios();
      setCurrentPage(4);
    }
  };

  const isSelected = (groupId: number) => {
    const g = groups[groupId - 1];
    return (
      !!g &&
      state.groupCreditValue === g.creditValue &&
      state.groupTerm === g.term &&
      state.groupPayment === g.payment
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      

      {/* Page Title */}
      <div className="border-b border-gray-800 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-display font-bold mb-2">
            Escolha seu investimento
          </h1>
          <p className="text-gray-400">Selecione o prazo e valor que melhor se adequa</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map(group => (
              <Card
                key={group.id}
                onClick={() => handleSelectGroup(group)}
                className={`p-6 cursor-pointer transition-all duration-300 h-full flex flex-col ${
                  isSelected(group.id)
                    ? 'bg-primary/20 border-primary border-2'
                    : 'bg-gray-900 border border-gray-800 hover:border-primary/50'
                }`}
              >
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  {/* Valor do Crédito - Main highlight */}
                  <div className="pb-4 border-b-2 border-primary/30">
                    <p className="text-xs text-gray-400 mb-1 font-semibold">
                      Valor do crédito
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(group.creditValue)}
                    </p>
                  </div>

                  {/* Valor da Parcela */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-semibold">
                      Valor da parcela (meia parcela)
                    </p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(group.payment)}
                    </p>
                  </div>

                  {/* Prazo */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-semibold">
                      Prazo do grupo
                    </p>
                    <p className="text-lg font-bold text-white">{group.term} meses</p>
                  </div>

                  {group.adminFeePercent > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1 font-semibold">
                        Taxa de administração
                      </p>
                      <p className="text-sm font-semibold text-primary">
                        {group.adminFeePercent.toFixed(2).replace('.', ',')}%
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-800 px-6 py-6">
        <div className="max-w-6xl mx-auto flex gap-4">
          <Button
            onClick={() => setCurrentPage(2)}
            variant="outline"
            className="flex-1 border-primary text-primary hover:bg-primary/10"
          >
            <ChevronLeft className="w-5 h-5 mr-2" /> Voltar
          </Button>
          <Button
            onClick={handleNext}
            disabled={state.groupTerm <= 0}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próximo <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
