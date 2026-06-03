import { useState } from 'react';
import { usePresentation } from '@/features/simulador/contexts/PresentationContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, Home, DollarSign, CheckCircle, XCircle, Star } from 'lucide-react';
import { calculateStrategicScore, getScoreLabel, calculateSelfPaymentIndex } from '@/features/simulador/lib/consortiumCalculations';
import IncomeSimulationModal from '@/features/simulador/components/IncomeSimulationModal';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function Page6StrategicAnalysis() {
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
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
  const updatedPayment = result.updatedPayment;
  const contemplationMonth = result.selectedMonth;
  const termMonths = state.groupTerm;
  const remainingMonths = termMonths - contemplationMonth;
  const selectedScenario = state.selectedScenario; // 'lottery', 'embeddedBid', or 'appreciation'

  // Calculate total paid up to contemplation month (with 5% annual adjustment)
  let totalPaid = 0;
  for (let month = 1; month <= contemplationMonth; month++) {
    const yearsPassed = Math.floor((month - 1) / 12);
    const adjustedPayment = monthlyPayment * Math.pow(1.05, yearsPassed);
    totalPaid += adjustedPayment;
  }

  // Card 1: Venda da Carta Contemplada (Lottery scenario)
  const cardSaleValue = creditValue * 0.20;
  const cardSaleProfit = cardSaleValue - totalPaid;
  const isCardSaleViable = cardSaleValue >= totalPaid;
  const investmentMonthlyRate = 0.01;
  const investedValue = cardSaleValue * Math.pow(1 + investmentMonthlyRate, remainingMonths);
  const investmentProfit = investedValue - cardSaleValue;
  
  // Monthly investment potential for new consortium
  const monthlyInvestmentReturn = cardSaleValue * investmentMonthlyRate;
  // Real installment (not half) for comparison
  const realInstallment = monthlyPayment * 2;
  const investmentCoversInstallment = monthlyInvestmentReturn >= realInstallment;

  // Card 2: Aquisição de Imóvel para Renda (Lottery scenario)
  const propertyValue = creditValue;
  const monthlyRent = propertyValue * 0.005;
  const rentVsPayment = monthlyRent - monthlyPayment;
  const rentCoversPayment = monthlyRent >= monthlyPayment;
  const monthlyRentProfit = rentVsPayment > 0 ? rentVsPayment : 0;
  const totalRentProfit = monthlyRentProfit * remainingMonths;

  // Card 3: Pagamento até o Final
  const yearsTotal = termMonths / 12;
  const creditValueFinal = creditValue * Math.pow(1.05, yearsTotal);
  const creditGain = creditValueFinal - totalPaid;

  // Embedded Bid calculations (25% discount on credit)
  const embeddedBidDiscount = 0.25;
  const availableCreditAfterBid = creditValue * (1 - embeddedBidDiscount);
  
  // Property for Embedded Bid scenario
  const propertyValueBid = availableCreditAfterBid;
  const monthlyRentBid = propertyValueBid * 0.005;
  const rentVsPaymentBid = monthlyRentBid - monthlyPayment;
  const rentCoversPaymentBid = monthlyRentBid >= monthlyPayment;
  const monthlyRentProfitBid = rentVsPaymentBid > 0 ? rentVsPaymentBid : 0;
  const totalRentProfitBid = monthlyRentProfitBid * remainingMonths;
  
  // Sale for Embedded Bid scenario (20% of reduced credit)
  const cardSaleValueBid = availableCreditAfterBid * 0.20;
  const cardSaleProfitBid = cardSaleValueBid - totalPaid;
  const isCardSaleViableBid = cardSaleValueBid >= totalPaid;

  // Strategic indicators
  const updatedCredit = creditValue * Math.pow(1.05, contemplationMonth / 12);
  const leverage = totalPaid > 0 ? updatedCredit / totalPaid : 0;

  // Calculate strategic scores
  const scoreSale = calculateStrategicScore('sale', creditValue, monthlyPayment, contemplationMonth);
  const scoreProperty = calculateStrategicScore('property', creditValue, monthlyPayment, contemplationMonth);
  const scorePayment = calculateStrategicScore('payment', creditValue, monthlyPayment, contemplationMonth);
  
  const scores = [
    { strategy: 'sale', score: scoreSale },
    { strategy: 'property', score: scoreProperty },
    { strategy: 'payment', score: scorePayment }
  ];
  scores.sort((a, b) => b.score - a.score);
  const bestScore = scores[0];
  const secondBestScore = scores[1];
  
  const selfPaymentIndex = calculateSelfPaymentIndex(propertyValue, 0.005, monthlyPayment);

  // Determine which cards to display based on selected scenario
  let cardsToDisplay: string[] = [];
  if (selectedScenario === 'lottery') {
    cardsToDisplay = ['sale', 'property'];
  } else if (selectedScenario === 'embeddedBid') {
    cardsToDisplay = ['property-bid', 'sale-bid'];
  } else if (selectedScenario === 'appreciation') {
    cardsToDisplay = ['payment'];
  }

  // Veículo: remover cards de imóvel para renda (não se aplica)
  if (state.assetType === 'Veiculo') {
    cardsToDisplay = cardsToDisplay.filter(
      c => c !== 'property' && c !== 'property-bid'
    );
  }

  const cardCount = cardsToDisplay.length;

  // Determine grid layout based on card count
  const gridClass = cardCount === 1 
    ? 'flex justify-center' 
    : cardCount === 2 
    ? 'grid grid-cols-1 md:grid-cols-2 gap-8' 
    : 'grid grid-cols-1 md:grid-cols-3 gap-8';

  // Determine card width for single card
  const singleCardClass = cardCount === 1 ? 'w-full md:max-w-md' : '';

  return (
    <div className="min-h-screen bg-black text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-primary mb-3">Possibilidades de uso do Crédito</h1>
          <p className="text-gray-400">Três cenários de utilização do seu crédito contemplado</p>
        </div>

        {/* Strategic Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Indicator 1: Total Invested */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Total Investido</p>
            <p className="text-3xl font-bold text-primary mb-1 animate-number-update">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-gray-500">Parcelas pagas até o mês {contemplationMonth}</p>
          </div>

          {/* Indicator 2: Generated Patrimony */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Patrimônio Gerado</p>
            <p className="text-3xl font-bold text-green-400 mb-1 animate-number-update">{formatCurrency(updatedCredit)}</p>
            <p className="text-xs text-gray-500">Crédito corrigido (5% ao ano)</p>
          </div>

          {/* Indicator 3: Financial Leverage */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Eficiência do Investimento</p>
            <p className="text-3xl font-bold text-blue-400 mb-1 animate-number-update">{leverage.toFixed(2)}x</p>
            <p className="text-xs text-gray-500">Seu patrimônio é {leverage.toFixed(1)}x maior que investido</p>
          </div>
        </div>

        {/* Cards Grid - Dynamic layout */}
        <div className={`${gridClass} mb-12`}>
          {/* Card: Venda da Carta (Lottery) */}
          {cardsToDisplay.includes('sale') && (
            <div className={`rounded-2xl p-8 border-2 transition-all ${singleCardClass} ${
              isCardSaleViable 
                ? 'bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-600/50 hover:border-green-500' 
                : 'bg-gradient-to-br from-red-900/20 to-red-800/10 border-red-600/50 hover:border-red-500'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    isCardSaleViable ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {isCardSaleViable ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold">Venda da carta contemplada</h2>
                </div>

              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Valor recebido (20%)</p>
                  <p className="text-3xl font-bold text-primary animate-number-update">{formatCurrency(cardSaleValue)}</p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Total pago até agora</p>
                  <p className="text-lg font-semibold text-gray-300">{formatCurrency(totalPaid)}</p>
                </div>

                <div className={`pt-4 border-t-2 rounded-lg p-4 ${
                  isCardSaleViable 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-red-500 bg-red-500/10'
                }`}>
                  <p className={`text-xs mb-2 font-semibold uppercase tracking-wide ${
                    isCardSaleViable ? 'text-green-400' : 'text-red-400'
                  }`}>
                    Lucro Líquido
                  </p>
                  <p className={`text-2xl font-bold animate-number-update ${
                    isCardSaleViable ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(cardSaleProfit)}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Rendimento mensal (1% ao mês)</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Valor inicial investido</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(cardSaleProfit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Renda do 1º mês</p>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(cardSaleProfit * 0.01)}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700 space-y-3">
                  <p className="text-xs text-gray-300">
                    <strong>Estratégia:</strong> Usar o rendimento para aquisição de outro consórcio (alavancagem patrimonial)
                  </p>
                  <Button
                    onClick={() => setIsIncomeModalOpen(true)}
                    className="w-full bg-primary hover:bg-primary/90 text-gray-950 font-bold py-2 rounded-lg transition"
                  >
                    Simular Renda ao Longo do Tempo
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Card: Imóvel para Renda (Lottery) */}
          {cardsToDisplay.includes('property') && (
            <div className={`rounded-2xl p-8 border-2 transition-all ${singleCardClass} ${
              rentCoversPayment 
                ? 'bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-600/50 hover:border-green-500' 
                : 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border-yellow-600/50 hover:border-yellow-500'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    rentCoversPayment ? 'bg-green-500/20' : 'bg-yellow-500/20'
                  }`}>
                    {rentCoversPayment ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <Home className="w-6 h-6 text-yellow-400" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold">Aquisição de imóvel para renda</h2>
                </div>

              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Valor do imóvel</p>
                  <p className="text-3xl font-bold text-primary animate-number-update">{formatCurrency(propertyValue)}</p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Locação do Imóvel / mês</p>
                  <p className="text-lg font-semibold text-gray-300">{formatCurrency(monthlyRent)}</p>
                </div>

                <div className={`pt-4 border-t-2 rounded-lg p-4 ${
                  rentCoversPayment 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-yellow-500 bg-yellow-500/10'
                }`}>
                  <p className={`text-xs mb-2 font-semibold uppercase tracking-wide ${
                    rentCoversPayment ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    Lucro Mensal
                  </p>
                  <p className={`text-2xl font-bold animate-number-update ${
                    rentCoversPayment ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {formatCurrency(monthlyRentProfit)}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Acumulado até contemplação</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Parcela mensal</p>
                      <p className="text-lg font-bold text-gray-300">{formatCurrency(monthlyPayment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lucro acumulado</p>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(totalRentProfit)}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700 bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300">
                    <strong>Estratégia:</strong> Gerar renda passiva que cobre a parcela do consórcio
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card: Imóvel para Renda (Embedded Bid) */}
          {cardsToDisplay.includes('property-bid') && (
            <div className={`rounded-2xl p-8 border-2 transition-all ${singleCardClass} ${
              rentCoversPaymentBid 
                ? 'bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-600/50 hover:border-green-500' 
                : 'bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border-yellow-600/50 hover:border-yellow-500'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    rentCoversPaymentBid ? 'bg-green-500/20' : 'bg-yellow-500/20'
                  }`}>
                    {rentCoversPaymentBid ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <Home className="w-6 h-6 text-yellow-400" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold">Aquisição de imóvel para renda</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  rentCoversPaymentBid 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                }`}>
                  {rentCoversPaymentBid ? '✓ Viável' : '⚠ Parcial'}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Valor do imóvel (após lance 25%)</p>
                  <p className="text-3xl font-bold text-primary animate-number-update">{formatCurrency(propertyValueBid)}</p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Locação do Imóvel / mês</p>
                  <p className="text-lg font-semibold text-gray-300">{formatCurrency(monthlyRentBid)}</p>
                </div>

                <div className={`pt-4 border-t-2 rounded-lg p-4 ${
                  rentCoversPaymentBid 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-yellow-500 bg-yellow-500/10'
                }`}>
                  <p className={`text-xs mb-2 font-semibold uppercase tracking-wide ${
                    rentCoversPaymentBid ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {rentCoversPaymentBid ? 'Lucro Mensal' : 'Redução de Custo'}
                  </p>
                  <p className={`text-2xl font-bold animate-number-update ${
                    rentCoversPaymentBid ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {formatCurrency(monthlyRentProfitBid)}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Acumulado até contemplação</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Parcela mensal</p>
                      <p className="text-lg font-bold text-gray-300">{formatCurrency(monthlyPayment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lucro acumulado</p>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(totalRentProfitBid)}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700 bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300">
                    <strong>Estratégia:</strong> Gerar renda passiva com crédito reduzido pelo lance
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card: Venda da Carta (Embedded Bid) */}
          {cardsToDisplay.includes('sale-bid') && (
            <div className={`rounded-2xl p-8 border-2 transition-all ${singleCardClass} ${
              isCardSaleViableBid 
                ? 'bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-600/50 hover:border-green-500' 
                : 'bg-gradient-to-br from-red-900/20 to-red-800/10 border-red-600/50 hover:border-red-500'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    isCardSaleViableBid ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {isCardSaleViableBid ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold">Venda da carta contemplada</h2>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  isCardSaleViableBid 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}>
                  {isCardSaleViableBid ? '✓ Viável' : '✗ Não viável'}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Valor recebido (20% após lance 25%)</p>
                  <p className="text-3xl font-bold text-primary animate-number-update">{formatCurrency(cardSaleValueBid)}</p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Total pago até agora</p>
                  <p className="text-lg font-semibold text-gray-300">{formatCurrency(totalPaid)}</p>
                </div>

                <div className={`pt-4 border-t-2 rounded-lg p-4 ${
                  isCardSaleViableBid 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-red-500 bg-red-500/10'
                }`}>
                  <p className={`text-xs mb-2 font-semibold uppercase tracking-wide ${
                    isCardSaleViableBid ? 'text-green-400' : 'text-red-400'
                  }`}>
                    Lucro Líquido
                  </p>
                  <p className={`text-2xl font-bold animate-number-update ${
                    isCardSaleViableBid ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(cardSaleProfitBid)}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-700 bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300">
                    <strong>Estratégia:</strong> Venda com crédito reduzido pelo lance embutido
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card: Pagamento até o Final */}
          {cardsToDisplay.includes('payment') && (
            <div className={`rounded-2xl p-8 border-2 border-blue-600/50 bg-gradient-to-br from-blue-900/20 to-blue-800/10 hover:border-blue-500 transition-all ${singleCardClass}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold">Pagamento até o final</h2>
                </div>
                <div className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/50">
                  ✓ Crescimento
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Crédito inicial</p>
                  <p className="text-3xl font-bold text-primary animate-number-update">{formatCurrency(creditValue)}</p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Crédito valorizado (5% ao ano)</p>
                  <p className="text-lg font-semibold text-blue-400">{formatCurrency(creditValueFinal)}</p>
                </div>

                <div className="pt-4 border-t-2 border-blue-500 rounded-lg p-4 bg-blue-500/10">
                  <p className="text-xs mb-2 font-semibold uppercase tracking-wide text-blue-400">
                    Ganho de poder de compra
                  </p>
                  <p className="text-2xl font-bold text-blue-400 animate-number-update">
                    {formatCurrency(creditGain)}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Análise do período</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Total pago</p>
                      <p className="text-lg font-bold text-gray-300">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Prazo total</p>
                      <p className="text-lg font-bold text-gray-300">{termMonths} meses</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700 bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300">
                    <strong>Estratégia:</strong> Capitalização do crédito ao longo do tempo gera poder de compra adicional
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            onClick={() => setCurrentPage(4)}
            variant="outline"
            className="px-8 py-3 border-gray-700 text-gray-300 hover:bg-gray-900"
          >
            Voltar
          </Button>
          <Button
            onClick={() => setCurrentPage(7)}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-2"
          >
            Comparar Estratégias <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setCurrentPage(1)}
            className="px-8 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-bold flex items-center gap-2"
          >
            Nova simulação <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Income Simulation Modal */}
        <IncomeSimulationModal
          isOpen={isIncomeModalOpen}
          onClose={() => setIsIncomeModalOpen(false)}
          initialInvestment={cardSaleProfit}
          monthlyPayment={monthlyPayment}
        />
      </div>
    </div>
  );
}
