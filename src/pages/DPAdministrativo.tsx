import { Settings, Wallet } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CompanyResultsOverview, MyBrokerResultsCard } from "@/components/home/BrokerResultsCards";
import { CompanyAtrasoOverview, MyBrokerAtrasoCard } from "@/components/home/BrokerAtrasoCards";

export default function DPAdministrativo() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">DP Consórcios — Administrativo</h1>
      </div>

      <Accordion type="single" collapsible defaultValue="financeiro" className="rounded-lg border border-border/40 bg-card">
        <AccordionItem value="financeiro" className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Financeiro</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <CompanyResultsOverview />
            <MyBrokerResultsCard />
            <CompanyAtrasoOverview />
            <MyBrokerAtrasoCard />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
