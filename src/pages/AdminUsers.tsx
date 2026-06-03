import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { ALL_PERMISSIONS } from "@/hooks/usePermissions";
import { useTeamManagers, useAssignTeamManager } from "@/hooks/useTeamManager";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Shield, Users, ShoppingCart, Loader2, Building2, Crown, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface UserWithRole {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: AppRole | null;
  role_id: string | null;
  permissions: string[];
}

const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  vendedor: "Corretor",
  gestor_hub: "Gestor do HUB",
};

const roleIcons: Record<AppRole, typeof Shield> = {
  admin: Shield,
  gestor: Users,
  vendedor: ShoppingCart,
  gestor_hub: Building2,
};

const SALES_TEAMS = ["Swat", "The Closers", "Efraim"];
const ROLE_PRIORITY: Record<AppRole, number> = {
  admin: 4,
  gestor: 3,
  gestor_hub: 2,
  vendedor: 1,
};

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const { isGestor, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const { data: teamManagers = [] } = useTeamManagers();
  const assignTeam = useAssignTeamManager();

  const loadUsers = async () => {
    setLoading(true);

    const [profilesRes, rolesRes, permsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url"),
      supabase.from("user_roles").select("id, user_id, role"),
      supabase.from("user_permissions").select("user_id, permission"),
    ]);

    if (profilesRes.error || rolesRes.error || permsRes.error) {
      toast({
        title: "Erro ao carregar usuários",
        description: profilesRes.error?.message || rolesRes.error?.message || permsRes.error?.message || "Não foi possível buscar os dados.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const perms = permsRes.data || [];

    const userList: UserWithRole[] = profiles.map((p) => {
      const userRoles = roles
        .filter((r) => r.user_id === p.user_id)
        .sort((a, b) => ROLE_PRIORITY[(b.role as AppRole) ?? "vendedor"] - ROLE_PRIORITY[(a.role as AppRole) ?? "vendedor"]);
      const primaryRole = userRoles[0];
      const userPerms = perms.filter((pm) => pm.user_id === p.user_id).map((pm) => pm.permission);

      return {
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: (p as any).avatar_url ?? null,
        role: (primaryRole?.role as AppRole) ?? null,
        role_id: primaryRole?.id ?? null,
        permissions: userPerms,
      };
    });

    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !roleLoading && isGestor) {
      loadUsers();
    }
  }, [authLoading, roleLoading, isGestor]);

  const toggleUserDetails = (userId: string) => {
    setExpandedUser((current) => (current === userId ? null : userId));
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const existing = users.find((u) => u.user_id === userId);
    if (!existing) return;

    if (existing.role_id) {
      const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("id", existing.role_id);
      if (error) {
        toast({ title: "Erro ao atualizar papel", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) {
        toast({ title: "Erro ao atribuir papel", description: error.message, variant: "destructive" });
        return;
      }
    }

    toast({ title: "Papel atualizado!", description: `${existing.display_name} agora é ${roleLabels[newRole]}.` });
    loadUsers();
  };

  const handlePermissionToggle = async (userId: string, permission: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase.from("user_permissions").insert({ user_id: userId, permission });
      if (error && !error.message.includes("duplicate")) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("user_permissions").delete().eq("user_id", userId).eq("permission", permission);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId
          ? { ...u, permissions: checked ? [...u.permissions, permission] : u.permissions.filter((p) => p !== permission) }
          : u
      )
    );
  };

  const handleSelectAll = async (userId: string) => {
    const allKeys = ALL_PERMISSIONS.map((p) => p.key);
    const existing = users.find((u) => u.user_id === userId);
    if (!existing) return;

    const missing = allKeys.filter((k) => !existing.permissions.includes(k));
    if (missing.length > 0) {
      const rows = missing.map((p) => ({ user_id: userId, permission: p }));
      await supabase.from("user_permissions").insert(rows);
    }

    setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, permissions: allKeys } : u)));
  };

  const handleRemoveAll = async (userId: string) => {
    await supabase.from("user_permissions").delete().eq("user_id", userId);
    setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, permissions: [] } : u)));
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  if (!isGestor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card p-8 text-center space-y-4">
          <Shield className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="font-display text-xl font-bold text-foreground">Acesso negado</h2>
          <p className="text-muted-foreground">Apenas administradores podem acessar esta página.</p>
          <Button onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold text-foreground">Gerenciar Usuários</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const isSelf = u.user_id === user?.id;
              const isExpanded = expandedUser === u.user_id;

              return (
                <div key={u.user_id} className="glass-card border border-border/50 overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleUserDetails(u.user_id)}
                        aria-expanded={isExpanded}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={u.avatar_url || undefined} alt={u.display_name || ""} />
                          <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                            {(u.display_name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">
                            {u.display_name || "Sem nome"}
                            {isSelf && <span className="text-xs text-muted-foreground ml-2">(você)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.role ? roleLabels[u.role] : "Sem papel"} · {u.permissions.length} permissões
                          </p>
                        </div>
                      </button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 shrink-0 px-2 text-xs"
                        onClick={() => toggleUserDetails(u.user_id)}
                      >
                        {isExpanded ? (
                          <>
                            Ocultar <ChevronUp className="w-4 h-4 ml-1" />
                          </>
                        ) : (
                          <>
                            Detalhes <ChevronDown className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>

                    <Select
                      value={u.role || ""}
                      onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}
                      disabled={isSelf}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue placeholder="Definir papel" />
                      </SelectTrigger>
                      <SelectContent>
                        {(["admin", "gestor", "gestor_hub", "vendedor"] as AppRole[]).map((r) => {
                          const Icon = roleIcons[r];
                          return (
                            <SelectItem key={r} value={r}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-3 h-3" />
                                {roleLabels[r]}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          <p className="text-sm font-medium text-foreground">Gestor do Time</p>
                        </div>
                        <Select
                          value={teamManagers.find((tm) => tm.user_id === u.user_id)?.team_name || "none"}
                          onValueChange={(val) => {
                            assignTeam.mutate(
                              { userId: u.user_id, teamName: val === "none" ? null : val },
                              {
                                onSuccess: () => toast({ title: "Time atualizado!" }),
                                onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
                              }
                            );
                          }}
                        >
                          <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Nenhum time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum time</SelectItem>
                            {SALES_TEAMS.map((t) => {
                              const current = teamManagers.find((tm) => tm.team_name === t);
                              const taken = current && current.user_id !== u.user_id;
                              return (
                                <SelectItem key={t} value={t}>
                                  {t} {taken ? `(${users.find((x) => x.user_id === current.user_id)?.display_name || "outro"})` : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">Permissões de acesso</p>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleSelectAll(u.user_id)}>
                            Marcar todos
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => handleRemoveAll(u.user_id)}>
                            Remover todos
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ALL_PERMISSIONS.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={u.permissions.includes(perm.key)}
                              onCheckedChange={(checked) => handlePermissionToggle(u.user_id, perm.key, !!checked)}
                            />
                            <span className="text-sm">
                              {perm.icon} {perm.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
