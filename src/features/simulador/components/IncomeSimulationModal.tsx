import { useState } from 'react';
import { X, TrendingUp, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface IncomeSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvestment: number;
  monthlyPayment: number;
  monthlyRate?: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function IncomeSimulationModal({
  isOpen,
  onClose,
  initialInvestment,
  monthlyPayment,
  monthlyRate = 0.01,
}: IncomeSimulationModalProps) {
  const [selectedScenario, setSelectedScenario] = useState<12 | 24 | 36 | 60>(12);
  const [showReinvestmentAnalysis, setShowReinvestmentAnalysis] = useState(false);

  if (!isOpen) return null;

  // Calculate compound interest for different scenarios
  const scenarios = [12, 24, 36, 60] as const;
  
  const calculateScenario = (months: number) => {
    let accumulatedValue = initialInvestment;
    const monthlyIncome = initialInvestment * monthlyRate;
    const chartData = [];

    // Generate chart data points every 3 months
    for (let month = 0; month <= months; month += 3) {
      if (month === 0) {
        chartData.push({
          month: 0,
          accumulated: initialInvestment,
          totalIncome: 0,
        });
      } else {
        const accumulated = initialInvestment * Math.pow(1 + monthlyRate, month);
        const totalIncome = (accumulated - initialInvestment);
        chartData.push({
          month,
          accumulated,
          totalIncome,
        });
      }
    }

    // Final value
    const finalAccumulated = initialInvestment * Math.pow(1 + monthlyRate, months);
    const totalIncomeGenerated = finalAccumulated - initialInvestment;
    const monthlyProjectedIncome = finalAccumulated * monthlyRate;
    const years = months / 12;

    return {
      months,
      years,
      monthlyIncome,
      finalAccumulated,
      totalIncomeGenerated,
      monthlyProjectedIncome,
      chartData,
    };
  };

  const currentScenario = calculateScenario(selectedScenario);
  const allScenarios = scenarios.map(months => calculateScenario(months));

  // Check if monthly income can pay for new consortium
  const canPayNewConsortium = currentScenario.monthlyProjectedIncome >= monthlyPayment;
  const surplusOrDeficit = currentScenario.monthlyProjectedIncome - monthlyPayment;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              Simulador de Renda Passiva
            </h2>
            <p className="text-gray-400 text-sm mt-1">Analise o crescimento do seu investimento com juros compostos de 1% ao mês</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Scenario Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Selecione o período de simulação</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {scenarios.map(months => (
                <button
                  key={months}
                  onClick={() => setSelectedScenario(months as 12 | 24 | 36 | 60)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedScenario === months
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl font-bold">{months}</div>
                  <div className="text-xs text-gray-400 mt-1">{(months / 12).toFixed(1)} anos</div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Scenario Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Key Metrics */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-xl p-6">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Investimento Inicial</p>
                <p className="text-3xl font-bold text-blue-400">{formatCurrency(initialInvestment)}</p>
              </div>

              <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-600/50 rounded-xl p-6">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Valor Acumulado ({currentScenario.months} meses)</p>
                <p className="text-3xl font-bold text-green-400">{formatCurrency(currentScenario.finalAccumulated)}</p>
                <p className="text-xs text-green-300 mt-2">+{formatCurrency(currentScenario.totalIncomeGenerated)} em ganhos</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border border-yellow-600/50 rounded-xl p-6">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Renda Mensal Projetada</p>
                <p className="text-3xl font-bold text-yellow-400">{formatCurrency(currentScenario.monthlyProjectedIncome)}</p>
                <p className="text-xs text-yellow-300 mt-2">Calculado sobre o valor acumulado</p>
              </div>

              <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-600/50 rounded-xl p-6">
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Rentabilidade Total</p>
                <p className="text-3xl font-bold text-purple-400">
                  {((currentScenario.totalIncomeGenerated / initialInvestment) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-purple-300 mt-2">Sobre o investimento inicial</p>
              </div>
            </div>

            {/* Right: Reinvestment Analysis */}
            <div className="space-y-4">
              <div className={`rounded-xl p-6 border-2 ${
                canPayNewConsortium
                  ? 'bg-green-900/20 border-green-600/50'
                  : 'bg-red-900/20 border-red-600/50'
              }`}>
                <div className="flex items-start gap-3 mb-4">
                  {canPayNewConsortium ? (
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                  ) : (
                    <X className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-200">
                      {canPayNewConsortium ? 'Viável para Novo Consórcio' : 'Insuficiente para Novo Consórcio'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Parcela do novo consórcio: {formatCurrency(monthlyPayment)}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Renda mensal gerada</span>
                    <span className="font-semibold text-green-400">{formatCurrency(currentScenario.monthlyProjectedIncome)}</span>
                  </div>
                  <div className="h-px bg-gray-700"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Parcela do novo consórcio</span>
                    <span className="font-semibold text-blue-400">{formatCurrency(monthlyPayment)}</span>
                  </div>
                  <div className="h-px bg-gray-700"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-300">Aporte de apenas</span>
                    <span className={`font-bold text-lg ${
                      surplusOrDeficit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {surplusOrDeficit >= 0 ? '+' : ''}{formatCurrency(surplusOrDeficit)}
                    </span>
                  </div>
                </div>

                {canPayNewConsortium && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-300">
                      ✓ A renda mensal consegue pagar a parcela do novo consórcio com {formatCurrency(surplusOrDeficit)} de sobra
                    </p>
                  </div>
                )}
              </div>

              {/* Comparison Table */}
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-200 mb-3">Comparação de Cenários</p>
                <div className="space-y-2 text-xs">
                  {allScenarios.map(scenario => (
                    <div key={scenario.months} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                      <span className="text-gray-400">{scenario.months} meses</span>
                      <span className="font-semibold text-gray-200">{formatCurrency(scenario.finalAccumulated)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6" style={{display: 'none'}}>
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Evolução do Investimento</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={currentScenario.chartData}>
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
                  dataKey="accumulated" 
                  stroke="#22c55e" 
                  name="Valor Acumulado"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="totalIncome" 
                  stroke="#C9A961" 
                  name="Ganhos Acumulados"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-4 justify-end pt-6 border-t border-gray-700">
            <Button
              onClick={onClose}
              variant="outline"
              className="px-8 py-3 border-gray-700 text-gray-300 hover:bg-gray-900"
            >
              Fechar
            </Button>
            <Button
              onClick={() => setShowReinvestmentAnalysis(!showReinvestmentAnalysis)}
              className="px-8 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-bold"
            >
              {showReinvestmentAnalysis ? 'Ocultar' : 'Ver'} Estratégia de Multiplicação
            </Button>
          </div>

          {/* Reinvestment Strategy */}
          {showReinvestmentAnalysis && (
            <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-600/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Estratégia de Multiplicação de Consórcios
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  Ao reinvestir a renda mensal em um novo consórcio, você cria um efeito de crescimento patrimonial contínuo:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-primary mb-2">1º</div>
                    <p className="text-xs text-gray-400">Consórcio gera crédito</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-2xl text-primary">→</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400 mb-2">2º</div>
                    <p className="text-xs text-gray-400">Crédito vira investimento</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-2xl text-primary">→</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400 mb-2">3º</div>
                    <p className="text-xs text-gray-400">Investimento gera renda</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-2xl text-primary">→</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400 mb-2">4º</div>
                    <p className="text-xs text-gray-400">Renda paga novo consórcio</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-2xl text-primary">→</div>
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400 mb-2">5º</div>
                  <p className="text-xs text-gray-400">Novo consórcio gera novo patrimônio</p>
                </div>

                {canPayNewConsortium && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <p className="text-sm text-green-300">
                      ✓ <strong>Sua situação:</strong> A renda mensal de {formatCurrency(currentScenario.monthlyProjectedIncome)} consegue pagar uma parcela de novo consórcio ({formatCurrency(monthlyPayment)}), ativando a estratégia de multiplicação patrimonial.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
