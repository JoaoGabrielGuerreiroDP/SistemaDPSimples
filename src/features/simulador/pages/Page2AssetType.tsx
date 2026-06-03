import { usePresentation } from '@/features/simulador/contexts/PresentationContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight, ChevronLeft, Home, Car } from 'lucide-react';

/**
 * Page 2: Escolha do Tipo de Bem
 * Only Imóvel and Veículo options
 */
export default function Page2AssetType() {
  const { state, setAssetType, setCurrentPage } = usePresentation();

  const options = [
    {
      id: 'Imovel',
      label: 'IMÓVEL',
      icon: Home,
    },
    {
      id: 'Veiculo',
      label: 'VEÍCULO',
      icon: Car,
    },
  ];

  const handleSelect = (type: 'Imovel' | 'Veiculo') => {
    setAssetType(type);
  };

  const handleNext = () => {
    if (state.assetType) {
      setCurrentPage(3);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      

      {/* Page Title */}
      <div className="border-b border-gray-800 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-display font-bold mb-2">
            Qual tipo de investimento deseja iniciar?
          </h1>
          {state.assetType && (
            <p className="text-lg font-semibold text-primary">
              {state.assetType === 'Imovel' ? 'Imóvel' : 'Veículo'}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {options.map(option => {
              const Icon = option.icon;
              const isSelected = state.assetType === option.id;

              return (
                <Card
                  key={option.id}
                  onClick={() => handleSelect(option.id as any)}
                  className={`p-12 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center ${
                    isSelected
                      ? 'bg-primary/20 border-primary border-2'
                      : 'bg-gray-900 border border-gray-800 hover:border-primary/50'
                  }`}
                >
                  <Icon
                    className={`w-16 h-16 mb-6 ${
                      isSelected ? 'text-primary' : 'text-gray-500'
                    }`}
                  />
                  <h3 className="text-2xl font-display font-bold text-white">
                    {option.label === 'IMÓVEL' ? 'Imóvel' : 'Veículo'}
                  </h3>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-800 px-6 py-6">
        <div className="max-w-5xl mx-auto flex gap-4">
          <Button
            onClick={() => setCurrentPage(1)}
            variant="outline"
            className="flex-1 border-primary text-primary hover:bg-primary/10"
          >
            <ChevronLeft className="w-5 h-5 mr-2" /> Voltar
          </Button>
          <Button
            onClick={handleNext}
            disabled={!state.assetType}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próximo <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
