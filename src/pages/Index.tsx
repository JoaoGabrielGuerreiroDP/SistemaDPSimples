import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { useOKRData, type OKRMode } from "@/hooks/useOKRData";
import { useGamification } from "@/hooks/useGamification";
import { useCompanies } from "@/hooks/useCompanies";
import { GamificationBar } from "@/components/GamificationBar";
import { StatsHeader } from "@/components/StatsHeader";
import { DepartmentCard } from "@/components/DepartmentCard";
import { Button } from "@/components/ui/button";
import { Building2, User, Filter, Trophy, Plus, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

type MainTab = "company" | "personal" | "gamification";
type PersonalFilter = "all" | "assigned" | "pending_assigned";

function OKRContent({ mode, personalFilter, hideDone, userRole, onKRStatusChange }: { mode: OKRMode; personalFilter: PersonalFilter; hideDone: boolean; userRole: string | null; onKRStatusChange?: (status: string) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companies, loading: companiesLoading } = useCompanies();
  const handleObjectiveCompleted = useCallback(() => {
    navigate("/arquivo?tab=ranking");
  }, [navigate]);
  const { departments, loading, toggleStatus, reload } = useOKRData(mode, {
    onObjectiveCompleted: handleObjectiveCompleted,
  });

  const handleToggle = useCallback((deptId: string, objId: string, krId: string) => {
    const kr = departments.find(d => d.id === deptId)
      ?.objectives.find(o => o.id === objId)
      ?.keyResults.find(k => k.id === krId);
    const nextStatusMap: Record<string, string> = { pending: "in_progress", in_progress: "done", done: "pending" };
    if (kr && onKRStatusChange) {
      onKRStatusChange(nextStatusMap[kr.status]);
    }
    toggleStatus(deptId, objId, krId);
  }, [departments, toggleStatus, onKRStatusChange]);

  if (loading || (mode === "company" && companiesLoading)) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  let baseDepts = departments;

  if (mode === "company" && userRole === "vendedor" && user) {
    baseDepts = baseDepts.map((dept) => ({
      ...dept,
      objectives: dept.objectives.map((obj) => ({
        ...obj,
        keyResults: obj.keyResults.filter((kr) => kr.assigned_to === user.id),
      })).filter((obj) => obj.keyResults.length > 0),
    })).filter((dept) => dept.objectives.length > 0);
  }

  let filteredDepts = baseDepts;
  if (mode === "personal" && user) {
    if (personalFilter === "assigned" || personalFilter === "pending_assigned") {
      filteredDepts = filteredDepts.map((dept) => ({
        ...dept,
        objectives: dept.objectives.map((obj) => ({
          ...obj,
          keyResults: obj.keyResults.filter((kr) => {
            if (kr.assigned_to !== user.id) return false;
            if (personalFilter === "pending_assigned" && kr.status === "done") return false;
            return true;
          }),
        })).filter((obj) => obj.keyResults.length > 0),
      })).filter((dept) => dept.objectives.length > 0);
    }
  }
  // Hide completed KRs (after toggle, applies to both tabs)
  if (hideDone) {
    filteredDepts = filteredDepts.map((dept) => ({
      ...dept,
      objectives: dept.objectives.map((obj) => ({
        ...obj,
        keyResults: obj.keyResults.filter((kr) => kr.status !== "done"),
      })).filter((obj) => obj.keyResults.length > 0),
    })).filter((dept) => dept.objectives.length > 0);
  }

  if (filteredDepts.length === 0 && !loading) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        {mode === "company" && userRole === "vendedor"
          ? "Nenhum KR atribuído a você na empresa."
          : personalFilter === "assigned"
            ? "Nenhum KR atribuído a você encontrado."
            : mode === "personal"
              ? "Você ainda não tem OKRs pessoais. Crie em Gerenciar → Pessoal."
              : "Nenhum OKR encontrado."}
      </div>
    );
  }

  // For company mode, group departments by company
  if (mode === "company" && companies.length > 0) {
    const grouped = companies.map((company) => {
      const companyDepts = filteredDepts.filter((d) => (d as any).company_id === company.id);
      return { company, depts: companyDepts };
    }).filter(g => g.depts.length > 0);

    // Departments without a company
    const orphanDepts = filteredDepts.filter((d) => !companies.some(c => c.id === (d as any).company_id));

    return (
      <>
        <StatsHeader departments={filteredDepts} />
        <div className="space-y-6">
          {grouped.map(({ company, depts }) => (
            <div key={company.id} className="space-y-3">
              <div className="flex items-center gap-3 pt-2">
                <div
                  className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-border/30"
                  style={{ backgroundColor: company.brand_color || '#1a1a1a' }}
                >
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="w-7 h-7 object-contain" />
                  ) : (
                    <span className="text-base">{company.icon}</span>
                  )}
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">{company.name}</h2>
              </div>
              {depts.map((dept) => (
                <DepartmentCard key={dept.id} department={dept} onToggleStatus={handleToggle} onKRAdded={reload} />
              ))}
            </div>
          ))}
          {orphanDepts.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-bold text-foreground pt-2">Sem empresa</h2>
              {orphanDepts.map((dept) => (
                <DepartmentCard key={dept.id} department={dept} onToggleStatus={handleToggle} onKRAdded={reload} />
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <StatsHeader departments={filteredDepts} />
      <div className="space-y-4">
        {filteredDepts.map((dept) => (
          <DepartmentCard key={dept.id} department={dept} onToggleStatus={handleToggle} onKRAdded={reload} />
        ))}
      </div>
    </>
  );
}

export default function Index() {
  const { role } = useUserRole();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<MainTab>("company");
  const [personalFilter, setPersonalFilter] = useState<PersonalFilter>("all");
  const [hideDone, setHideDone] = useState(true);
  const { stats, badges, loading: gamLoading, onKRStatusChange } = useGamification();

  const okrMode: OKRMode = mainTab === "personal" ? "personal" : "company";

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-8 space-y-5 relative">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          variant={mainTab === "company" ? "default" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setMainTab("company")}
        >
          <Building2 className="w-4 h-4 mr-1" /> Empresa
        </Button>
        <Button
          variant={mainTab === "personal" ? "default" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setMainTab("personal")}
        >
          <User className="w-4 h-4 mr-1" /> Pessoal
        </Button>
        <Button
          variant={mainTab === "gamification" ? "default" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setMainTab("gamification")}
        >
          <Trophy className="w-4 h-4 mr-1" /> 🏆 Ranking
        </Button>
      </div>

      {mainTab === "personal" && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={personalFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPersonalFilter("all")}
          >
            Todos
          </Button>
          <Button
            variant={personalFilter === "assigned" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPersonalFilter("assigned")}
          >
            <Filter className="w-3.5 h-3.5 mr-1" /> Atribuídos a mim
          </Button>
          <Button
            variant={personalFilter === "pending_assigned" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPersonalFilter("pending_assigned")}
          >
            <Filter className="w-3.5 h-3.5 mr-1" /> Pendentes atribuídos a mim
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHideDone((v) => !v)}
            className="ml-auto"
          >
            {hideDone ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
            {hideDone ? "Mostrar concluídos" : "Ocultar concluídos"}
          </Button>
        </div>
      )}

      {mainTab === "gamification" && (
        <div className="space-y-4">
          {stats && !gamLoading ? (
            <GamificationBar
              xp={stats.xp}
              level={stats.level}
              currentStreak={stats.currentStreak}
              badges={badges}
            />
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Carregando...
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/arquivo?tab=ranking")}>
            🏆 Ver ranking completo e arquivo de OKRs
          </Button>
        </div>
      )}

      {(mainTab === "company" || mainTab === "personal") && (
        <OKRContent mode={okrMode} personalFilter={personalFilter} hideDone={hideDone} userRole={role} onKRStatusChange={onKRStatusChange} />
      )}

      {/* FAB — Adicionar OKR */}
      {((mainTab === "company" && hasPermission("gerenciar")) || mainTab === "personal") && (
        <Button
          onClick={() => navigate("/manage")}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 p-0"
          size="icon"
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}