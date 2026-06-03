import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  logo_url: string | null;
  brand_color: string | null;
}

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("sort_order");
    setCompanies(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  return { companies, loading, reload: loadCompanies };
}
