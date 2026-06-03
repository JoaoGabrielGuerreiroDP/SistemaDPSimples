import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useKRAssignmentNotifier } from "@/hooks/useKRAssignmentNotifier";
import { useUserRole } from "@/hooks/useUserRole";
import { PermissionGate } from "@/components/PermissionGate";
import { AppLayout } from "@/components/AppLayout";
import { ApprovalGate } from "@/components/ApprovalGate";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import Auth from "./pages/Auth.tsx";
import PendingApproval from "./pages/PendingApproval.tsx";

// Lazy load pages
const Home = lazyWithRetry(() => import("./pages/Home.tsx"), "Home");
const Index = lazyWithRetry(() => import("./pages/Index.tsx"), "Index");
const ManageOKR = lazyWithRetry(() => import("./pages/ManageOKR.tsx"), "ManageOKR");
const VendasTempoReal = lazyWithRetry(() => import("./pages/VendasTempoReal.tsx"), "VendasTempoReal");
const AdminUsers = lazyWithRetry(() => import("./pages/AdminUsers.tsx"), "AdminUsers");
const Profile = lazyWithRetry(() => import("./pages/Profile.tsx"), "Profile");
const OKRArchive = lazyWithRetry(() => import("./pages/OKRArchive.tsx"), "OKRArchive");
const RankingPage = lazyWithRetry(() => import("./pages/RankingPage.tsx"), "RankingPage");
const TrainingPaths = lazyWithRetry(() => import("./pages/TrainingPaths.tsx"), "TrainingPaths");
const TreinamentosNotas = lazyWithRetry(() => import("./pages/TreinamentosNotas.tsx"), "TreinamentosNotas");
const TrainingStudentsPage = lazyWithRetry(() => import("./pages/TrainingStudents.tsx"), "TrainingStudentsPage");
const SimuladorConsorcio = lazyWithRetry(() => import("./features/simulador/SimuladorRouter.tsx"), "SimuladorConsorcio");
const SimuladorAdmin = lazyWithRetry(() => import("./pages/admin/SimuladorAdmin.tsx"), "SimuladorAdmin");
const NotFound = lazyWithRetry(() => import("./pages/NotFound.tsx"), "NotFound");
const AccountApprovals = lazyWithRetry(() => import("./pages/AccountApprovals.tsx"), "AccountApprovals");
const Playbook = lazyWithRetry(() => import("./pages/Playbook.tsx"), "Playbook");
const DPNavigatorBuddy = lazyWithRetry(() => import("./pages/DPNavigatorBuddy.tsx"), "DPNavigatorBuddy");
const CalculadoraLance = lazyWithRetry(() => import("./pages/CalculadoraLance.tsx"), "CalculadoraLance");

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
    Carregando...
  </div>
);

function GlobalNotifier() {
  useKRAssignmentNotifier();
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <ApprovalGate>
      <AppLayout>{children}</AppLayout>
    </ApprovalGate>
  );
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GlobalNotifier />
          <BrowserRouter>
            <AppErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                  <Route path="/pending-approval" element={<ApprovalGate><PendingApproval /></ApprovalGate>} />
                  <Route path="/" element={<Navigate to="/home" replace />} />

                  {/* Home */}
                  <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />

                  {/* Tarefas e OKR */}
                  <Route path="/okr" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/manage" element={<ProtectedRoute><ManageOKR /></ProtectedRoute>} />
                  <Route path="/arquivo" element={<ProtectedRoute><OKRArchive /></ProtectedRoute>} />

                  {/* Treinamentos */}
                  <Route path="/treinamentos" element={<ProtectedRoute><TrainingPaths /></ProtectedRoute>} />
                  <Route path="/treinamentos/notas" element={<ProtectedRoute><PermissionGate permission="dashboard"><TreinamentosNotas /></PermissionGate></ProtectedRoute>} />
                  <Route path="/treinamentos/trilhas" element={<Navigate to="/treinamentos" replace />} />
                  <Route path="/treinamentos/alunos" element={<ProtectedRoute><PermissionGate permission="dashboard"><TrainingStudentsPage /></PermissionGate></ProtectedRoute>} />

                  {/* Vendas em Tempo Real */}
                  <Route path="/vendas" element={<ProtectedRoute><PermissionGate permission={["vendas", "dashboard", "meu_painel"]}><VendasTempoReal /></PermissionGate></ProtectedRoute>} />

                  {/* Ranking */}
                  <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />

                  {/* DP Apps */}
                  <Route path="/dp-apps/simulador" element={<ProtectedRoute><SimuladorConsorcio /></ProtectedRoute>} />
                  <Route path="/dp-apps/simulador/admin" element={<ProtectedRoute><SimuladorAdmin /></ProtectedRoute>} />
                  <Route path="/dp-apps/navigator-buddy" element={<ProtectedRoute><DPNavigatorBuddy /></ProtectedRoute>} />
                  <Route path="/dp-apps/calculadora-lance" element={<ProtectedRoute><CalculadoraLance /></ProtectedRoute>} />
                  <Route path="/playbook" element={<ProtectedRoute><Playbook /></ProtectedRoute>} />

                  {/* Administração */}
                  <Route path="/admin/users" element={<ProtectedRoute><PermissionGate permission="usuarios"><AdminUsers /></PermissionGate></ProtectedRoute>} />
                  <Route path="/admin/aprovacoes" element={<ProtectedRoute><PermissionGate permission="usuarios"><AccountApprovals /></PermissionGate></ProtectedRoute>} />
                  <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AppErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
