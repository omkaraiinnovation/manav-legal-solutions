export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      acts: {
        Row: {
          appeal_forum: string | null
          commencement_date: string | null
          competent_authority: string | null
          coverage_status: string | null
          domains: string[]
          enacted_date: string | null
          full_name: string
          id: string
          jurisdiction_level: string | null
          repealed_by: string | null
          repealed_date: string | null
          short_name: string
          source_url: string
          special_act_tags: string[] | null
          special_court: string | null
          state: string | null
          status: string | null
          summary: string | null
          trust_level: string | null
        }
        Insert: {
          appeal_forum?: string | null
          commencement_date?: string | null
          competent_authority?: string | null
          coverage_status?: string | null
          domains?: string[]
          enacted_date?: string | null
          full_name: string
          id: string
          jurisdiction_level?: string | null
          repealed_by?: string | null
          repealed_date?: string | null
          short_name: string
          source_url: string
          special_act_tags?: string[] | null
          special_court?: string | null
          state?: string | null
          status?: string | null
          summary?: string | null
          trust_level?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["acts"]["Insert"]>
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string | null
          actor_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          tenant_id: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>
        Relationships: []
      }
      case_law: {
        Row: {
          case_title: string
          citation: string | null
          court: string | null
          decided_on: string | null
          embedding: string | null
          holding_summary: string | null
          id: string
          related_provision_ids: string[] | null
          source_url: string
          status: string | null
          trust_level: string | null
        }
        Insert: {
          case_title: string
          citation?: string | null
          court?: string | null
          decided_on?: string | null
          embedding?: string | null
          holding_summary?: string | null
          id: string
          related_provision_ids?: string[] | null
          source_url: string
          status?: string | null
          trust_level?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["case_law"]["Insert"]>
        Relationships: []
      }
      chat_messages: {
        Row: {
          cited_provision_ids: string[] | null
          content: string | null
          created_at: string | null
          id: string
          matter_id: string | null
          role: string | null
        }
        Insert: {
          cited_provision_ids?: string[] | null
          content?: string | null
          created_at?: string | null
          id?: string
          matter_id?: string | null
          role?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>
        Relationships: []
      }
      chronology_events: {
        Row: {
          court_action: string | null
          description: string | null
          event_date: string | null
          evidence_ref: string | null
          id: string
          matter_id: string | null
          next_action: string | null
          person: string | null
          related_document_id: string | null
          related_provision_id: string | null
          source: string | null
        }
        Insert: {
          court_action?: string | null
          description?: string | null
          event_date?: string | null
          evidence_ref?: string | null
          id?: string
          matter_id?: string | null
          next_action?: string | null
          person?: string | null
          related_document_id?: string | null
          related_provision_id?: string | null
          source?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["chronology_events"]["Insert"]>
        Relationships: []
      }
      deadlines: {
        Row: {
          basis: string | null
          due_date: string | null
          id: string
          label: string | null
          matter_id: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          basis?: string | null
          due_date?: string | null
          id?: string
          label?: string | null
          matter_id?: string | null
          source?: string | null
          status?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["deadlines"]["Insert"]>
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          id: string
          matter_id: string | null
          metadata: Json | null
          page_number: number | null
          section_heading: string | null
          tenant_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          matter_id?: string | null
          metadata?: Json | null
          page_number?: number | null
          section_heading?: string | null
          tenant_id: string
        }
        Update: Partial<Database["public"]["Tables"]["document_chunks"]["Insert"]>
        Relationships: []
      }
      document_types: {
        Row: {
          applicable_jurisdiction_levels: string[] | null
          description: string | null
          domains: string[] | null
          family: string | null
          forum: string | null
          id: string
          name: string
          template_skeleton_sections: string[]
          variable_schema: Json
        }
        Insert: {
          applicable_jurisdiction_levels?: string[] | null
          description?: string | null
          domains?: string[] | null
          family?: string | null
          forum?: string | null
          id: string
          name: string
          template_skeleton_sections?: string[]
          variable_schema?: Json
        }
        Update: Partial<Database["public"]["Tables"]["document_types"]["Insert"]>
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string | null
          error_message: string | null
          extracted_text: string | null
          file_name: string
          file_size_bytes: number | null
          file_type: string
          id: string
          matter_id: string | null
          ocr_used: boolean | null
          page_count: number | null
          parsed_at: string | null
          status: string | null
          storage_path: string
          structure: Json | null
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          extracted_text?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          id?: string
          matter_id?: string | null
          ocr_used?: boolean | null
          page_count?: number | null
          parsed_at?: string | null
          status?: string | null
          storage_path: string
          structure?: Json | null
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>
        Relationships: []
      }
      draft_citations: {
        Row: {
          case_law_id: string | null
          cited_text: string | null
          draft_id: string | null
          flag_reason: string | null
          id: string
          provision_id: string | null
          verification_status: string | null
        }
        Insert: {
          case_law_id?: string | null
          cited_text?: string | null
          draft_id?: string | null
          flag_reason?: string | null
          id?: string
          provision_id?: string | null
          verification_status?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["draft_citations"]["Insert"]>
        Relationships: []
      }
      drafts: {
        Row: {
          content: string | null
          coverage_score: number | null
          created_at: string | null
          document_type_id: string | null
          generated_by: string | null
          id: string
          matter_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          content?: string | null
          coverage_score?: number | null
          created_at?: string | null
          document_type_id?: string | null
          generated_by?: string | null
          id?: string
          matter_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: Partial<Database["public"]["Tables"]["drafts"]["Insert"]>
        Relationships: []
      }
      legal_relationships: {
        Row: {
          from_id: string
          id: string
          note: string | null
          relation: string | null
          to_id: string
        }
        Insert: {
          from_id: string
          id: string
          note?: string | null
          relation?: string | null
          to_id: string
        }
        Update: Partial<Database["public"]["Tables"]["legal_relationships"]["Insert"]>
        Relationships: []
      }
      matter_parties: {
        Row: {
          address: string | null
          contact: Json | null
          full_name: string
          id: string
          matter_id: string | null
          person_type: string | null
          role: string | null
        }
        Insert: {
          address?: string | null
          contact?: Json | null
          full_name: string
          id?: string
          matter_id?: string | null
          person_type?: string | null
          role?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["matter_parties"]["Insert"]>
        Relationships: []
      }
      matters: {
        Row: {
          assigned_advocate_id: string | null
          assigned_paralegal_id: string | null
          case_number: string | null
          client_id: string | null
          cnr: string | null
          created_at: string | null
          domains: string[] | null
          facts: string | null
          id: string
          jurisdiction: Json | null
          relief_sought: string | null
          sensitivity_level: string | null
          special_act_tags: string[] | null
          status: string | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_advocate_id?: string | null
          assigned_paralegal_id?: string | null
          case_number?: string | null
          client_id?: string | null
          cnr?: string | null
          created_at?: string | null
          domains?: string[] | null
          facts?: string | null
          id?: string
          jurisdiction?: Json | null
          relief_sought?: string | null
          sensitivity_level?: string | null
          special_act_tags?: string[] | null
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["matters"]["Insert"]>
        Relationships: []
      }
      provisions: {
        Row: {
          act_id: string | null
          amended_by_provision_id: string | null
          chapter: string | null
          embedding: string | null
          id: string
          parent_provision_id: string | null
          provision_kind: string | null
          repealed: boolean | null
          section_number: string
          source_url: string
          supersedes_old_reference: string | null
          text_content: string | null
          title: string | null
          trust_level: string | null
          valid_from: string
          valid_to: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          act_id?: string | null
          amended_by_provision_id?: string | null
          chapter?: string | null
          embedding?: string | null
          id: string
          parent_provision_id?: string | null
          provision_kind?: string | null
          repealed?: boolean | null
          section_number: string
          source_url: string
          supersedes_old_reference?: string | null
          text_content?: string | null
          title?: string | null
          trust_level?: string | null
          valid_from: string
          valid_to?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["provisions"]["Insert"]>
        Relationships: []
      }
      qa_history: {
        Row: {
          answer: string
          asked_by: string | null
          confidence: string | null
          created_at: string | null
          id: string
          matter_id: string | null
          model_used: string | null
          question: string
          sources: Json | null
          tenant_id: string
        }
        Insert: {
          answer: string
          asked_by?: string | null
          confidence?: string | null
          created_at?: string | null
          id?: string
          matter_id?: string | null
          model_used?: string | null
          question: string
          sources?: Json | null
          tenant_id: string
        }
        Update: Partial<Database["public"]["Tables"]["qa_history"]["Insert"]>
        Relationships: []
      }
      review_actions: {
        Row: {
          action: string | null
          created_at: string | null
          draft_id: string | null
          id: string
          notes: string | null
          reviewer_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          draft_id?: string | null
          id?: string
          notes?: string | null
          reviewer_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["review_actions"]["Insert"]>
        Relationships: []
      }
      state_onboarding: {
        Row: {
          acts_seeded: number | null
          notes: string | null
          pack_status: string | null
          state: string
        }
        Insert: {
          acts_seeded?: number | null
          notes?: string | null
          pack_status?: string | null
          state: string
        }
        Update: Partial<Database["public"]["Tables"]["state_onboarding"]["Insert"]>
        Relationships: []
      }
      tenants: {
        Row: {
          branding: Json | null
          created_at: string | null
          id: string
          name: string
          slug: string
          state_anchor: string | null
        }
        Insert: {
          branding?: Json | null
          created_at?: string | null
          id?: string
          name: string
          slug: string
          state_anchor?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          language_pref: string | null
          role: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          language_pref?: string | null
          role?: string | null
          tenant_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_document_chunks: {
        Args: {
          match_count?: number
          match_matter_id: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          id: string
          metadata: Json
          page_number: number
          section_heading: string
          similarity: number
        }[]
      }
      match_provisions: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          act_id: string
          id: string
          section_number: string
          similarity: number
          text_content: string
          title: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
