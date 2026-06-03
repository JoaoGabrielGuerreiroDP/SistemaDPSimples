
-- ============ PLAYBOOK OBJECTIONS ============
CREATE TABLE public.playbook_objections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  objection_text TEXT NOT NULL,
  ai_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved BOOLEAN NOT NULL DEFAULT false,
  shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_playbook_objections_user ON public.playbook_objections(user_id, created_at DESC);
CREATE INDEX idx_playbook_objections_shared ON public.playbook_objections(shared) WHERE shared = true;

ALTER TABLE public.playbook_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own objections"
ON public.playbook_objections FOR SELECT TO authenticated
USING (auth.uid() = user_id OR shared = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users insert own objections"
ON public.playbook_objections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own objections"
ON public.playbook_objections FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users delete own objections"
ON public.playbook_objections FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- ============ DAILY BETS ============
CREATE TABLE public.daily_bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  broker_name TEXT NOT NULL,
  bet_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bet_amount NUMERIC NOT NULL DEFAULT 0,
  actual_amount NUMERIC,
  xp_earned INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | won | partial | lost
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(user_id, bet_date)
);

CREATE INDEX idx_daily_bets_date ON public.daily_bets(bet_date DESC);
CREATE INDEX idx_daily_bets_user ON public.daily_bets(user_id, bet_date DESC);

ALTER TABLE public.daily_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view all bets"
ON public.daily_bets FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users insert own bet"
ON public.daily_bets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bet"
ON public.daily_bets FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admins delete bets"
ON public.daily_bets FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- ============ TEAM MOOD ============
CREATE TABLE public.team_mood (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mood_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT NOT NULL, -- 'happy' | 'neutral' | 'sad'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, mood_date)
);

CREATE INDEX idx_team_mood_date ON public.team_mood(mood_date DESC);

ALTER TABLE public.team_mood ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mood"
ON public.team_mood FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Gestors view all moods"
ON public.team_mood FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Users insert own mood"
ON public.team_mood FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own mood"
ON public.team_mood FOR UPDATE TO authenticated
USING (auth.uid() = user_id);
