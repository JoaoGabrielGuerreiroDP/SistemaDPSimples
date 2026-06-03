import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import type { Company } from "@/hooks/useCompanies";

interface CompanyCardProps {
  company: Company;
  departmentCount: number;
  okrProgress: number;
  onClick: () => void;
}

export function CompanyCard({ company, departmentCount, okrProgress, onClick }: CompanyCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full glass-card border border-border/50 hover:border-primary/50 transition-all duration-300",
        "p-5 text-left group"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-border/30"
            style={{ backgroundColor: company.brand_color || '#1a1a1a' }}
          >
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-9 h-9 object-contain"
              />
            ) : (
              <span className="text-lg">{company.icon}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-foreground truncate">
              {company.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {departmentCount} {departmentCount === 1 ? "departamento" : "departamentos"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {okrProgress >= 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${okrProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8">{okrProgress}%</span>
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}
