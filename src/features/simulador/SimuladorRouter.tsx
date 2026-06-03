import { PresentationProvider, usePresentation } from "@/features/simulador/contexts/PresentationContext";
import Page1Introduction from "@/features/simulador/pages/Page1Introduction";
import Page2AssetType from "@/features/simulador/pages/Page2AssetType";
import Page3Objective from "@/features/simulador/pages/Page3Objective";
import Page4Group from "@/features/simulador/pages/Page4Group";
import Page6StrategicAnalysis from "@/features/simulador/pages/Page6StrategicAnalysis";
import Page7StrategyComparison from "@/features/simulador/pages/Page7StrategyComparison";

function PresentationRouter() {
  const { currentPage } = usePresentation();
  switch (currentPage) {
    case 1:
      return <Page1Introduction />;
    case 2:
      return <Page2AssetType />;
    case 3:
      return <Page3Objective />;
    case 4:
      return <Page4Group />;
    case 6:
      return <Page6StrategicAnalysis />;
    case 7:
      return <Page7StrategyComparison />;
    default:
      return <Page1Introduction />;
  }
}

export default function SimuladorPage() {
  return (
    <PresentationProvider>
      <div className="min-h-screen w-full">
        <PresentationRouter />
      </div>
    </PresentationProvider>
  );
}
