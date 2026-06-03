import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  userEmail: string;
  userName: string;
  status: string;
  htmlLink: string;
}

async function fetchEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/google-calendar-events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timeMin, timeMax }),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao buscar eventos");
  return data.events || [];
}

export function useCalendarEvents(startDate: Date, endDate: Date) {
  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  return useQuery({
    queryKey: ["calendar-events", timeMin, timeMax],
    queryFn: () => fetchEvents(timeMin, timeMax),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
