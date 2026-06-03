import { useState, useEffect, useMemo } from "react";
import { SaleRow } from "@/hooks/useGoogleSheetsData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const REACTION_EMOJIS = ["🔥", "👏", "🎉", "💪", "🚀", "⭐"];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function timeAgo(dateStr: string): string {
  const parts = dateStr.split("/");
  if (parts.length < 2) return dateStr;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parts.length >= 3 ? parseInt(parts[2], 10) : new Date().getFullYear();
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month, day);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d atrás`;
  return `${day}/${month + 1}`;
}

function saleKey(row: SaleRow, index: number): string {
  return `${row.dataVenda}_${row.corretor}_${row.valor}_${index}`;
}

interface ReactionData {
  emoji: string;
  count: number;
  userReacted: boolean;
  userNames: string[];
}

interface SalesActivityFeedProps {
  rows: SaleRow[];
  monthLabel: string;
}

export function SalesActivityFeed({ rows, monthLabel }: SalesActivityFeedProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Record<string, { emoji: string; user_id: string }[]>>({});
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);

  // Sort by date descending, take recent
  const recentSales = useMemo(() => {
    const indexed = rows.map((r, i) => ({ ...r, _idx: i }));
    return indexed
      .sort((a, b) => {
        const parseDate = (d: string) => {
          const p = d.split("/");
          if (p.length < 2) return 0;
          const day = parseInt(p[0], 10);
          const month = parseInt(p[1], 10);
          const year = p.length >= 3 ? parseInt(p[2], 10) : 0;
          return (year < 100 ? 2000 + year : year) * 10000 + month * 100 + day;
        };
        return parseDate(b.dataVenda || "") - parseDate(a.dataVenda || "");
      })
      .slice(0, showAll ? 30 : 8);
  }, [rows, showAll]);

  const saleKeys = useMemo(
    () => recentSales.map((r) => saleKey(r, r._idx)),
    [recentSales]
  );

  // Load profiles for name display
  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((p) => {
          if (p.display_name) map[p.user_id] = p.display_name;
        });
        setProfileNames(map);
      });
  }, []);

  // Load reactions
  useEffect(() => {
    if (saleKeys.length === 0) return;
    supabase
      .from("sales_reactions")
      .select("sale_key, emoji, user_id")
      .in("sale_key", saleKeys)
      .then(({ data }) => {
        const map: Record<string, { emoji: string; user_id: string }[]> = {};
        (data || []).forEach((r) => {
          if (!map[r.sale_key]) map[r.sale_key] = [];
          map[r.sale_key].push({ emoji: r.emoji, user_id: r.user_id });
        });
        setReactions(map);
      });
  }, [saleKeys]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("sales-reactions-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as { sale_key: string; emoji: string; user_id: string };
          setReactions((prev) => ({
            ...prev,
            [row.sale_key]: [...(prev[row.sale_key] || []), { emoji: row.emoji, user_id: row.user_id }],
          }));
        }
        if (payload.eventType === "DELETE") {
          const row = payload.old as { sale_key: string; emoji: string; user_id: string };
          setReactions((prev) => ({
            ...prev,
            [row.sale_key]: (prev[row.sale_key] || []).filter(
              (r) => !(r.emoji === row.emoji && r.user_id === row.user_id)
            ),
          }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Each user can only send 1 emoji per sale — optimistic update + upsert
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const notifySaleOwner = async (saleKeyStr: string, emoji: string) => {
    if (!user) return;
    // sale_key format: "date_broker_value_index" e.g. "01/04/2026_João Silva_150000_3"
    // Split and extract broker: between first segment (date with /) and last two numeric segments
    const lastUnderscore = saleKeyStr.lastIndexOf("_");
    if (lastUnderscore === -1) return;
    const withoutIndex = saleKeyStr.substring(0, lastUnderscore);
    const secondLastUnderscore = withoutIndex.lastIndexOf("_");
    if (secondLastUnderscore === -1) return;
    const withoutValue = withoutIndex.substring(0, secondLastUnderscore);
    const firstUnderscore = withoutValue.indexOf("_");
    if (firstUnderscore === -1) return;
    const brokerName = withoutValue.substring(firstUnderscore + 1);
    if (!brokerName) return;

    // Find broker user_id from profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .ilike("display_name", `%${brokerName}%`)
      .limit(1);

    const targetUserId = profiles?.[0]?.user_id;
    if (!targetUserId || targetUserId === user.id) return; // don't self-notify

    const reactorName = profileNames[user.id] || user.user_metadata?.display_name || user.email || "Alguém";
    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: "reaction",
      title: `${reactorName} reagiu ${emoji} à sua venda`,
      message: `Reação na atividade de vendas`,
      metadata: { sale_key: saleKeyStr, emoji, reactor_id: user.id },
    });
  };

  const toggleReaction = async (key: string, emoji: string) => {
    if (!user || pendingKeys.has(key)) return;

    setPendingKeys((prev) => new Set(prev).add(key));

    try {
      const currentReactions = reactions[key] || [];
      const userExisting = currentReactions.find((r) => r.user_id === user.id);
      const isSameEmoji = userExisting?.emoji === emoji;

      // Optimistic: update state immediately
      setReactions((prev) => {
        const filtered = (prev[key] || []).filter((r) => r.user_id !== user.id);
        if (isSameEmoji) {
          return { ...prev, [key]: filtered };
        }
        return { ...prev, [key]: [...filtered, { emoji, user_id: user.id }] };
      });

      if (isSameEmoji) {
        await supabase
          .from("sales_reactions")
          .delete()
          .eq("sale_key", key)
          .eq("user_id", user.id);
      } else if (userExisting) {
        await supabase
          .from("sales_reactions")
          .delete()
          .eq("sale_key", key)
          .eq("user_id", user.id);
        await supabase
          .from("sales_reactions")
          .insert({ sale_key: key, user_id: user.id, emoji });
        notifySaleOwner(key, emoji);
      } else {
        await supabase
          .from("sales_reactions")
          .insert({ sale_key: key, user_id: user.id, emoji });
        notifySaleOwner(key, emoji);
      }
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const getReactionsSummary = (key: string): ReactionData[] => {
    const items = reactions[key] || [];
    const emojiMap: Record<string, { count: number; userReacted: boolean; userNames: string[] }> = {};
    items.forEach((r) => {
      if (!emojiMap[r.emoji]) emojiMap[r.emoji] = { count: 0, userReacted: false, userNames: [] };
      emojiMap[r.emoji].count += 1;
      emojiMap[r.emoji].userNames.push(profileNames[r.user_id] || "Alguém");
      if (r.user_id === user?.id) emojiMap[r.emoji].userReacted = true;
    });
    return Object.entries(emojiMap).map(([emoji, data]) => ({ emoji, ...data }));
  };

  // Check if user already reacted to a sale
  const userHasReacted = (key: string): boolean => {
    return (reactions[key] || []).some((r) => r.user_id === user?.id);
  };

  if (recentSales.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="glass-card p-3 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <h2 className="font-display text-sm sm:text-lg font-semibold text-foreground">
            Atividades Recentes
          </h2>
          <span className="text-[10px] sm:text-xs text-muted-foreground">— {monthLabel}</span>
        </div>

        <div className="space-y-1.5">
          {recentSales.map((sale, idx) => {
            const key = saleKey(sale, sale._idx);
            const reactionsList = getReactionsSummary(key);
            const alreadyReacted = userHasReacted(key);

            return (
              <div
                key={key}
                className="flex flex-col gap-1 p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[hsl(45,85%,50%)] shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {sale.corretor || "Corretor"}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
                      vendeu
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-primary shrink-0">
                      {formatBRL(sale.valor)}
                    </span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">
                    {timeAgo(sale.dataVenda || "")}
                  </span>
                </div>

                {/* Details */}
                <div className="flex items-center gap-2 ml-5 sm:ml-[22px] flex-wrap">
                  {sale.administradora && (
                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {sale.administradora}
                    </span>
                  )}
                  {sale.time && (
                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {sale.time}
                    </span>
                  )}
                </div>

                {/* Reactions */}
                <div className="flex items-center gap-1 ml-5 sm:ml-[22px] flex-wrap">
                  {reactionsList.map((r) => (
                    <Tooltip key={r.emoji}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => toggleReaction(key, r.emoji)}
                          className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                            r.userReacted
                              ? "bg-primary/20 border border-primary/40 text-primary"
                              : "bg-muted/60 border border-border/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {r.emoji} {r.count}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                        <p className="font-medium">{r.userNames.join(", ")}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}

                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-muted/40 border border-border/30 text-muted-foreground hover:bg-muted/70 transition-colors">
                        {alreadyReacted ? "✓" : "+"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1.5" side="top" align="start">
                      <div className="flex gap-1">
                        {REACTION_EMOJIS.map((emoji) => {
                          const userCurrentEmoji = (reactions[key] || []).find((r) => r.user_id === user?.id)?.emoji;
                          const isSelected = userCurrentEmoji === emoji;
                          return (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(key, emoji)}
                              className={`text-base sm:text-lg transition-transform p-1 rounded hover:bg-muted ${
                                isSelected ? "scale-125 bg-primary/20 ring-1 ring-primary/40" : "hover:scale-125"
                              }`}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>

        {rows.length > 8 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Mostrar menos" : `Ver mais (${Math.min(rows.length, 30) - 8} vendas)`}
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
