import { createContext, useContext, useState, ReactNode } from "react";
import { BROKER_TEAMS, ALL_BROKERS } from "@/lib/seller-names";

export type TeamFilter = "all" | "Swat" | "The Closers" | "Efraim";

const TEAMS: TeamFilter[] = ["all", "Swat", "The Closers", "Efraim"];

interface TeamFilterCtx {
  team: TeamFilter;
  setTeam: (t: TeamFilter) => void;
  teams: TeamFilter[];
  /** Returns only the brokers matching the current filter */
  filteredBrokers: string[];
  /** Check if a broker name passes the current team filter */
  matchesTeam: (brokerName: string) => boolean;
}

const Ctx = createContext<TeamFilterCtx | null>(null);

export function TeamFilterProvider({ children }: { children: ReactNode }) {
  const [team, setTeam] = useState<TeamFilter>("all");

  const filteredBrokers =
    team === "all"
      ? ALL_BROKERS
      : ALL_BROKERS.filter((b) => BROKER_TEAMS[b] === team);

  const matchesTeam = (name: string) => {
    if (team === "all") return true;
    return BROKER_TEAMS[name] === team;
  };

  return (
    <Ctx.Provider value={{ team, setTeam, teams: TEAMS, filteredBrokers, matchesTeam }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTeamFilter() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTeamFilter must be inside TeamFilterProvider");
  return ctx;
}
