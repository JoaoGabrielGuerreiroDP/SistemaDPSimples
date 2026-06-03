
-- Create departments table
CREATE TABLE public.departments (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📋',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update departments" ON public.departments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete departments" ON public.departments FOR DELETE TO authenticated USING (true);

-- Create objectives table
CREATE TABLE public.objectives (
  id TEXT NOT NULL PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view objectives" ON public.objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert objectives" ON public.objectives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update objectives" ON public.objectives FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete objectives" ON public.objectives FOR DELETE TO authenticated USING (true);

-- Create key_results table
CREATE TABLE public.key_results (
  id TEXT NOT NULL PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES public.objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view key_results" ON public.key_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert key_results" ON public.key_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update key_results" ON public.key_results FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete key_results" ON public.key_results FOR DELETE TO authenticated USING (true);

-- Seed departments
INSERT INTO public.departments (id, name, icon, sort_order) VALUES
  ('educacao', 'DP Educação', '🧠', 1),
  ('consorcios', 'DP Consórcios', '💰', 2),
  ('hub', 'Hub', '🧩', 3),
  ('solucoes', 'DP Soluções e Investimentos', '⚙️', 4),
  ('contempladas', 'DP Contempladas', '🏦', 5),
  ('canceladas', 'DP Canceladas', '❌', 6);

-- Seed objectives
INSERT INTO public.objectives (id, department_id, title, sort_order) VALUES
  ('edu-1', 'educacao', 'Estruturar plataforma de cursos', 1),
  ('edu-2', 'educacao', 'Definir e organizar produtos', 2),
  ('con-1', 'consorcios', 'Operação Criciúma', 1),
  ('con-2', 'consorcios', 'Estruturar time comercial', 2),
  ('con-3', 'consorcios', 'Marketing e prospecção', 3),
  ('con-4', 'consorcios', 'Operações e sistemas', 4),
  ('hub-1', 'hub', 'Estruturar operações do Hub', 1),
  ('sol-1', 'solucoes', 'Organizar estrutura operacional', 1),
  ('cont-1', 'contempladas', 'Lançar operação de contempladas', 1),
  ('canc-1', 'canceladas', 'Lançar operação de canceladas', 1);

-- Seed key results
INSERT INTO public.key_results (id, objective_id, title, sort_order) VALUES
  ('edu-kr-1', 'edu-1', 'Criar grupo alunos (IA)', 1),
  ('edu-kr-2', 'edu-1', 'Montar curso na Hotmart', 2),
  ('edu-kr-3', 'edu-1', 'Criar interface dos cursos', 3),
  ('edu-kr-4', 'edu-1', 'Enviar boas-vindas + acessos', 4),
  ('edu-kr-5', 'edu-2', 'Criar produtos (low, médio, high ticket)', 1),
  ('edu-kr-6', 'edu-2', 'Organizar produtos low ticket', 2),
  ('edu-kr-7', 'edu-2', 'Estruturar custo, ROI e OKR dos produtos', 3),
  ('con-kr-1', 'con-1', 'Finalizar locação sala Criciúma', 1),
  ('con-kr-2', 'con-1', 'Planejamento financeiro Criciúma', 2),
  ('con-kr-3', 'con-1', 'Reunião com João + Daniel', 3),
  ('con-kr-4', 'con-2', 'Definir metas (diária, semanal, mensal – CRM/PipeRun)', 1),
  ('con-kr-5', 'con-2', 'Determinar nível dos vendedores', 2),
  ('con-kr-6', 'con-2', 'Cadastrar vendedores no CRM', 3),
  ('con-kr-7', 'con-2', 'Organizar entrevistas', 4),
  ('con-kr-8', 'con-2', 'Criar organograma comercial', 5),
  ('con-kr-9', 'con-2', 'Plano de carreira', 6),
  ('con-kr-10', 'con-2', 'Plano crescimento (100 pessoas)', 7),
  ('con-kr-11', 'con-2', 'Acompanhamento do time', 8),
  ('con-kr-12', 'con-3', 'Método de prospecção + playbook', 1),
  ('con-kr-13', 'con-3', 'Aulão de ligação', 2),
  ('con-kr-14', 'con-3', 'Tráfego pago + isca digital', 3),
  ('con-kr-15', 'con-3', 'Jornada do cliente', 4),
  ('con-kr-16', 'con-3', 'Parcerias (Ferreira + Weber + canais)', 5),
  ('con-kr-17', 'con-4', 'Relatório de vendas (Inteligência Financeira → Ronald)', 1),
  ('con-kr-18', 'con-4', 'Organizar materiais das administradoras', 2),
  ('con-kr-19', 'con-4', 'White label', 3),
  ('con-kr-20', 'con-4', 'Ajustes CRM + conversões + transição', 4),
  ('con-kr-21', 'con-4', 'Unificação WhatsApp', 5),
  ('con-kr-22', 'con-4', 'Organização geral (Drive, estrutura, etc.)', 6),
  ('hub-kr-1', 'hub-1', 'Criar organograma geral', 1),
  ('hub-kr-2', 'hub-1', 'Definir funções da equipe', 2),
  ('hub-kr-3', 'hub-1', 'Estruturar IA de prospecção (Renato)', 3),
  ('hub-kr-4', 'hub-1', 'Trabalhar leads evento Magalu', 4),
  ('hub-kr-5', 'hub-1', 'Estruturar processos (custo, ROI, jurídico)', 5),
  ('sol-kr-1', 'sol-1', 'Criar fluxograma geral da empresa', 1),
  ('sol-kr-2', 'sol-1', 'Definir função de cada pessoa', 2),
  ('sol-kr-3', 'sol-1', 'Estruturar processo de contratação', 3),
  ('sol-kr-4', 'sol-1', 'Criar canais de venda', 4),
  ('sol-kr-5', 'sol-1', 'Organizar estrutura geral da operação', 5),
  ('cont-kr-1', 'cont-1', 'Contratar 1 pessoa', 1),
  ('cont-kr-2', 'cont-1', 'Definir estratégia de tráfego pago', 2),
  ('cont-kr-3', 'cont-1', 'Criar projeção de ganhos', 3),
  ('cont-kr-4', 'cont-1', 'Criar projeção de comissão', 4),
  ('cont-kr-5', 'cont-1', 'Levantar demandas do nicho', 5),
  ('cont-kr-6', 'cont-1', 'Executar projeto', 6),
  ('canc-kr-1', 'canc-1', 'Contratar 1 pessoa', 1),
  ('canc-kr-2', 'canc-1', 'Definir estratégia de tráfego pago', 2),
  ('canc-kr-3', 'canc-1', 'Criar projeção de ganhos', 3),
  ('canc-kr-4', 'canc-1', 'Criar projeção de comissão', 4),
  ('canc-kr-5', 'canc-1', 'Levantar demandas do nicho', 5),
  ('canc-kr-6', 'canc-1', 'Executar projeto', 6);
