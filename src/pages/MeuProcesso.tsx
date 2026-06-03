import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Users,
  Send,
  CircleDot,
  Target,
  History,
  Calendar,
  TrendingUp,
  Zap,
} from "lucide-react";

const ETAPAS = [
  { value: "Apresentação", color: "bg-blue-500", icon: Users },
  { value: "Envio de Documentos", color: "bg-yellow-500", icon: FileText },
  { value: "Análise Cadastral", color: "bg-orange-500", icon: CircleDot },
  { value: "Implantação", color: "bg-purple-500", icon: Send },
  { value: "Ativo", color: "bg-emerald-500", icon: CheckCircle2 },
];

function etapaProgress(etapa: string) {
  const idx = ETAPAS.findIndex((e) => e.value === etapa);
  if (idx === -1) return 10;
  return ((idx + 1) / ETAPAS.length) * 100;
}

const STATUS_COLORS: Record<string, string> = {
  Aprovado: "text-emerald-400",
  Enviado: "text-blue-400",
  Aguardando: "text-amber-400",
  Pendente: "text-red-400",
};

const STATUS_BG: Record<string, string> = {
  Aprovado: "bg-emerald-500/10 border-emerald-500/20",
  Enviado: "bg-blue-500/10 border-blue-500/20",
  Aguardando: "bg-amber-500/10 border-amber-500/20",
  Pendente: "bg-red-500/10 border-red-500/20",
};

function StatusCard({ label, emoji, status, docs }: { label: string; emoji: string; status: string | null; docs: string | null }) {
  const s = status || "Aguardando";
  const color = STATUS_COLORS[s] || "text-muted-foreground";
  const bg = STATUS_BG[s] || "bg-muted/30 border-border/30";
  return (
    <div className={`rounded-xl border p-3.5 space-y-2 ${bg}`}>
      <p className="text-[11px] text-muted-foreground font-medium">{emoji} {label}</p>
      <div className="flex items-center gap-1.5">
        {s === "Aprovado" && <CheckCircle2 className={`w-4 h-4 ${color}`} />}
        {s === "Enviado" && <Send className={`w-4 h-4 ${color}`} />}
        {s === "Pendente" && <AlertTriangle className={`w-4 h-4 ${color}`} />}
        {s === "Aguardando" && <Clock className={`w-4 h-4 ${color}`} />}
        <span className={`text-sm font-semibold ${color}`}>{s}</span>
      </div>
      {docs && (
        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
          <FileText className="w-3 h-3" /> {docs}
        </p>
      )}
    </div>
  );
}

interface PartnerData {
  id: number;
  nome: string;
  etapa: string;
  cidade: string | null;
  escritorio: string | null;
  prazo: string | null;
  prox_acao: string | null;
  status_mag: string | null;
  status_anc: string | null;
  status_can: string | null;
  docs_mag: string | null;
  docs_anc: string | null;
  docs_can: string | null;
  email_membro: string | null;
  email_afiliado: string | null;
  responsavel: string | null;
}

interface HistoricoItem {
  id: string;
  partner_id: number;
  data: string;
  tipo: string | null;
  acao: string | null;
  adm: string | null;
  etapa: string | null;
  responsavel: string | null;
  status_mag: string | null;
  status_anc: string | null;
  status_can: string | null;
}

