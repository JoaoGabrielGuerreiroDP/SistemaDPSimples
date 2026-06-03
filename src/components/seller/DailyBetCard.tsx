import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useDailyBet } from "@/hooks/useDailyBet";
import { Target, Clock, Trophy, TrendingUp, Loader2 } from "lucide-react";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function DailyBetCard({ brokerName }: { brokerName?: string }) {
  const { todayBet, loading, submitting, placeBet } = useDailyBet(brokerName);
  const [amount, setAmount] = useState(50000);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  if (loading) return null;

  const hourCutoff = 11;
  const canBet = !todayBet && now.getHours() < hourCutoff;
  const lockedReason = todayBet ? "Aposta registrada" : `Apostas só até ${hourCutoff}h`;

  if (todayBet) {
    const statusInfo = {
      pending: { label: "Aguardando resultado", icon: Clock, color: "text-muted-foreground" },
      won: { label: "Bateu! 🎯", icon: Trophy, color: "text-green-500" },
      partial: { label: "Quase lá", icon: TrendingUp, color: "text-amber-500" },
      lost: { label: "Errou", icon: Target, color: "text-destructive" },
    }[todayBet.status];
    const StatusIcon = statusInfo.icon;

    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Sua aposta de hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-3xl font-bold">{formatBRL(todayBet.bet_amount)}</p>
              <p className={`text-xs flex items-center gap-1 mt-1 ${statusInfo.color}`}>
                <StatusIcon className="h-3 w-3" /> {statusInfo.label}
              </p>
            </div>
            {todayBet.actual_amount !== null && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Realizado</p>
                <p className="text-xl font-semibold">{formatBRL(todayBet.actual_amount)}</p>
                {todayBet.xp_earned !== null && (
                  <Badge variant={todayBet.xp_earned > 0 ? "default" : "destructive"} className="mt-1">
                    {todayBet.xp_earned > 0 ? "+" : ""}{todayBet.xp_earned} XP
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!canBet) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Clock className="h-4 w-4" /> {lockedReason}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Quanto você vai vender hoje?
        </CardTitle>
        <p className="text-xs text-muted-foreground">Bater = +50 XP · Quase = +10 XP · Errar feio = -20 XP</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-4xl font-bold text-primary">{formatBRL(amount)}</p>
        </div>
        <Slider
          value={[amount]}
          onValueChange={(v) => setAmount(v[0])}
          min={0}
          max={5000000}
          step={10000}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>R$ 0</span>
          <span>R$ 5M</span>
        </div>
        <Button
          onClick={() => placeBet(amount)}
          disabled={submitting || amount === 0 || !brokerName}
          className="w-full"
          size="lg"
        >
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Target className="h-4 w-4 mr-2" />}
          Apostar {formatBRL(amount)}
        </Button>
      </CardContent>
    </Card>
  );
}