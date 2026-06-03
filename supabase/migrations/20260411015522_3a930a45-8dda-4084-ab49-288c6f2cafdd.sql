
-- Gamification stats per user
CREATE TABLE public.user_gamification (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

-- Public read (ranking is public)
CREATE POLICY "Anyone authenticated can view gamification stats"
ON public.user_gamification FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert their own gamification"
ON public.user_gamification FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gamification"
ON public.user_gamification FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Badges earned by users
CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_key TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_icon TEXT NOT NULL DEFAULT '🏅',
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Public read (badges shown on ranking)
CREATE POLICY "Anyone authenticated can view badges"
ON public.user_badges FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert their own badges"
ON public.user_badges FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_gamification_updated_at
BEFORE UPDATE ON public.user_gamification
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