function TimelineEvent({ item, isLast }: { item: HistoricoItem; isLast: boolean }) {
  const tipoColors: Record<string, string> = {
    "Cadastro": "bg-emerald-500",
    "Mudança de Etapa": "bg-purple-500",
    "Atualização": "bg-blue-500",
  };
  const dotColor = tipoColors[item.tipo || ""] || "bg-muted-foreground";

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0 mt-1.5 ring-2 ring-background`} />
        {!isLast && <div className="w-px flex-1 bg-border/50 mt-1" />}
      </div>

      {/* Content */}
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground/50 font-mono">
            {new Date(item.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          {item.tipo && (
            <Badge variant="outline" className="text-[9px] h-4 rounded-md border-border/40">
              {item.tipo}
            </Badge>
          )}
          {item.adm && item.adm !== "Todas" && (
            <Badge variant="secondary" className="text-[9px] h-4 rounded-md">
              {item.adm}
            </Badge>
          )}
        </div>
        {item.acao && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.acao}</p>
        )}
      </div>
    </div>
  );
}

function PartnerDetail({ partner, historico }: { partner: PartnerData; historico: HistoricoItem[] }) {
  const progress = etapaProgress(partner.etapa);
  const etapa = ETAPAS.find((e) => e.value === partner.etapa) || ETAPAS[0];
  const EtapaIcon = etapa.icon;
  const isPastDue = partner.prazo && new Date(partner.prazo) < new Date();
  const partnerHistory = historico.filter((h) => h.partner_id === partner.id);

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-card via-card to-primary/5">
        <div className={`h-1 ${etapa.color}`} />
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">{partner.nome}</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                {partner.escritorio && (
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-muted-foreground/50" />{partner.escritorio}</span>
                )}
                {partner.cidade && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-muted-foreground/50" />{partner.cidade}</span>
                )}
              </div>
            </div>
            <Badge className={`text-[11px] border-0 text-white ${etapa.color} gap-1 px-2.5 py-1`}>
              <EtapaIcon className="w-3 h-3" />
              {partner.etapa}
            </Badge>
          </div>

          {/* Etapa pipeline visual */}
          <div className="flex items-center gap-1 py-2">
            {ETAPAS.map((e, i) => {
              const currentIdx = ETAPAS.findIndex((et) => et.value === partner.etapa);
              const passed = i <= currentIdx;
              const isCurrent = i === currentIdx;
              const Icon = e.icon;
              return (
                <div key={e.value} className="flex items-center gap-1 flex-1">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
                    isCurrent ? `${e.color} text-white ring-2 ring-offset-2 ring-offset-background ring-white/20` :
                    passed ? `${e.color} text-white` : "bg-secondary text-muted-foreground/40"
                  }`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  {i < ETAPAS.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full ${passed ? e.color : "bg-secondary"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progresso geral</span>
              <span className="font-bold text-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-secondary/80 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                  progress >= 80 ? "bg-emerald-500" : progress >= 50 ? "bg-blue-500" : progress >= 25 ? "bg-amber-500" : "bg-red-400"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 text-xs">
            {partner.prazo && (
              <span className={`flex items-center gap-1.5 ${isPastDue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                <Calendar className="w-3.5 h-3.5" />
                Prazo: {new Date(partner.prazo).toLocaleDateString("pt-BR")}
              </span>
            )}
            {partner.responsavel && (
              <span className="text-muted-foreground/70">
                Responsável: <span className="text-foreground font-medium">{partner.responsavel}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admin status cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatusCard label="Magalu" emoji="🔵" status={partner.status_mag} docs={partner.docs_mag} />
        <StatusCard label="Âncora" emoji="🔴" status={partner.status_anc} docs={partner.docs_anc} />
        <StatusCard label="Canopus" emoji="🟢" status={partner.status_can} docs={partner.docs_can} />
      </div>

      {/* Next action */}
      {partner.prox_acao && (
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 flex items-start gap-3">
          <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-primary/80 uppercase tracking-wider mb-1">Próxima Ação</p>
            <p className="text-sm text-foreground leading-relaxed">{partner.prox_acao}</p>
          </div>
        </div>
      )}

      {/* Full Timeline */}
      <div className="rounded-2xl border border-border/30 bg-card/60 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/30 flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground/60" />
          <h3 className="text-sm font-semibold text-foreground">Histórico Completo</h3>
          <span className="text-[10px] text-muted-foreground/50 ml-auto">{partnerHistory.length} registros</span>
        </div>
        <div className="p-5">
          {partnerHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhum registro no histórico ainda.</p>
            </div>
          ) : (
            <div>
              {partnerHistory.map((h, i) => (
                <TimelineEvent key={h.id} item={h} isLast={i === partnerHistory.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MeuProcesso() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { partnerId } = useParams<{ partnerId?: string }>();
  const email = user?.email;

  const { data, isLoading } = useQuery({
    queryKey: ["meu-processo", email, partnerId],
    enabled: !!email,
    queryFn: async () => {
      let partners: PartnerData[];

      if (partnerId) {
        // Direct access by partner ID (from Hub link)
        const { data: p, error } = await supabase
          .from("hub_partners")
          .select("id, nome, etapa, cidade, escritorio, prazo, prox_acao, status_mag, status_anc, status_can, docs_mag, docs_anc, docs_can, email_membro, email_afiliado, responsavel")
          .eq("id", Number(partnerId))
          .maybeSingle();
        if (error) throw error;
        partners = p ? [p as PartnerData] : [];
      } else {
        // Default: fetch by email
        const { data: p, error } = await supabase
          .from("hub_partners")
          .select("id, nome, etapa, cidade, escritorio, prazo, prox_acao, status_mag, status_anc, status_can, docs_mag, docs_anc, docs_can, email_membro, email_afiliado, responsavel")
          .or(`email_membro.eq.${email},email_afiliado.eq.${email}`);
        if (error) throw error;
        partners = (p || []) as PartnerData[];
      }

      const partnerIds = partners.map((p) => p.id);
      let historico: HistoricoItem[] = [];
      if (partnerIds.length > 0) {
        const { data: hist } = await supabase
          .from("hub_historico")
          .select("*")
          .in("partner_id", partnerIds)
          .order("data", { ascending: false });
        historico = (hist || []) as HistoricoItem[];
      }

      return { partners, historico };
    },
  });

  const partners = data?.partners || [];
  const historico = data?.historico || [];
  const isDirectView = !!partnerId;
  const myProcess = isDirectView ? partners : partners.filter((p) => p.email_membro === email);
  const myReferred = isDirectView ? [] : partners.filter((p) => p.email_afiliado === email);
  const isMember = myProcess.length > 0;
  const isAffiliate = myReferred.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">
            {isDirectView ? "Detalhes do Parceiro" : "Meu Processo"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {isDirectView ? "Histórico completo e status do onboarding" : "Acompanhe seu onboarding em tempo real"}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <div className="animate-pulse flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
            Carregando...
          </div>
        </div>
      )}

      {!isLoading && !isMember && !isAffiliate && (
        <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Nenhum processo encontrado</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Seu e-mail (<span className="font-mono text-foreground/80">{email}</span>) não está vinculado a nenhum processo no momento.
          </p>
        </div>
      )}

      {isMember && (
        <div className="space-y-5">
          {!isDirectView && (
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Meu Processo de Entrada</h2>
            </div>
          )}
          {myProcess.map((p) => (
            <PartnerDetail key={p.id} partner={p} historico={historico} />
          ))}
        </div>
      )}

      {isAffiliate && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Meus Afilhados ({myReferred.length})
            </h2>
          </div>
          {myReferred.map((p) => (
            <PartnerDetail key={p.id} partner={p} historico={historico} />
          ))}
        </div>
      )}
    </div>
  );
}
