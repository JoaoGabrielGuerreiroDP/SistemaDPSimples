import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  isImportError: boolean;
}

const IMPORT_ERROR_PATTERN = /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    isImportError: false,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);

    return {
      hasError: true,
      isImportError: IMPORT_ERROR_PATTERN.test(message),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary caught an error", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Não foi possível carregar esta tela</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {this.state.isImportError
              ? "O app encontrou uma falha ao carregar um módulo e precisa recarregar a página."
              : "Ocorreu um erro inesperado ao renderizar esta página."}
          </p>
          <Button className="mt-5 w-full" onClick={this.handleReload}>
            <RefreshCw className="h-4 w-4" />
            Recarregar página
          </Button>
        </div>
      </div>
    );
  }
}