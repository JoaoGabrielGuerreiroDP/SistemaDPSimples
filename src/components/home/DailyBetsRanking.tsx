import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDailyBetsRanking } from "@/hooks/useDailyBet";
import { Target, Flame } from "lucide-react";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function DailyBetsRanking() {
  const { bets, loading } = useDailyBetsRanking();
  if (loading || bets.length === 0) return null;

  const top = bets.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" /> Previsão de hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {top.map((b, i) => (
            <li key={b.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/40">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 justify-center">
                  {i + 1}
                </Badge>
                <span className="font-medium">{b.broker_name}</span>
              </span>
              <span className="flex items-center gap-1 font-semibold">
                <Target className="h-3 w-3 text-primary" /> {formatBRL(b.bet_amount)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
