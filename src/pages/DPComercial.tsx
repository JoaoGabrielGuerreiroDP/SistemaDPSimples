import { TrendingUp } from "lucide-react";

export default function DPComercial() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">DP Consórcios — Comercial</h1>
      </div>
      <div className="glass-card p-8 text-center text-muted-foreground">
        Em construção
      </div>
    </div>
  );
}
