import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const checkConnection = async () => {
      const { data } = await supabase
        .from("google_calendar_tokens" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsConnected(!!data);
      setLoading(false);
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal_connected") === "true") {
      setIsConnected(true);
      setLoading(false);
      toast.success("Google Calendar conectado!");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("gcal_error")) {
      toast.error("Erro ao conectar Google Calendar");
      window.history.replaceState({}, "", window.location.pathname);
      checkConnection();
    } else {
      checkConnection();
    }
  }, [user]);

  const connect = useCallback(async () => {
    if (!user) return;

    const state = btoa(JSON.stringify({
      user_id: user.id,
      redirect: window.location.origin + window.location.pathname,
    }));

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/google-calendar-auth-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      }
    );

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      toast.error("Erro ao gerar URL de autorização");
    }
  }, [user]);

  const createEvent = useCallback(async (event: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    attendees?: string[];
  }) => {
    setSending(true);
    setSent(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-calendar-create-event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "not_connected" || data.error === "token_refresh_failed") {
          setIsConnected(false);
          throw new Error("Reconecte o Google Calendar");
        }
        throw new Error(data.error || "Erro ao criar evento");
      }

      setSent(true);
      toast.success("✅ Convite enviado com sucesso!");
      return data;
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar convite");
      throw err;
    } finally {
      setSending(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("google_calendar_tokens" as any)
      .delete()
      .eq("user_id", user.id);
    setIsConnected(false);
    setSent(false);
    toast.success("Google Calendar desconectado");
  }, [user]);

  const resetSent = useCallback(() => setSent(false), []);

  return { isConnected, loading, sending, sent, connect, createEvent, disconnect, resetSent };
}
