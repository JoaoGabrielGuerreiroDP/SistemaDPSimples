import {
  Home,
  Settings,
  LogOut,
  Trophy,
  Sun,
  Moon,
  TrendingUp,
  GraduationCap,
  Crown,
  ChevronDown,
  Building2,
  Globe,
  BookOpen,
  Calculator,
  Sparkles,
  Users,
  UserPlus,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <SidebarMenuButton onClick={toggleTheme} className="hover:bg-muted/50">
      {theme === "dark" ? <Sun className="mr-2 h-4 w-4 shrink-0" /> : <Moon className="mr-2 h-4 w-4 shrink-0" />}
      {!collapsed && <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
    </SidebarMenuButton>
  );
}

// ─── DP Apps ──────────────────────────────────────────────────────────────────

function DPAppsGroup({ collapsed, currentPath }: { collapsed: boolean; currentPath: string }) {
  const [openState, setOpen] = useState(currentPath.startsWith("/dp-apps"));
  const open = collapsed ? true : openState;

  return (
    <SidebarGroup className="py-1">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer select-none flex items-center justify-between w-full hover:text-foreground transition-colors h-9 px-3 rounded-md hover:bg-muted/40 group-data-[collapsible=icon]:hidden">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-500" />
              <span className="font-semibold text-xs tracking-wide uppercase">DP Apps</span>
            </span>
            {!collapsed && (
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dp-apps/simulador"
                    className="hover:bg-muted/50"
                    activeClassName="bg-muted text-primary font-medium"
                  >
                    <Calculator className="mr-2 h-4 w-4 shrink-0" />
                    {!collapsed && <span>Simulador de Consórcio</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dp-apps/navigator-buddy"
                    className="hover:bg-muted/50"
                    activeClassName="bg-muted text-primary font-medium"
                  >
                    <Globe className="mr-2 h-4 w-4 shrink-0" />
                    {!collapsed && <span>Alvo Certo</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dp-apps/calculadora-lance"
                    className="hover:bg-muted/50"
                    activeClassName="bg-muted text-primary font-medium"
                  >
                    <Calculator className="mr-2 h-4 w-4 shrink-0" />
                    {!collapsed && <span>Calculadora de Lance</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/playbook"
                    className="hover:bg-muted/50"
                    activeClassName="bg-muted text-primary font-medium"
                  >
                    <BookOpen className="mr-2 h-4 w-4 shrink-0" />
                    {!collapsed && <span>Playbook de Objeções</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

// ─── AppSidebar principal ─────────────────────────────────────────────────────

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { role, isAdmin } = useUserRole();
  const { hasPermission } = usePermissions();

  const mainItems = [
    { title: "Home", url: "/home", icon: Home, show: true },
    { title: "Tarefas e OKR's", url: "/okr", icon: Building2, show: true },
    { title: "Treinamentos", url: "/treinamentos", icon: GraduationCap, show: true },
    {
      title: "Vendas em Tempo Real",
      url: "/vendas",
      icon: TrendingUp,
      show: hasPermission("vendas") || hasPermission("meu_painel") || hasPermission("dashboard"),
    },
    { title: "Ranking", url: "/ranking", icon: Trophy, show: true },
  ];

  const adminItems = [
    {
      title: "Usuários",
      url: "/admin/users",
      icon: Users,
      show: hasPermission("usuarios") && (isAdmin || role === "gestor"),
    },
    {
      title: "Aprovações",
      url: "/admin/aprovacoes",
      icon: UserPlus,
      show: isAdmin || role === "gestor",
    },
    {
      title: "Gerenciar OKRs",
      url: "/manage",
      icon: Settings,
      show: hasPermission("gerenciar") && role !== "vendedor",
    },
  ];

  const visibleMain = mainItems.filter((i) => i.show);
  const visibleAdmin = adminItems.filter((i) => i.show);

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.email || "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 border-b border-border/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => navigate("/perfil")}
            className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-primary/50 transition-all"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} alt={displayName} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        {/* Principal */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-muted-foreground/70">
            DP Soluções e Investimentos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* DP Apps */}
        <DPAppsGroup collapsed={collapsed} currentPath={location.pathname} />

        {/* Administração */}
        {visibleAdmin.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-muted-foreground/70">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/30">
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle collapsed={collapsed} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
