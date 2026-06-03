/**
 * Consortium Calculation Engine
 * Motor de cálculo para simulação de consórcio com reajuste anual composto
 */

export interface ConsortiumGroup {
  id: string;
  name: string;
  creditValue: number;
  monthlyPayment: number;
  paidInstallment?: number;
  termMonths: number;
  administrator: string;
  adminFeePercent?: number;
}

export interface ContemplationScenario {
  name: string;
  creditReceived: number;
  monthlyPayment: number;
  totalPaid: number;
  savings: number;
  description: string;
}

export interface SimulationResult {
  selectedMonth: number;
  initialCredit: number;
  updatedCredit: number;
  initialPayment: number;
  updatedPayment: number;
  appreciation: number;
  appreciationPercent: number;
  scenarios: {
    lottery: ContemplationScenario;
    embeddedBid: ContemplationScenario;
    appreciation: ContemplationScenario;
  };
}

/**
 * Calculate compound annual adjustment (5% per year)
 * Formula: value_updated = value_initial × (1.05 ^ years_passed)
 */
export function calculateCompoundAdjustment(
  initialValue: number,
  monthOfContemplation: number,
  annualRate: number = 0.05
): number {
  const yearsPassed = Math.floor(monthOfContemplation / 12);
  const adjustmentFactor = Math.pow(1 + annualRate, yearsPassed);
  return initialValue * adjustmentFactor;
}

/**
 * Calculate total paid considering monthly compound adjustment
 * Parcela sofre reajuste de 5% a cada 12 meses
 * Meses 1-12: parcela inicial
 * Meses 13-24: parcela × 1.05
 * Meses 25-36: parcela × 1.05²
 * E assim sucessivamente
 * 
 * IMPORTANTE: No consórcio o participante paga até o final do prazo,
 * independente da contemplação. Por isso somamos de 1 até termMonths.
 */
export function calculateTotalPaidWithMonthlyAdjustment(
  monthlyPayment: number,
  contemplationMonth: number,
  termMonths: number,
  annualRate: number = 0.05
): number {
  let totalPaid = 0;

  // Calculate total paid over the FULL term (consortium is paid until the end)
  for (let month = 1; month <= termMonths; month++) {
    // Calculate which year we're in (0-based: months 1-12 = year 0, months 13-24 = year 1, etc.)
    const yearsCompleted = Math.floor((month - 1) / 12);
    // Apply compound adjustment for this year
    const adjustedPayment = monthlyPayment * Math.pow(1 + annualRate, yearsCompleted);
    totalPaid += adjustedPayment;
  }

  return totalPaid;
}

/**
 * Generate complete simulation result for a given contemplation month
 */
export function generateSimulation(
  group: ConsortiumGroup,
  monthOfContemplation: number
): SimulationResult {
  // Calculate updated values based on compound adjustment
  const updatedCredit = calculateCompoundAdjustment(group.creditValue, monthOfContemplation);
  const updatedPayment = calculateCompoundAdjustment(group.monthlyPayment, monthOfContemplation);
  
  // Calculate appreciation
  const appreciation = updatedCredit - group.creditValue;
  const appreciationPercent = (appreciation / group.creditValue) * 100;

  // SCENARIO 1: Lottery (Sorteio)
  // User can choose between 50-100% of credit
  // We'll use 100% as the default scenario
  const lotteryCredit = updatedCredit;
  const lotteryPayment = updatedPayment;
  const lotteryTotalPaid = calculateTotalPaidWithMonthlyAdjustment(
    group.monthlyPayment,
    monthOfContemplation,
    group.termMonths
  );

  // SCENARIO 2: Embedded Bid (Lance Embutido)
  // 25% do crédito é usado como lance, restando 75% liberados.
  // Total pago = parcela selecionada × meses pagos.
  // Nova parcela = (crédito + taxa − valor pago em parcelas − lance) / prazo restante.
  const embeddedBidAmount = group.creditValue * 0.25;
  const embeddedBidCredit = group.creditValue * 0.75;
  const selectedInstallment = group.paidInstallment ?? group.monthlyPayment;
  const totalCreditWithFee = group.adminFeePercent && group.adminFeePercent > 0
    ? group.creditValue * (1 + group.adminFeePercent / 100)
    : group.monthlyPayment * group.termMonths;
  const parcelasPagasAteContemplacao = selectedInstallment * monthOfContemplation;
  const remainingMonths = Math.max(1, group.termMonths - monthOfContemplation);
  const embeddedBidPayment = Math.max(
    0,
    (totalCreditWithFee - parcelasPagasAteContemplacao - embeddedBidAmount) / remainingMonths
  );
  const embeddedBidTotalPaid = parcelasPagasAteContemplacao;

  // SCENARIO 3: Payment until the end (Pagamento até o final)
  // Show the benefit of waiting for appreciation
  const appreciationCredit = updatedCredit;
  const appreciationPayment = updatedPayment;
  const appreciationTotalPaid = calculateTotalPaidWithMonthlyAdjustment(
    group.monthlyPayment,
    monthOfContemplation,
    group.termMonths
  );

  return {
    selectedMonth: monthOfContemplation,
    initialCredit: group.creditValue,
    updatedCredit,
    initialPayment: group.monthlyPayment,
    updatedPayment,
    appreciation,
    appreciationPercent,
    scenarios: {
      lottery: {
        name: 'Contemplação por Sorteio',
        creditReceived: lotteryCredit,
        monthlyPayment: lotteryPayment,
        totalPaid: lotteryTotalPaid,
        savings: 0,
        description: 'Receba 100% do crédito atualizado quando sorteado'
      },
      embeddedBid: {
        name: 'Lance Embutido 25%',
        creditReceived: embeddedBidCredit,
        monthlyPayment: embeddedBidPayment,
        totalPaid: embeddedBidTotalPaid,
        savings: embeddedBidAmount,
        description: `Use 25% (${formatCurrency(embeddedBidAmount)}) como lance para acelerar contemplação`
      },
      appreciation: {
        name: 'Pagamento até o final',
        creditReceived: appreciationCredit,
        monthlyPayment: appreciationPayment,
        totalPaid: appreciationTotalPaid,
        savings: appreciation,
        description: `Aguarde e receba ${appreciationPercent.toFixed(1)}% a mais em crédito`
      }
    }
  };
}

