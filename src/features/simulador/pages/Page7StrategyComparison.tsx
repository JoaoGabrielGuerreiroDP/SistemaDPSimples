import { usePresentation } from '@/features/simulador/contexts/PresentationContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, Award, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function Page7StrategyComparison() {
  const { state, setCurrentPage } = usePresentation();
  const result = state.simulationResult;

  if (!result) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Nenhuma simulação disponível</p>
      </div>
    );
  }

  const creditValue = result.initialCredit;
  const monthlyPayment = result.initialPayment;
  const termMonths = state.groupTerm;

  // Calculate scenarios for months 12, 24, 36
  const scenarioMonths = [12, 24, 36];

  const calculateScenario = (contemplationMonth: number) => {
    // Calculate total paid up to contemplation month (with 5% annual adjustment)
    let totalPaid = 0;
    for (let month = 1; month <= contemplationMonth; month++) {
      const yearsPassed = Math.floor((month - 1) / 12);
      const adjustedPayment = monthlyPayment * Math.pow(1.05, yearsPassed);
      totalPaid += adjustedPayment;
    }

    // Calculate credit with 5% annual appreciation
    const yearsAtContemplation = contemplationMonth / 12;
    const creditCorrigido = creditValue * Math.pow(1.05, yearsAtContemplation);

    // Calculate net patrimony
    const patrimonioLiquido = creditCorrigido - totalPaid;

    return {
      month: contemplationMonth,
      totalPaid,
      creditCorrigido,
      patrimonioLiquido,
    };
  };

  // Generate scenarios
  const scenarios = scenarioMonths.map(month => calculateScenario(month));

  // Find best scenario (highest net patrimony)
  const bestScenario = scenarios.reduce((best, current) =>
    current.patrimonioLiquido > best.patrimonioLiquido ? current : best
  );

  // Generate chart data
  const chartData = [];
  for (let month = 1; month <= termMonths; month += 3) {
    let totalPaid = 0;
    for (let m = 1; m <= month; m++) {
      const yearsPassed = Math.floor((m - 1) / 12);
      const adjustedPayment = monthlyPayment * Math.pow(1.05, yearsPassed);
      totalPaid += adjustedPayment;
    }

    const yearsAtMonth = month / 12;
    const creditAtMonth = creditValue * Math.pow(1.05, yearsAtMonth);

    chartData.push({
      month,
      totalPago: totalPaid,
      creditoValorizado: creditAtMonth,
      patrimonioLiquido: creditAtMonth - totalPaid,
    });
  }

  return (
    <div className="min-h-screen bg-black text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-primary mb-3">Comparação de Estratégias</h1>
          <p className="text-gray-400">Analise qual momento de contemplação gera mais patrimônio</p>
        </div>

        {/* Best Strategy Highlight */}
        <div className="mb-12 bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border-2 border-yellow-600/50 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-8 h-8 text-yellow-400" />
            <h2 className="text-2xl font-bold text-yellow-400">Estratégia Mais Eficiente</h2>
          </div>
          <p className="text-lg text-gray-300 mb-2">
            Contemplação no <span className="font-bold text-yellow-400">mês {bestScenario.month}</span>
          </p>
          <p className="text-gray-400">
            Gera um patrimônio líquido de <span className="font-bold text-yellow-300">{formatCurrency(bestScenario.patrimonioLiquido)}</span>
          </p>
        </div>

        {/* Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {scenarios.map((scenario, index) => {
            const isBest = scenario.month === bestScenario.month;
            const cardClass = isBest
              ? 'ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/20'
              : '';

            return (
              <div
                key={index}
                className={`rounded-2xl p-8 border-2 transition-all ${cardClass} ${
                  isBest
                    ? 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border-yellow-600/50'
                    : 'bg-gradient-to-br from-gray-800/20 to-gray-700/10 border-gray-600/50 hover:border-gray-500'
                }`}
              >
                {isBest && (
                  <div className="mb-4 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                    ⭐ Melhor Cenário
                  </div>
                )}

                <div className="space-y-6">
                  {/* Month */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Mês de Contemplação</p>
                    <p className="text-4xl font-bold text-primary animate-number-update">{scenario.month}</p>
                    <p className="text-xs text-gray-500 mt-1">{(scenario.month / 12).toFixed(1)} anos</p>
                  </div>

                  {/* Total Paid */}
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Total Pago</p>
                    <p className="text-2xl font-bold text-red-400 animate-number-update">
                      {formatCurrency(scenario.totalPaid)}
                    </p>
                  </div>

                  {/* Credit Value */}
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Crédito Corrigido</p>
                    <p className="text-2xl font-bold text-green-400 animate-number-update">
                      {formatCurrency(scenario.creditCorrigido)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">+5% ao ano</p>
                  </div>

                  {/* Net Patrimony */}
                  <div className={`pt-4 border-t-2 rounded-lg p-4 ${
                    isBest
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-blue-500 bg-blue-500/10'
                  }`}>
                    <p className={`text-xs mb-2 font-semibold uppercase tracking-wide ${
                      isBest ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      Patrimônio Líquido
                    </p>
                    <p className={`text-3xl font-bold animate-number-update ${
                      isBest ? 'text-yellow-300' : 'text-blue-400'
                    }`}>
                      {formatCurrency(scenario.patrimonioLiquido)}
                    </p>
                  </div>

                  {/* Efficiency */}
                  <div className="pt-4 border-t border-gray-700 bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-300">
                      <strong>Eficiência:</strong> {((scenario.patrimonioLiquido / scenario.totalPaid) * 100).toFixed(1)}% de retorno sobre investimento
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart Section */}
        <div className="mb-12 bg-gradient-to-br from-gray-800/30 to-gray-900/30 border border-gray-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-primary mb-6">Evolução Temporal</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
              <XAxis 
                dataKey="month" 
                stroke="#a0a0a0"
                label={{ value: 'Meses', position: 'insideBottomRight', offset: -5 }}
              />
              <YAxis 
                stroke="#a0a0a0"
                label={{ value: 'Valor (R$)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value: any) => formatCurrency(typeof value === 'number' ? value : 0)}
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #404040' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="totalPago" 
                stroke="#ef4444" 
                name="Total Pago"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="creditoValorizado" 
                stroke="#22c55e" 
                name="Crédito Valorizado"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="patrimonioLiquido" 
                stroke="#C9A961" 
                name="Patrimônio Líquido"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Section */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-600/50 rounded-xl p-6">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Investimento Mínimo</p>
            <p className="text-2xl font-bold text-red-400">
              {formatCurrency(Math.min(...scenarios.map(s => s.totalPaid)))}
            </p>
            <p className="text-xs text-gray-500 mt-2">Mês {scenarios.find(s => s.totalPaid === Math.min(...scenarios.map(s => s.totalPaid)))?.month}</p>
          </div>

          <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-600/50 rounded-xl p-6">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Máximo Patrimônio</p>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(Math.max(...scenarios.map(s => s.patrimonioLiquido)))}
            </p>
            <p className="text-xs text-gray-500 mt-2">Mês {scenarios.find(s => s.patrimonioLiquido === Math.max(...scenarios.map(s => s.patrimonioLiquido)))?.month}</p>
          </div>

          <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-600/50 rounded-xl p-6">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Melhor ROI</p>
            <p className="text-2xl font-bold text-blue-400">
              {((bestScenario.patrimonioLiquido / bestScenario.totalPaid) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">Retorno sobre investimento</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => setCurrentPage(6)}
            variant="outline"
            className="px-8 py-3 border-gray-700 text-gray-300 hover:bg-gray-900 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <Button
            onClick={() => setCurrentPage(1)}
            className="px-8 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-bold flex items-center gap-2"
          >
            Nova simulação <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
