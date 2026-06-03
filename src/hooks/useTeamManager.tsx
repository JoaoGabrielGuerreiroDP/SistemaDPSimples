import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TeamManager {
  id: string;
  user_id: string;
  team_name: string;
}

export function useTeamManagers() {
  return useQuery({
    queryKey: ["team-managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_managers")
        .select("*");
      if (error) throw error;
      return (data || []) as TeamManager[];
    },
  });
}

export function useMyTeam() {
  const { user } = useAuth();
  const { data: managers } = useTeamManagers();
  const myTeam = managers?.find((m) => m.user_id === user?.id);
  return myTeam?.team_name || null;
}

export function useAssignTeamManager() {
  const qc = useQueryClient();

  const assign = useMutation({
    mutationFn: async ({ userId, teamName }: { userId: string; teamName: string | null }) => {
      // Remove any existing assignment for this user
      await supabase.from("team_managers").delete().eq("user_id", userId);

      if (teamName) {
        // Remove any existing manager for this team
        await supabase.from("team_managers").delete().eq("team_name", teamName);
        // Assign
        const { error } = await supabase
          .from("team_managers")
          .insert({ user_id: userId, team_name: teamName });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-managers"] }),
  });

  return assign;
}
