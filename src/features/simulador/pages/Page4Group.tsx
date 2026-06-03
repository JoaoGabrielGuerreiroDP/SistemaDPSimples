import { usePresentation } from '@/features/simulador/contexts/PresentationContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/features/simulador/lib/consortiumCalculations';

/**
 * Page 4: Cenários de Contemplação
 * User selects contemplation month and views scenarios
 */
export default function Page4Contemplation() {
  const { state, setContemplationMonth, calculateScenarios, selectScenario, setCurrentPage } =
    usePresentation();
  const [selectedMonth, setSelectedMonth] = useState(state.contemplationMonth || 1);

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setContemplationMonth(month);
    calculateScenarios();
  };

  const handleSelectScenario = (scenarioKey: 'lottery' | 'embeddedBid' | 'appreciation') => {
    selectScenario(scenarioKey);
  };

  const handleNext = () => {
    if (state.selectedScenario) {
      setCurrentPage(6);
    }
  };

  const monthOptions = Array.from({ length: state.groupTerm }, (_, i) => i + 1);
  const result = state.simulationResult;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      

      {/* Page Title */}
      <div className="border-b border-gray-800 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-display font-bold mb-4">Cenários de contemplação</h1>
          <p className="text-gray-400">Selecione o mês de contemplação para visualizar os cenários</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Month Selection */}
          <div className="space-y-4">
            <label className="block text-lg font-semibold text-gray-300">Mês de contemplação</label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            >
              {monthOptions.map(month => (
                <option key={month} value={month}>
                  Mês {month}
                </option>
              ))}
            </select>
          </div>

          {/* Summary Information */}
          {result && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gray-800 border-gray-700 p-6">
                <p className="text-xs text-gray-400 mb-2">Crédito inicial</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(result.initialCredit)}</p>
              </Card>
              <Card className="bg-gray-800 border-gray-700 p-6">
                <p className="text-xs text-gray-400 mb-2">Crédito atualizado (mês {result.selectedMonth})</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(result.updatedCredit)}</p>
              </Card>
              <Card className="bg-gray-800 border-gray-700 p-6">
                <p className="text-xs text-gray-400 mb-2">Valorização acumulada</p>
                <p className="text-2xl font-bold text-green-400">
                  {result.appreciationPercent.toFixed(1)}%
                </p>
              </Card>
            </div>
          )}

          {/* Scenarios */}
          {result && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Opções de contemplação</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Scenario 1: Lottery */}
                <Card
                  className={`bg-gray-800 border-2 p-6 cursor-pointer transition-all ${
                    state.selectedScenario === 'lottery'
                      ? 'border-primary'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => handleSelectScenario('lottery')}
                >
                  <h3 className="font-bold text-lg mb-4">{result.scenarios.lottery.name}</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-400">Crédito recebido</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(result.scenarios.lottery.creditReceived)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Parcela mensal</p>
                      <p className="font-bold">{formatCurrency(result.scenarios.lottery.monthlyPayment)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total pago</p>
                      <p className="font-bold">{formatCurrency(result.scenarios.lottery.totalPaid)}</p>
                    </div>
                  </div>
                </Card>

                {/* Scenario 2: Embedded Bid */}
                <Card
                  className={`bg-gray-800 border-2 p-6 cursor-pointer transition-all ${
                    state.selectedScenario === 'embeddedBid'
                      ? 'border-primary'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => handleSelectScenario('embeddedBid')}
                >
                  <h3 className="font-bold text-lg mb-4">{result.scenarios.embeddedBid.name}</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-400">Crédito recebido</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(result.scenarios.embeddedBid.creditReceived)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Lance embutido</p>
                      <p className="font-bold text-green-400">
                        {formatCurrency(result.scenarios.embeddedBid.savings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total pago</p>
                      <p className="font-bold">{formatCurrency(result.scenarios.embeddedBid.totalPaid)}</p>
                    </div>
                  </div>
                </Card>

                {/* Scenario 3: Appreciation */}
                <Card
                  className={`bg-gray-800 border-2 p-6 cursor-pointer transition-all ${
                    state.selectedScenario === 'appreciation'
                      ? 'border-primary'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  onClick={() => handleSelectScenario('appreciation')}
                >
                  <h3 className="font-bold text-lg mb-4">{result.scenarios.appreciation.name}</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-400">Crédito recebido</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(result.scenarios.appreciation.creditReceived)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Ganho de valorização</p>
                      <p className="font-bold text-green-400">
                        {formatCurrency(result.scenarios.appreciation.savings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total pago</p>
                      <p className="font-bold">{formatCurrency(result.scenarios.appreciation.totalPaid)}</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-gray-800 px-6 py-6 flex gap-4 justify-between">
        <Button
          onClick={() => setCurrentPage(3)}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Button
          onClick={handleNext}
          disabled={!state.selectedScenario}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-gray-950 font-bold"
        >
          Próximo
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
