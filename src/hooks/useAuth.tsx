import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialSessionResolved = false;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const syncProfile = (nextSession: Session | null) => {
      if (!nextSession?.user) return;

      const meta = nextSession.user.user_metadata;
      if (!meta?.avatar_url && !meta?.full_name && !meta?.display_name) return;

      void supabase.from("profiles").upsert(
        {
          user_id: nextSession.user.id,
          display_name: meta.full_name || meta.display_name || nextSession.user.email,
          avatar_url: meta.avatar_url,
          email: nextSession.user.email,
        },
        { onConflict: "user_id" }
      );
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log("[Auth] onAuthStateChange:", event, "session:", !!nextSession);

      if (!initialSessionResolved && event === "INITIAL_SESSION") {
        return;
      }

      applySession(nextSession);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncProfile(nextSession);
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => {
        console.log("[Auth] getSession restored:", !!restoredSession);
        initialSessionResolved = true;
        applySession(restoredSession);
        syncProfile(restoredSession);
      })
      .catch(() => {
        initialSessionResolved = true;
        applySession(null);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
