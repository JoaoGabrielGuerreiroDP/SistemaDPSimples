import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Achievement } from "@/lib/achievements";

export interface CustomBadge {
  /** ID estável (uuid) */
  id: string;
  name: string;
  /** URL pública do ícone (storage) */
  icon_url: string;
  /** Nota opcional escrita por quem premiou */
  note?: string | null;
  /** Data ISO de quando foi atribuída */
  awarded_at?: string;
}

interface Props {
  achievements: Achievement[];
  /** Conquistas customizadas (criadas manualmente pelo gestor/líder) */
  customAchievements?: CustomBadge[];
  /** Tamanho do ícone em px (padrão 22) */
  size?: number;
  /** Máximo de ícones exibidos antes de "+N" */
  max?: number;
}

/**
 * Renderiza ícones de conquistas (dinâmicas + customizadas) com tooltip.
 * Customizadas vêm primeiro pra dar destaque ao prêmio manual.
 */
export function AchievementBadges({
  achievements,
  customAchievements = [],
  size = 22,
  max = 5,
}: Props) {
  const total = (achievements?.length || 0) + customAchievements.length;
  if (total === 0) return null;

  // Customizadas primeiro (limitadas), depois dinâmicas, respeitando o `max`
  const customSlice = customAchievements.slice(0, max);
  const remaining = Math.max(0, max - customSlice.length);
  const dynSlice = achievements.slice(0, remaining);
  const overflow = total - customSlice.length - dynSlice.length;

  return (
    <div className="flex flex-wrap gap-0.5 justify-center items-center">
      {customSlice.map((c) => (
        <Tooltip key={`c-${c.id}`} delayDuration={100}>
          <TooltipTrigger asChild>
            <div className="relative cursor-help">
              <img
                src={c.icon_url}
                alt={c.name}
                width={size}
                height={size}
                loading="lazy"
                className="object-contain drop-shadow-sm"
                style={{ width: size, height: size }}
              />
              {/* Marcador discreto de conquista customizada */}
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-fuchsia-500 ring-1 ring-background" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[220px]">
            <p className="font-bold">{c.name}</p>
            {c.note && <p className="text-muted-foreground italic">"{c.note}"</p>}
            {c.awarded_at && (
              <p className="text-[10px] text-fuchsia-500 dark:text-fuchsia-400 mt-0.5 font-semibold">
                Concedida em {new Date(c.awarded_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      ))}

      {dynSlice.map((a) => (
        <Tooltip key={a.key} delayDuration={100}>
          <TooltipTrigger asChild>
            <div className="relative cursor-help">
              <img
                src={a.img}
                alt={a.name}
                width={size}
                height={size}
                loading="lazy"
                className="object-contain drop-shadow-sm"
                style={{ width: size, height: size }}
              />
              {a.count && a.count > 1 && (
                <span className="absolute -bottom-0.5 -right-1 text-[7px] font-bold leading-none px-1 py-px rounded-full bg-amber-500 text-amber-950 shadow">
                  ×{a.count}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[200px]">
            <p className="font-bold">{a.name}</p>
            <p className="text-muted-foreground">{a.desc}</p>
            {a.detail && (
              <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5 font-semibold">
                {a.detail}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-500/25 text-amber-800 dark:text-amber-200 leading-none">
          +{overflow}
        </span>
      )}
    </div>
  );
}