/**
 * Generate multiple scenarios for different contemplation months
 * Useful for showing user the progression over time
 */
export function generateMultipleScenarios(
  group: ConsortiumGroup,
  months: number[]
): SimulationResult[] {
  return months.map(month => generateSimulation(group, month));
}

/**
 * Calculate lottery scenario with custom credit percentage
 */
export function calculateLotteryScenario(
  group: ConsortiumGroup,
  monthOfContemplation: number,
  creditPercentage: number = 1.0 // 0.5 to 1.0
): ContemplationScenario {
  const updatedCredit = calculateCompoundAdjustment(group.creditValue, monthOfContemplation);
  const updatedPayment = calculateCompoundAdjustment(group.monthlyPayment, monthOfContemplation);

  const creditReceived = updatedCredit * creditPercentage;
  const monthlyPayment = updatedPayment * creditPercentage;
  const remainingMonths = group.termMonths - monthOfContemplation;
  const totalPaid = monthlyPayment * remainingMonths;

  return {
    name: `Sorteio ${(creditPercentage * 100).toFixed(0)}%`,
    creditReceived,
    monthlyPayment,
    totalPaid,
    savings: 0,
    description: `Utilize ${(creditPercentage * 100).toFixed(0)}% do crédito disponível`
  };
}

/**
 * Format value as Brazilian currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Calculate Strategic Score (0-10) for each strategy
 * Considers: financial return, monthly income, capital multiplication, ROI efficiency
 */
export function calculateStrategicScore(
  strategy: 'sale' | 'property' | 'payment',
  creditValue: number,
  monthlyPayment: number,
  contemplationMonth: number,
  rentalRate: number = 0.005
): number {
  const yearsAtContemplation = contemplationMonth / 12;
  const creditCorrigido = creditValue * Math.pow(1.05, yearsAtContemplation);
  
  let totalPaid = 0;
  for (let month = 1; month <= contemplationMonth; month++) {
    const yearsPassed = Math.floor((month - 1) / 12);
    const adjustedPayment = monthlyPayment * Math.pow(1.05, yearsPassed);
    totalPaid += adjustedPayment;
  }

  let score = 0;

  if (strategy === 'sale') {
    const cardSaleValue = creditCorrigido * 0.20;
    const investmentValue = creditCorrigido * 0.80;
    const monthlyReturn = investmentValue * 0.01;
    const annualReturn = monthlyReturn * 12;
    const roi = (annualReturn / investmentValue) * 100;
    
    const capitalMult = Math.min(3, (creditCorrigido / totalPaid) * 3);
    const roiScore = Math.min(4, (roi / 15) * 4);
    const liquidityBonus = 3;
    
    score = capitalMult + roiScore + liquidityBonus;
  } else if (strategy === 'property') {
    const propertyValue = creditCorrigido;
    const monthlyRent = propertyValue * rentalRate;
    const monthlyResult = monthlyRent - monthlyPayment;
    const selfPaymentIndex = monthlyRent / monthlyPayment;
    
    const paymentScore = Math.min(4, Math.max(0, selfPaymentIndex * 2));
    const incomeScore = Math.min(3, (monthlyResult / monthlyPayment) * 3);
    const appreciationScore = 3 * (yearsAtContemplation / 3);
    
    score = paymentScore + incomeScore + appreciationScore;
  } else if (strategy === 'payment') {
    const patrimonioLiquido = creditCorrigido - totalPaid;
    const appreciationPercent = ((creditCorrigido - creditValue) / creditValue) * 100;
    const roi = (patrimonioLiquido / totalPaid) * 100;
    
    const appreciationScore = Math.min(3, (appreciationPercent / 20) * 3);
    const patrimonioScore = Math.min(4, (roi / 50) * 4);
    const timeBonus = Math.min(3, yearsAtContemplation * 1.5);
    
    score = appreciationScore + patrimonioScore + timeBonus;
  }

  return Math.min(10, Math.max(0, score));
}

/**
 * Calculate self-payment index for property strategy
 */
export function calculateSelfPaymentIndex(
  propertyValue: number,
  rentalRate: number,
  monthlyPayment: number
): number {
  const monthlyRent = propertyValue * rentalRate;
  return monthlyRent / monthlyPayment;
}

/**
 * Get score classification label
 */
export function getScoreLabel(score: number): string {
  if (score >= 9) return 'Excelente';
  if (score >= 8) return 'Muito Bom';
  if (score >= 7) return 'Bom';
  if (score >= 6) return 'Viável';
  if (score >= 5) return 'Aceitável';
  return 'Baixo';
}
