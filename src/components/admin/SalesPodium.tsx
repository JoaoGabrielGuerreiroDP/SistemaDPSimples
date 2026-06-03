import { Trophy, Medal } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface RankingItem {
  name: string;
  total: number;
  count: number;
  avatarUrl?: string | null;
}

interface SalesPodiumProps {
  ranking: RankingItem[];
  title: string;
  icon?: "trophy" | "medal";
  showCotas?: boolean;
}

const PODIUM_COLORS = [
  { bg: "bg-gradient-to-b from-[hsl(45,85%,50%)] to-[hsl(45,85%,40%)]", text: "text-[hsl(45,85%,50%)]", border: "border-[hsl(45,85%,50%)]", label: "Campeão do Mês" },
  { bg: "bg-gradient-to-b from-[hsl(215,12%,60%)] to-[hsl(215,12%,45%)]", text: "text-[hsl(215,12%,60%)]", border: "border-[hsl(215,12%,60%)]", label: "Vice-Campeão" },
  { bg: "bg-gradient-to-b from-[hsl(25,70%,50%)] to-[hsl(25,70%,40%)]", text: "text-[hsl(25,70%,50%)]", border: "border-[hsl(25,70%,50%)]", label: "Terceiro Lugar" },
];

function PodiumPlace({ item, place, color }: { item: RankingItem; place: number; color: typeof PODIUM_COLORS[0] }) {
  const heights = ["h-24 sm:h-28", "h-20 sm:h-24", "h-16 sm:h-20"];
  const orderClass = place === 0 ? "order-2" : place === 1 ? "order-1" : "order-3";
  const initials = item.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={`flex flex-col items-center gap-1.5 ${orderClass} flex-1`}>
      <Avatar className={`w-10 h-10 sm:w-12 sm:h-12 border-2 ${color.border}`}>
        {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.name} />}
        <AvatarFallback className="bg-muted/50 text-foreground text-xs sm:text-sm font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className={`${color.bg} rounded-t-lg w-full ${heights[place]} flex flex-col items-center justify-center gap-0.5 px-1`}>
        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-background/80" />
        <span className="text-lg sm:text-xl font-bold text-background/90">{place + 1}º</span>
      </div>

      <div className="text-center space-y-0.5">
        <p className="text-[10px] sm:text-xs font-bold text-foreground truncate max-w-[90px] sm:max-w-[110px]">
          {item.name.toUpperCase()}
        </p>
        <p className={`text-[10px] sm:text-xs font-bold ${color.text}`}>
          {formatBRL(item.total)}
        </p>
        <p className={`text-[9px] sm:text-[10px] font-medium ${color.text}`}>
          {color.label}
        </p>
      </div>
    </div>
  );
}

export function SalesPodium({ ranking, title, icon = "trophy", showCotas = false }: SalesPodiumProps) {
  if (ranking.length === 0) return null;

  const top3 = ranking.slice(0, 3);
  const maxTotal = ranking[0]?.total || 1;

  const Icon = icon === "trophy" ? Trophy : Medal;

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[hsl(45,85%,50%)]" />
        <h2 className="font-display text-base sm:text-xl font-bold text-foreground">{title}</h2>
      </div>

      {top3.length >= 2 && (
        <div className="flex items-end justify-center gap-2 sm:gap-3 pt-4 pb-2">
          {top3.map((item, i) => (
            <PodiumPlace key={item.name} item={item} place={i} color={PODIUM_COLORS[i]} />
          ))}
        </div>
      )}

      <div className="border-t border-border/50" />

      <div className="space-y-0.5">
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Ranking Completo
        </span>

        <div className="space-y-2 mt-2">
          {ranking.map((r, i) => {
            const barPct = (r.total / maxTotal) * 100;
            const barColor = i === 0
              ? "bg-[hsl(45,85%,50%)]"
              : i === 1
              ? "bg-[hsl(217,85%,55%)]"
              : i === 2
              ? "bg-[hsl(25,70%,50%)]"
              : "bg-primary";
            const initials = r.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

            return (
              <div key={r.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {r.avatarUrl ? (
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={r.avatarUrl} alt={r.name} />
                        <AvatarFallback className={`text-[10px] font-bold ${
                          i < 3 ? "text-background" : "text-muted-foreground"
                        }`}>{initials}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i < 3 ? `${PODIUM_COLORS[i].bg} text-background` : "bg-muted text-muted-foreground"
                      }`}>
                        {i + 1}
                      </span>
                    )}
                    <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-none">
                      {r.name.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-bold text-primary">{formatBRL(r.total)}</span>
                    {showCotas && (
                      <span className="text-[10px] text-muted-foreground ml-1.5">{r.count} cotas</span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden ml-8">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
