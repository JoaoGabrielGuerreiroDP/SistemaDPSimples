export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_approvals: {
        Row: {
          avatar_url: string | null
          decided_at: string | null
          decided_by: string | null
          display_name: string | null
          email: string
          id: string
          requested_at: string
          status: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          decided_at?: string | null
          decided_by?: string | null
          display_name?: string | null
          email: string
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          decided_at?: string | null
          decided_by?: string | null
          display_name?: string | null
          email?: string
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["approval_status"]
          user_id?: string
        }
        Relationships: []
      }
      broker_achievements: {
        Row: {
          achievement_id: string
          awarded_at: string
          awarded_by: string | null
          broker_name: string
          id: string
          note: string | null
        }
        Insert: {
          achievement_id: string
          awarded_at?: string
          awarded_by?: string | null
          broker_name: string
          id?: string
          note?: string | null
        }
        Update: {
          achievement_id?: string
          awarded_at?: string
          awarded_by?: string | null
          broker_name?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "custom_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_atraso: {
        Row: {
          cliente: string | null
          comissao_corretor: number | null
          cota: string | null
          created_at: string
          credito_venda: number | null
          grupo: string | null
          id: string
          parcelas_atraso: number | null
          parcelas_pagas: number | null
          situacao: string | null
          upload_id: string | null
          vendedor: string | null
          vendedor_normalizado: string | null
        }
        Insert: {
          cliente?: string | null
          comissao_corretor?: number | null
          cota?: string | null
          created_at?: string
          credito_venda?: number | null
          grupo?: string | null
          id?: string
          parcelas_atraso?: number | null
          parcelas_pagas?: number | null
          situacao?: string | null
          upload_id?: string | null
          vendedor?: string | null
          vendedor_normalizado?: string | null
        }
        Update: {
          cliente?: string | null
          comissao_corretor?: number | null
          cota?: string | null
          created_at?: string
          credito_venda?: number | null
          grupo?: string | null
          id?: string
          parcelas_atraso?: number | null
          parcelas_pagas?: number | null
          situacao?: string | null
          upload_id?: string | null
          vendedor?: string | null
          vendedor_normalizado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_atraso_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "broker_atraso_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_atraso_uploads: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          total_rows: number
          total_vendedores: number
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          total_rows?: number
          total_vendedores?: number
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          total_rows?: number
          total_vendedores?: number
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      broker_results: {
        Row: {
          cliente: string | null
          cota: string | null
          created_at: string
          credito_gerado: number | null
          dinheiro_na_mesa: number | null
          grupo: string | null
          id: string
          parcelas_pagas: number | null
          pct_comissao: number | null
          pct_estorno: number | null
          upload_id: string | null
          vendedor: string | null
          vendedor_normalizado: string | null
          vlr_estorno: number | null
          vlr_fim_ciclo: number | null
        }
        Insert: {
          cliente?: string | null
          cota?: string | null
          created_at?: string
          credito_gerado?: number | null
          dinheiro_na_mesa?: number | null
          grupo?: string | null
          id?: string
          parcelas_pagas?: number | null
          pct_comissao?: number | null
          pct_estorno?: number | null
          upload_id?: string | null
          vendedor?: string | null
          vendedor_normalizado?: string | null
          vlr_estorno?: number | null
          vlr_fim_ciclo?: number | null
        }
        Update: {
          cliente?: string | null
          cota?: string | null
          created_at?: string
          credito_gerado?: number | null
          dinheiro_na_mesa?: number | null
          grupo?: string | null
          id?: string
          parcelas_pagas?: number | null
          pct_comissao?: number | null
          pct_estorno?: number | null
          upload_id?: string | null
          vendedor?: string | null
          vendedor_normalizado?: string | null
          vlr_estorno?: number | null
          vlr_fim_ciclo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "broker_results_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "broker_results_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_results_uploads: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          total_rows: number
          total_vendedores: number
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          total_rows?: number
          total_vendedores?: number
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          total_rows?: number
          total_vendedores?: number
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      budget_lines: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          amount_cents?: number
          category: string
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          brand_color: string | null
          created_at: string
          icon: string
          id: string
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          icon?: string
          id?: string
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          icon?: string
          id?: string
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      copa_prospections: {
        Row: {
          broker_name: string
          created_at: string
          id: string
          mes_ref: string
          prospections: number
          updated_at: string
        }
        Insert: {
          broker_name: string
          created_at?: string
          id?: string
          mes_ref: string
          prospections?: number
          updated_at?: string
        }
        Update: {
          broker_name?: string
          created_at?: string
          id?: string
          mes_ref?: string
          prospections?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_canceladas: {
        Row: {
          cliente: string
          created_at: string
          created_by: string | null
          extrato_path: string | null
          extrato_url: string | null
          fundo_comum: number | null
          id: string
          melhor_proposta: number | null
          observacoes: string | null
          origem_administradora: string | null
          origem_cliente: string | null
          quem_fez_proposta: string | null
          sort_order: number
          stage: string
          tags: string[] | null
          updated_at: string
          valor_ofertado_cliente: number | null
        }
        Insert: {
          cliente: string
          created_at?: string
          created_by?: string | null
          extrato_path?: string | null
          extrato_url?: string | null
          fundo_comum?: number | null
          id?: string
          melhor_proposta?: number | null
          observacoes?: string | null
          origem_administradora?: string | null
          origem_cliente?: string | null
          quem_fez_proposta?: string | null
          sort_order?: number
          stage?: string
          tags?: string[] | null
          updated_at?: string
          valor_ofertado_cliente?: number | null
        }
        Update: {
          cliente?: string
          created_at?: string
          created_by?: string | null
          extrato_path?: string | null
          extrato_url?: string | null
          fundo_comum?: number | null
          id?: string
          melhor_proposta?: number | null
          observacoes?: string | null
          origem_administradora?: string | null
          origem_cliente?: string | null
          quem_fez_proposta?: string | null
          sort_order?: number
          stage?: string
          tags?: string[] | null
          updated_at?: string
          valor_ofertado_cliente?: number | null
        }
        Relationships: []
      }
      crm_canceladas_origens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      crm_canceladas_propositores: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      crm_prospections: {
        Row: {
          amount: number | null
          created_at: string
          created_at_crm: string | null
          external_id: string
          id: string
          lead_name: string | null
          pipeline_id: string | null
          seller_name: string | null
          source: string
          stage: string | null
          synced_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_at_crm?: string | null
          external_id: string
          id?: string
          lead_name?: string | null
          pipeline_id?: string | null
          seller_name?: string | null
          source: string
          stage?: string | null
          synced_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_at_crm?: string | null
          external_id?: string
          id?: string
          lead_name?: string | null
          pipeline_id?: string | null
          seller_name?: string | null
          source?: string
          stage?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      custom_achievements: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          icon_url: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_bets: {
        Row: {
          actual_amount: number | null
          bet_amount: number
          bet_date: string
          broker_name: string
          created_at: string
          id: string
          resolved_at: string | null
          status: string
          user_id: string
          xp_earned: number | null
        }
        Insert: {
          actual_amount?: number | null
          bet_amount?: number
          bet_date?: string
          broker_name: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          status?: string
          user_id: string
          xp_earned?: number | null
        }
        Update: {
          actual_amount?: number | null
          bet_amount?: number
          bet_date?: string
          broker_name?: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
          xp_earned?: number | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          company_id: string | null
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          name: string
          sort_order: number
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id: string
          name: string
          sort_order?: number
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gescon_sales_goals: {
        Row: {
          created_at: string
          id: string
          mes_ref: string
          meta: number
          updated_at: string
          vendedor: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ref: string
          meta?: number
          updated_at?: string
          vendedor: string
        }
        Update: {
          created_at?: string
          id?: string
          mes_ref?: string
          meta?: number
          updated_at?: string
          vendedor?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_checklist: {
        Row: {
          adm: string | null
          created_at: string
          documento: string
          grupo: string
          id: string
          obrigatorio: string | null
        }
        Insert: {
          adm?: string | null
          created_at?: string
          documento: string
          grupo: string
          id?: string
          obrigatorio?: string | null
        }
        Update: {
          adm?: string | null
          created_at?: string
          documento?: string
          grupo?: string
          id?: string
          obrigatorio?: string | null
        }
        Relationships: []
      }
      hub_checklist_status: {
        Row: {
          checklist_id: string
          id: string
          partner_id: number
          status: string | null
          updated_at: string
        }
        Insert: {
          checklist_id: string
          id?: string
          partner_id: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          id?: string
          partner_id?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_checklist_status_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "hub_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_checklist_status_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "hub_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_historico: {
        Row: {
          acao: string | null
          adm: string | null
          created_at: string
          data: string
          doc_pendente: string | null
          etapa: string | null
          id: string
          partner_id: number
          responsavel: string | null
          status_anc: string | null
          status_can: string | null
          status_mag: string | null
          tipo: string | null
        }
        Insert: {
          acao?: string | null
          adm?: string | null
          created_at?: string
          data?: string
          doc_pendente?: string | null
          etapa?: string | null
          id?: string
          partner_id: number
          responsavel?: string | null
          status_anc?: string | null
          status_can?: string | null
          status_mag?: string | null
          tipo?: string | null
        }
        Update: {
          acao?: string | null
          adm?: string | null
          created_at?: string
          data?: string
          doc_pendente?: string | null
          etapa?: string | null
          id?: string
          partner_id?: number
          responsavel?: string | null
          status_anc?: string | null
          status_can?: string | null
          status_mag?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_historico_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "hub_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_metas: {
        Row: {
          created_at: string
          id: string
          mes_ref: string
          meta_anc: number | null
          meta_can: number | null
          meta_mag: number | null
          partner_id: number
          realizado_anc: number | null
          realizado_can: number | null
          realizado_mag: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ref: string
          meta_anc?: number | null
          meta_can?: number | null
          meta_mag?: number | null
          partner_id: number
          realizado_anc?: number | null
          realizado_can?: number | null
          realizado_mag?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          mes_ref?: string
          meta_anc?: number | null
          meta_can?: number | null
          meta_mag?: number | null
          partner_id?: number
          realizado_anc?: number | null
          realizado_can?: number | null
          realizado_mag?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_metas_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "hub_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_origens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      hub_partners: {
        Row: {
          cidade: string | null
          created_at: string
          docs_anc: string | null
          docs_can: string | null
          docs_mag: string | null
          email_afiliado: string | null
          email_membro: string | null
          escritorio: string | null
          etapa: string
          id: number
          meta_anc: number | null
          meta_can: number | null
          meta_mag: number | null
          nome: string
          obs_anc: string | null
          obs_can: string | null
          obs_mag: string | null
          origem: string | null
          prazo: string | null
          programa20: boolean | null
          prox_acao: string | null
          responsavel: string | null
          status_anc: string | null
          status_can: string | null
          status_mag: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          docs_anc?: string | null
          docs_can?: string | null
          docs_mag?: string | null
          email_afiliado?: string | null
          email_membro?: string | null
          escritorio?: string | null
          etapa?: string
          id?: number
          meta_anc?: number | null
          meta_can?: number | null
          meta_mag?: number | null
          nome: string
          obs_anc?: string | null
          obs_can?: string | null
          obs_mag?: string | null
          origem?: string | null
          prazo?: string | null
          programa20?: boolean | null
          prox_acao?: string | null
          responsavel?: string | null
          status_anc?: string | null
          status_can?: string | null
          status_mag?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          docs_anc?: string | null
          docs_can?: string | null
          docs_mag?: string | null
          email_afiliado?: string | null
          email_membro?: string | null
          escritorio?: string | null
          etapa?: string
          id?: number
          meta_anc?: number | null
          meta_can?: number | null
          meta_mag?: number | null
          nome?: string
          obs_anc?: string | null
          obs_can?: string | null
          obs_mag?: string | null
          origem?: string | null
          prazo?: string | null
          programa20?: boolean | null
          prox_acao?: string | null
          responsavel?: string | null
          status_anc?: string | null
          status_can?: string | null
          status_mag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      key_results: {
        Row: {
          assigned_to: string | null
          created_at: string
          deadline: string | null
          deleted_at: string | null
          id: string
          last_assigned_by: string | null
          objective_id: string
          priority: string
          sort_order: number
          status: string
          status_changed_at: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          id: string
          last_assigned_by?: string | null
          objective_id: string
          priority?: string
          sort_order?: number
          status?: string
          status_changed_at?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          id?: string
          last_assigned_by?: string | null
          objective_id?: string
          priority?: string
          sort_order?: number
          status?: string
          status_changed_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      kr_statuses: {
        Row: {
          id: string
          kr_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kr_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kr_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      objectives: {
        Row: {
          created_at: string
          deadline: string | null
          deleted_at: string | null
          department_id: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          department_id: string
          id: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          deleted_at?: string | null
          department_id?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      partners_onboarding: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          progress: number
          responsible_user_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          progress?: number
          responsible_user_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          progress?: number
          responsible_user_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      playbook_contributions: {
        Row: {
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      playbook_objections: {
        Row: {
          ai_response: Json
          created_at: string
          id: string
          objection_text: string
          saved: boolean
          shared: boolean
          user_id: string
        }
        Insert: {
          ai_response?: Json
          created_at?: string
          id?: string
          objection_text: string
          saved?: boolean
          shared?: boolean
          user_id: string
        }
        Update: {
          ai_response?: Json
          created_at?: string
          id?: string
          objection_text?: string
          saved?: boolean
          shared?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_goals: {
        Row: {
          created_at: string
          id: string
          mes_ref: string
          meta: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ref: string
          meta?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mes_ref?: string
          meta?: number
          updated_at?: string
        }
        Relationships: []
      }
      sales_goals_byname: {
        Row: {
          broker_name: string
          created_at: string
          id: string
          mes_ref: string
          meta: number
          updated_at: string
        }
        Insert: {
          broker_name: string
          created_at?: string
          id?: string
          mes_ref: string
          meta?: number
          updated_at?: string
        }
        Update: {
          broker_name?: string
          created_at?: string
          id?: string
          mes_ref?: string
          meta?: number
          updated_at?: string
        }
        Relationships: []
      }
      sales_goals_individual: {
        Row: {
          created_at: string
          id: string
          mes_ref: string
          meta: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ref: string
          meta?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mes_ref?: string
          meta?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          sale_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          sale_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          sale_key?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_record_breaks: {
        Row: {
          broken_at: string
          broker_name: string
          created_at: string
          id: string
          new_count: number
          new_value: number
          previous_value: number
          record_month: string
        }
        Insert: {
          broken_at?: string
          broker_name: string
          created_at?: string
          id?: string
          new_count?: number
          new_value?: number
          previous_value?: number
          record_month: string
        }
        Update: {
          broken_at?: string
          broker_name?: string
          created_at?: string
          id?: string
          new_count?: number
          new_value?: number
          previous_value?: number
          record_month?: string
        }
        Relationships: []
      }
      sales_records: {
        Row: {
          broker_name: string
          created_at: string
          id: string
          notes: string | null
          record_count: number
          record_month: string | null
          record_value: number
          updated_at: string
        }
        Insert: {
          broker_name: string
          created_at?: string
          id?: string
          notes?: string | null
          record_count?: number
          record_month?: string | null
          record_value?: number
          updated_at?: string
        }
        Update: {
          broker_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          record_count?: number
          record_month?: string | null
          record_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      simulador_grupos: {
        Row: {
          active: boolean
          admin_fee_percent: number
          administradora: string | null
          asset_type: string
          created_at: string
          credit_value: number
          id: string
          payment_half: number
          source_pdf_name: string | null
          term_months: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          admin_fee_percent?: number
          administradora?: string | null
          asset_type: string
          created_at?: string
          credit_value: number
          id?: string
          payment_half: number
          source_pdf_name?: string | null
          term_months: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          admin_fee_percent?: number
          administradora?: string | null
          asset_type?: string
          created_at?: string
          credit_value?: number
          id?: string
          payment_half?: number
          source_pdf_name?: string | null
          term_months?: number
          updated_at?: string
        }
        Relationships: []
      }
      team_managers: {
        Row: {
          created_at: string
          id: string
          team_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_mood: {
        Row: {
          created_at: string
          id: string
          mood: string
          mood_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: string
          mood_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: string
          mood_date?: string
          user_id?: string
        }
        Relationships: []
      }
      training_attachments: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          title: string
          type: string
          url: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          type?: string
          url: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          type?: string
          url?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_attachments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_notes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_path_contents: {
        Row: {
          content_type: string
          created_at: string
          file_path: string | null
          id: string
          path_id: string
          sort_order: number
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          content_type?: string
          created_at?: string
          file_path?: string | null
          id?: string
          path_id: string
          sort_order?: number
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          file_path?: string | null
          id?: string
          path_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_path_contents_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "training_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      training_path_videos: {
        Row: {
          created_at: string
          id: string
          path_id: string
          sort_order: number
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path_id: string
          sort_order?: number
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path_id?: string
          sort_order?: number
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_path_videos_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "training_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_path_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_paths: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_quiz_results: {
        Row: {
          answers: Json
          completed_at: string
          created_at: string
          id: string
          score: number
          total_questions: number
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string
          created_at?: string
          id?: string
          score?: number
          total_questions?: number
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          created_at?: string
          id?: string
          score?: number
          total_questions?: number
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quiz_results_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_ratings_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      training_videos: {
        Row: {
          ai_generated_at: string | null
          ai_quiz: Json | null
          ai_summary: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
          youtube_url: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_quiz?: Json | null
          ai_summary?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          youtube_url: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_quiz?: Json | null
          ai_summary?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          youtube_url?: string
        }
        Relationships: []
      }
      training_watch_status: {
        Row: {
          id: string
          user_id: string
          video_id: string
          watched_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          watched_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_watch_status_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "training_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_description: string | null
          badge_icon: string
          badge_key: string
          badge_name: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_description?: string | null
          badge_icon?: string
          badge_key: string
          badge_name: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_description?: string | null
          badge_icon?: string
          badge_key?: string
          badge_name?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_gamification: {
        Row: {
          best_streak: number
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          level: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          best_streak?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          level?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_account: { Args: { _user_id: string }; Returns: undefined }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_manager: { Args: { _user_id: string }; Returns: boolean }
      reject_account: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "gestor"
        | "vendedor"
        | "gestor_hub"
      approval_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "gestor",
        "vendedor",
        "gestor_hub",
      ],
      approval_status: ["pending", "approved", "rejected"],
    },
  },
} as const
