import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Target, Pencil, Check, X, Key, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatBRL(value);
}

interface SalesGaugeCardProps {
  selectedYear: number;
  selectedMonth: number;
  totalVendido: number;
  totalPropostas: number;
}

// SVG Gauge component
function GaugeMeter({ percentage, size = 200 }: { percentage: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = size / 2 - 20;
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;
  const clampedPct = Math.min(percentage, 120);
  const currentAngle = startAngle + (clampedPct / 100) * totalAngle;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const polarToCart = (angle: number, r: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });

  // Background arc
  const bgStart = polarToCart(startAngle, radius);
  const bgEnd = polarToCart(endAngle, radius);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  // Value arc
  const valEnd = polarToCart(Math.min(currentAngle, endAngle), radius);
  const largeArc = currentAngle - startAngle > 180 ? 1 : 0;
  const valPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${valEnd.x} ${valEnd.y}`;

  // Needle
  const needleAngle = Math.min(currentAngle, endAngle);
  const needleTip = polarToCart(needleAngle, radius - 12);
  const needleBase1 = polarToCart(needleAngle + 90, 4);
  const needleBase2 = polarToCart(needleAngle - 90, 4);

  // Color based on percentage
  const getColor = (pct: number) => {
    if (pct < 25) return "hsl(0, 72%, 55%)";
    if (pct < 50) return "hsl(30, 90%, 55%)";
    if (pct < 70) return "hsl(45, 85%, 50%)";
    return "hsl(150, 60%, 45%)";
  };

  // Tick marks
  const ticks = [0, 25, 50, 70, 100];

  // Glow filter color
  const glowColor = getColor(percentage);

  return (
    <svg width={size} height={size * 0.68} viewBox={`0 0 ${size} ${size * 0.68 + 5}`}>
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(0, 72%, 55%)" />
          <stop offset="33%" stopColor="hsl(30, 90%, 55%)" />
          <stop offset="66%" stopColor="hsl(45, 85%, 50%)" />
          <stop offset="100%" stopColor="hsl(150, 60%, 45%)" />
        </linearGradient>
        <filter id="needleGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="arcGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dark circular background */}
      <circle cx={cx} cy={cy} r={radius + 16} fill="hsl(220, 18%, 6%)" stroke="hsl(220, 14%, 12%)" strokeWidth={2} />
      {/* Inner subtle ring */}
      <circle cx={cx} cy={cy} r={radius - 10} fill="none" stroke="hsl(220, 14%, 10%)" strokeWidth={0.5} />

      {/* Background arc */}
      <path d={bgPath} fill="none" stroke="hsl(220, 14%, 14%)" strokeWidth={12} strokeLinecap="round" />

      {/* Glow arc (behind main arc) */}
      {percentage > 0 && (
        <path d={valPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={12} strokeLinecap="round" filter="url(#arcGlow)" opacity={0.5} />
      )}
      {/* Value arc */}
      {percentage > 0 && (
        <path d={valPath} fill="none" stroke="url(#gaugeGrad)" strokeWidth={12} strokeLinecap="round">
          <animate attributeName="stroke-dasharray" from="0 1000" to="1000 0" dur="1.2s" fill="freeze" />
        </path>
      )}

      {/* Tick marks */}
      {ticks.map((t) => {
        const angle = startAngle + (t / 100) * totalAngle;
        const outer = polarToCart(angle, radius + 6);
        const inner = polarToCart(angle, radius + 1);
        const label = polarToCart(angle, radius + 18);
        return (
          <g key={t}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="hsl(215, 12%, 35%)" strokeWidth={1.5} />
            <text x={label.x} y={label.y} fill="hsl(215, 12%, 45%)" fontSize={8} textAnchor="middle" dominantBaseline="middle">
              {t}%
            </text>
          </g>
        );
      })}

      {/* Needle */}
      <g filter="url(#needleGlow)">
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill={glowColor}
        />
      </g>
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={7} fill={glowColor}>
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={3.5} fill="hsl(220, 18%, 8%)" />
    </svg>
  );
}

function getStatusLabel(pct: number): { emoji: string; label: string; color: string } {
  if (pct >= 100) return { emoji: "🏆", label: "Meta Batida!", color: "text-emerald-400" };
  if (pct >= 70) return { emoji: "🔥", label: "Reta Final", color: "text-[hsl(45,85%,50%)]" };
  if (pct >= 50) return { emoji: "⚡", label: "Acelerando", color: "text-[hsl(30,90%,55%)]" };
  if (pct >= 25) return { emoji: "🔑", label: "Ligando Motor", color: "text-[hsl(45,85%,50%)]" };
  return { emoji: "🚀", label: "Decolagem", color: "text-muted-foreground" };
}

export function SalesGaugeCard({ selectedYear, selectedMonth, totalVendido, totalPropostas }: SalesGaugeCardProps) {
  const { isGestor } = useUserRole();
  const mesRef = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const [meta, setMeta] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("sales_goals")
      .select("meta")
      .eq("mes_ref", mesRef)
      .maybeSingle()
      .then(({ data }) => {
        setMeta(data?.meta ? Number(data.meta) : 0);
        setLoading(false);
      });
  }, [mesRef]);

  const progress = meta > 0 ? (totalVendido / meta) * 100 : 0;
  const falta = meta > 0 ? Math.max(meta - totalVendido, 0) : 0;
  const status = getStatusLabel(progress);

  // Days calculation
  const now = new Date();
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
  const daysRemaining = Math.max(daysInMonth - currentDay, 0);

  // Brazilian national holidays (fixed dates)
  const fixedHolidays = [
    [1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [12, 25],
  ];
  // Easter-based movable holidays
  function getEasterDate(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }
  const easter = getEasterDate(selectedYear);
  const movableHolidays = [
    new Date(easter.getTime() - 47 * 86400000), // Carnaval (terça)
    new Date(easter.getTime() - 48 * 86400000), // Carnaval (segunda)
    new Date(easter.getTime() - 2 * 86400000),  // Sexta-feira Santa
    new Date(easter.getTime() + 60 * 86400000), // Corpus Christi
  ];

  const holidaySet = new Set<string>();
  fixedHolidays.forEach(([m, d]) => {
    if (m === selectedMonth + 1) holidaySet.add(`${selectedYear}-${m}-${d}`);
  });
  movableHolidays.forEach((dt) => {
    if (dt.getMonth() === selectedMonth && dt.getFullYear() === selectedYear) {
      holidaySet.add(`${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`);
    }
  });

  // Count Sundays, holidays, and business days remaining
  let sundaysInMonth = 0;
  let holidaysInMonth = holidaySet.size;
  let businessDaysRemaining = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(selectedYear, selectedMonth, d);
    const isSunday = dt.getDay() === 0;
    const key = `${selectedYear}-${selectedMonth + 1}-${d}`;
    const isHoliday = holidaySet.has(key);
    if (isSunday) sundaysInMonth++;
    if (d > currentDay) {
      if (!isSunday && !isHoliday) businessDaysRemaining++;
    }
  }

  // Daily targets based on business days
  const ticketMedio = totalPropostas > 0 ? totalVendido / totalPropostas : 0;
  const effectiveDays = businessDaysRemaining > 0 ? businessDaysRemaining : Math.max(daysRemaining, 1);
  const creditosDia = falta > 0 ? falta / effectiveDays : 0;
  const cotasDia = ticketMedio > 0 && effectiveDays > 0 ? falta / ticketMedio / effectiveDays : 0;

  const handleSave = async () => {
    const newMeta = parseFloat(inputValue.replace(/\./g, "").replace(",", "."));
    if (isNaN(newMeta) || newMeta < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("sales_goals")
      .upsert({ mes_ref: mesRef, meta: newMeta }, { onConflict: "mes_ref" });
    if (error) {
      toast({ title: "Erro ao salvar meta", description: error.message, variant: "destructive" });
      return;
    }
    setMeta(newMeta);
    setEditing(false);
    toast({ title: "Meta atualizada!" });
  };

  const startEditing = () => {
    setInputValue(meta > 0 ? meta.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "");
    setEditing(true);
  };

  if (loading) return null;

  return (
    <div className="glass-card p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[hsl(45,85%,50%)]" />
          <span className="text-xs sm:text-sm text-muted-foreground font-medium">Meta Mensal</span>
        </div>
        {isGestor && !editing && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEditing}>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ex: 20000000"
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleSave}>
            <Check className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEditing(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : meta > 0 ? (
        <>
          {/* Gauge */}
          <div className="flex flex-col items-center gap-1">
            <GaugeMeter percentage={progress} />
            <div className="text-center mt-1 space-y-1">
              <p className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                {formatBRL(totalVendido)}
              </p>
              <p className="text-[11px] sm:text-sm text-muted-foreground">
                de {formatBRL(meta)}
              </p>
              <span className="inline-block px-3 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs sm:text-sm font-bold">
                {progress.toFixed(1)}%
              </span>
              <p className={`text-sm font-semibold ${status.color}`}>
                {status.emoji} {status.label}
              </p>
            </div>
          </div>

          {/* Para bater a meta */}
          {falta > 0 && daysRemaining > 0 && (
            <div className="glass-card p-3 sm:p-4 space-y-3 border border-border/50">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[hsl(45,85%,50%)]" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  Para bater a meta até o fim do mês
                </span>
              </div>

              {/* Dias info */}
              <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
                <span><strong className="text-foreground">{businessDaysRemaining}</strong> dias úteis restantes</span>
                <span>·</span>
                <span>{sundaysInMonth} dom</span>
                <span>·</span>
                <span>{holidaysInMonth} feriado{holidaysInMonth !== 1 ? "s" : ""}</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="glass-card p-3 text-center space-y-0.5">
                  <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Falta Vender</span>
                  <p className="text-lg sm:text-xl font-bold text-destructive">{formatBRL(falta)}</p>
                  <span className="text-[10px] text-muted-foreground">em créditos</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="glass-card p-3 text-center space-y-0.5">
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Créditos / Dia Útil</span>
                    <p className="text-sm sm:text-lg font-bold text-[hsl(45,85%,50%)]">{formatBRL(creditosDia)}</p>
                    <span className="text-[10px] text-muted-foreground">por dia útil restante</span>
                  </div>
                  <div className="glass-card p-3 text-center space-y-0.5">
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Cotas / Dia Útil</span>
                    <p className="text-sm sm:text-lg font-bold text-[hsl(45,85%,50%)]">{cotasDia.toFixed(1)}</p>
                    <span className="text-[10px] text-muted-foreground">ticket médio {formatCompact(ticketMedio)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm">
          {isGestor ? "Clique no lápis para definir a meta" : "Meta não definida"}
        </div>
      )}
    </div>
  );
}
