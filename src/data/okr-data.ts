export type Status = "pending" | "in_progress" | "done";

export interface KeyResult {
  id: string;
  title: string;
  status: Status;
}

export interface Objective {
  id: string;
  title: string;
  keyResults: KeyResult[];
}

export type DepartmentId = "educacao" | "consorcios" | "hub" | "solucoes" | "contempladas" | "canceladas";

export interface Department {
  id: DepartmentId;
  name: string;
  icon: string;
  objectives: Objective[];
}

export const initialDepartments: Department[] = [
  {
    id: "educacao",
    name: "DP Educação",
    icon: "🧠",
    objectives: [
      {
        id: "edu-1",
        title: "Estruturar plataforma de cursos",
        keyResults: [
          { id: "edu-kr-1", title: "Criar grupo alunos (IA)", status: "pending" },
          { id: "edu-kr-2", title: "Montar curso na Hotmart", status: "pending" },
          { id: "edu-kr-3", title: "Criar interface dos cursos", status: "pending" },
          { id: "edu-kr-4", title: "Enviar boas-vindas + acessos", status: "pending" },
        ],
      },
      {
        id: "edu-2",
        title: "Definir e organizar produtos",
        keyResults: [
          { id: "edu-kr-5", title: "Criar produtos (low, médio, high ticket)", status: "pending" },
          { id: "edu-kr-6", title: "Organizar produtos low ticket", status: "pending" },
          { id: "edu-kr-7", title: "Estruturar custo, ROI e OKR dos produtos", status: "pending" },
        ],
      },
    ],
  },
  {
    id: "consorcios",
    name: "DP Consórcios",
    icon: "💰",
    objectives: [
      {
        id: "con-1",
        title: "Operação Criciúma",
        keyResults: [
          { id: "con-kr-1", title: "Finalizar locação sala Criciúma", status: "pending" },
          { id: "con-kr-2", title: "Planejamento financeiro Criciúma", status: "pending" },
          { id: "con-kr-3", title: "Reunião com João + Daniel", status: "pending" },
        ],
      },
      {
        id: "con-2",
        title: "Estruturar time comercial",
        keyResults: [
          { id: "con-kr-4", title: "Definir metas (diária, semanal, mensal – CRM/PipeRun)", status: "pending" },
          { id: "con-kr-5", title: "Determinar nível dos vendedores", status: "pending" },
          { id: "con-kr-6", title: "Cadastrar vendedores no CRM", status: "pending" },
          { id: "con-kr-7", title: "Organizar entrevistas", status: "pending" },
          { id: "con-kr-8", title: "Criar organograma comercial", status: "pending" },
          { id: "con-kr-9", title: "Plano de carreira", status: "pending" },
          { id: "con-kr-10", title: "Plano crescimento (100 pessoas)", status: "pending" },
          { id: "con-kr-11", title: "Acompanhamento do time", status: "pending" },
        ],
      },
      {
        id: "con-3",
        title: "Marketing e prospecção",
        keyResults: [
          { id: "con-kr-12", title: "Método de prospecção + playbook", status: "pending" },
          { id: "con-kr-13", title: "Aulão de ligação", status: "pending" },
          { id: "con-kr-14", title: "Tráfego pago + isca digital", status: "pending" },
          { id: "con-kr-15", title: "Jornada do cliente", status: "pending" },
          { id: "con-kr-16", title: "Parcerias (Ferreira + Weber + canais)", status: "pending" },
        ],
      },
      {
        id: "con-4",
        title: "Operações e sistemas",
        keyResults: [
          { id: "con-kr-17", title: "Relatório de vendas (Inteligência Financeira → Ronald)", status: "pending" },
          { id: "con-kr-18", title: "Organizar materiais das administradoras", status: "pending" },
          { id: "con-kr-19", title: "White label", status: "pending" },
          { id: "con-kr-20", title: "Ajustes CRM + conversões + transição", status: "pending" },
          { id: "con-kr-21", title: "Unificação WhatsApp", status: "pending" },
          { id: "con-kr-22", title: "Organização geral (Drive, estrutura, etc.)", status: "pending" },
        ],
      },
    ],
  },
  {
    id: "hub",
    name: "Hub",
    icon: "🧩",
    objectives: [
      {
        id: "hub-1",
        title: "Estruturar operações do Hub",
        keyResults: [
          { id: "hub-kr-1", title: "Criar organograma geral", status: "pending" },
          { id: "hub-kr-2", title: "Definir funções da equipe", status: "pending" },
          { id: "hub-kr-3", title: "Estruturar IA de prospecção (Renato)", status: "pending" },
          { id: "hub-kr-4", title: "Trabalhar leads evento Magalu", status: "pending" },
          { id: "hub-kr-5", title: "Estruturar processos (custo, ROI, jurídico)", status: "pending" },
        ],
      },
    ],
  },
  {
    id: "solucoes",
    name: "DP Soluções e Investimentos",
    icon: "⚙️",
    objectives: [
      {
        id: "sol-1",
        title: "Organizar estrutura operacional",
        keyResults: [
          { id: "sol-kr-1", title: "Criar fluxograma geral da empresa", status: "pending" },
          { id: "sol-kr-2", title: "Definir função de cada pessoa", status: "pending" },
          { id: "sol-kr-3", title: "Estruturar processo de contratação", status: "pending" },
          { id: "sol-kr-4", title: "Criar canais de venda", status: "pending" },
          { id: "sol-kr-5", title: "Organizar estrutura geral da operação", status: "pending" },
        ],
      },
    ],
  },
  {
    id: "contempladas",
    name: "DP Contempladas",
    icon: "🏦",
    objectives: [
      {
        id: "cont-1",
        title: "Lançar operação de contempladas",
        keyResults: [
          { id: "cont-kr-1", title: "Contratar 1 pessoa", status: "pending" },
          { id: "cont-kr-2", title: "Definir estratégia de tráfego pago", status: "pending" },
          { id: "cont-kr-3", title: "Criar projeção de ganhos", status: "pending" },
          { id: "cont-kr-4", title: "Criar projeção de comissão", status: "pending" },
          { id: "cont-kr-5", title: "Levantar demandas do nicho", status: "pending" },
          { id: "cont-kr-6", title: "Executar projeto", status: "pending" },
        ],
      },
    ],
  },
  {
    id: "canceladas",
    name: "DP Canceladas",
    icon: "❌",
    objectives: [
      {
        id: "canc-1",
        title: "Lançar operação de canceladas",
        keyResults: [
          { id: "canc-kr-1", title: "Contratar 1 pessoa", status: "pending" },
          { id: "canc-kr-2", title: "Definir estratégia de tráfego pago", status: "pending" },
          { id: "canc-kr-3", title: "Criar projeção de ganhos", status: "pending" },
          { id: "canc-kr-4", title: "Criar projeção de comissão", status: "pending" },
          { id: "canc-kr-5", title: "Levantar demandas do nicho", status: "pending" },
          { id: "canc-kr-6", title: "Executar projeto", status: "pending" },
        ],
      },
    ],
  },
];
