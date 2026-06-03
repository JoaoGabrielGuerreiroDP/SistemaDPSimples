import React, { createContext, useContext, useState } from 'react';
import { generateSimulation, ConsortiumGroup, SimulationResult } from '@/features/simulador/lib/consortiumCalculations';

export interface PresentationState {
  // Page 2: Tipo de Bem
  assetType: 'Imovel' | 'Veiculo' | null;

  // Page 3: Escolha do Grupo (previously Page 4)
  groupTerm: number; // em meses
  groupCreditValue: number;
  groupPayment: number; // meia parcela
  realInstallment: number; // parcela real (groupPayment × 2)
  adminFeePercent: number; // taxa de administração (%)

  // Page 4: Data de Contemplacao (previously Page 5)
  contemplationMonth: number;
  simulationResult: SimulationResult | null;

  // Results
  selectedScenario: string | null; // 'lottery' | 'embeddedBid' | 'appreciation'
}

export interface ScenarioResult {
  name: 'Sorteio' | 'Lance Embutido' | 'Pagamento Normal';
  totalPaid: number;
  totalTerm: number;
  monthlyPayment: number;
  capitalizedValue: number;
  receivedValue: number;
  savings: number;
}

interface PresentationContextType {
  state: PresentationState;
  setAssetType: (type: 'Imovel' | 'Veiculo') => void;
  setGroupData: (term: number, creditValue: number, payment: number, adminFeePercent?: number) => void;
  setContemplationMonth: (month: number) => void;
  calculateScenarios: () => void;
  selectScenario: (scenarioKey: string) => void;
  reset: () => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  canProceed: () => boolean;
}

const PresentationContext = createContext<PresentationContextType | undefined>(undefined);

const initialState: PresentationState = {
  assetType: null,
  groupTerm: 0,
  groupCreditValue: 0,
  groupPayment: 0,
  realInstallment: 0,
  adminFeePercent: 0,
  contemplationMonth: 1,
  simulationResult: null,
  selectedScenario: null,
};

export function PresentationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PresentationState>(initialState);
  const [currentPage, setCurrentPage] = useState(1);

  const setAssetType = (type: 'Imovel' | 'Veiculo') => {
    setState(prev => ({ ...prev, assetType: type }));
  };

  const setGroupData = (term: number, creditValue: number, payment: number, adminFeePercent: number = 0) => {
    setState(prev => {
      const newState = {
        ...prev,
        groupTerm: term,
        groupCreditValue: creditValue,
        groupPayment: payment,
        realInstallment: payment * 2, // Converter meia parcela para parcela real
        adminFeePercent,
      };
      // Trigger recalculation when group data changes
      setTimeout(() => {
        calculateScenarios();
      }, 0);
      return newState;
    });
  };

  const setContemplationMonth = (month: number) => {
    setState(prev => {
      const newState = {
        ...prev,
        contemplationMonth: month,
      };
      // Immediately trigger recalculation with new month
      setTimeout(() => {
        calculateScenarios();
      }, 0);
      return newState;
    });
  };

  const calculateScenarios = () => {
    // Use current state values directly to avoid stale closures
    setState(prev => {
      const { groupCreditValue, groupPayment, groupTerm, contemplationMonth, adminFeePercent } = prev;

      const contemplationMonthValue = contemplationMonth || Math.floor(groupTerm / 2);

      // Se houver taxa de administração informada, derivar a parcela MENSAL CHEIA
      // a partir de: total = crédito × (1 + taxa%) ; parcela = total / prazo.
      // Caso contrário, usa o payment_half × 2 como parcela cheia (fallback).
      const monthlyPaymentBase = adminFeePercent > 0 && groupTerm > 0
        ? (groupCreditValue * (1 + adminFeePercent / 100)) / groupTerm
        : groupPayment * 2;

      // Create consortium group object
      const group: ConsortiumGroup = {
        id: 'selected',
        name: 'Grupo Selecionado',
        creditValue: groupCreditValue,
        monthlyPayment: monthlyPaymentBase,
        paidInstallment: groupPayment,
        termMonths: groupTerm,
        administrator: 'Magalu',
        adminFeePercent,
      };

      // Generate simulation using new calculation engine
      const result = generateSimulation(group, contemplationMonthValue);

      return {
        ...prev,
        simulationResult: result,
      };
    });
  };

  const selectScenario = (scenarioKey: string) => {
    setState(prev => ({
      ...prev,
      selectedScenario: scenarioKey,
    }));
  };

  const reset = () => {
    setState(initialState);
    setCurrentPage(1);
  };

  const canProceed = (): boolean => {
    switch (currentPage) {
      case 1:
        return true;
      case 2:
        return state.assetType !== null;
      case 3:
        return state.groupTerm > 0 && state.groupCreditValue > 0;
      case 4:
        return state.simulationResult !== null;
      case 5:
        return state.selectedScenario !== null;
      default:
        return false;
    }
  };

  return (
    <PresentationContext.Provider
      value={{
        state,
        setAssetType,
        setGroupData,
        setContemplationMonth,
        calculateScenarios,
        selectScenario,
        reset,
        currentPage,
        setCurrentPage,
        canProceed,
      }}
    >
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentation() {
  const context = useContext(PresentationContext);
  if (!context) {
    throw new Error('usePresentation must be used within PresentationProvider');
  }
  return context;
}
