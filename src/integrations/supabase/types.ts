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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ads_data_imports: {
        Row: {
          created_at: string | null
          currency: string | null
          date_range: string | null
          filename: string | null
          id: string
          platform: string
          result: Json | null
          total_ads: number | null
          total_spend: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          date_range?: string | null
          filename?: string | null
          id?: string
          platform?: string
          result?: Json | null
          total_ads?: number | null
          total_spend?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          date_range?: string | null
          filename?: string | null
          id?: string
          platform?: string
          result?: Json | null
          total_ads?: number | null
          total_spend?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_daily_usage: {
        Row: {
          id: string
          request_count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          id?: string
          request_count?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          id?: string
          request_count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      analyses: {
        Row: {
          created_at: string
          file_size_mb: number | null
          hook_strength: string | null
          id: string
          improvement_suggestions: string[] | null
          processing_time_seconds: number | null
          recommended_platforms: string[] | null
          result: Json | null
          status: string
          title: string | null
          user_id: string
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          file_size_mb?: number | null
          hook_strength?: string | null
          id?: string
          improvement_suggestions?: string[] | null
          processing_time_seconds?: number | null
          recommended_platforms?: string[] | null
          result?: Json | null
          status?: string
          title?: string | null
          user_id: string
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          file_size_mb?: number | null
          hook_strength?: string | null
          id?: string
          improvement_suggestions?: string[] | null
          processing_time_seconds?: number | null
          recommended_platforms?: string[] | null
          result?: Json | null
          status?: string
          title?: string | null
          user_id?: string
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: []
      }
      boards: {
        Row: {
          content: Json | null
          created_at: string
          duration_seconds: number | null
          has_talent: boolean | null
          id: string
          market_flag: string | null
          platform: string | null
          prompt: string | null
          scene_count: number | null
          status: string
          talent_name: string | null
          title: string | null
          user_id: string
          vo_language: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          duration_seconds?: number | null
          has_talent?: boolean | null
          id?: string
          market_flag?: string | null
          platform?: string | null
          prompt?: string | null
          scene_count?: number | null
          status?: string
          talent_name?: string | null
          title?: string | null
          user_id: string
          vo_language?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          duration_seconds?: number | null
          has_talent?: boolean | null
          id?: string
          market_flag?: string | null
          platform?: string | null
          prompt?: string | null
          scene_count?: number | null
          status?: string
          talent_name?: string | null
          title?: string | null
          user_id?: string
          vo_language?: string | null
        }
        Relationships: []
      }
      competitor_trackers: {
        Row: {
          created_at: string
          id: string
          market: string
          name: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market?: string
          name: string
          platform?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market?: string
          name?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      creative_memory: {
        Row: {
          analysis_id: string | null
          cpc: number | null
          created_at: string | null
          creative_model: string | null
          ctr: number | null
          hook_score: number | null
          hook_type: string | null
          id: string
          market: string | null
          notes: string | null
          platform: string | null
          roas: number | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          cpc?: number | null
          created_at?: string | null
          creative_model?: string | null
          ctr?: number | null
          hook_score?: number | null
          hook_type?: string | null
          id?: string
          market?: string | null
          notes?: string | null
          platform?: string | null
          roas?: number | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          cpc?: number | null
          created_at?: string | null
          creative_model?: string | null
          ctr?: number | null
          hook_score?: number | null
          hook_type?: string | null
          id?: string
          market?: string | null
          notes?: string | null
          platform?: string | null
          roas?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_memory_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          company: string
          company_size: string | null
          created_at: string
          creative_volume: string | null
          email: string
          id: string
          main_challenge: string | null
          monthly_ad_spend: string | null
          name: string
        }
        Insert: {
          company: string
          company_size?: string | null
          created_at?: string
          creative_volume?: string | null
          email: string
          id?: string
          main_challenge?: string | null
          monthly_ad_spend?: string | null
          name: string
        }
        Update: {
          company?: string
          company_size?: string | null
          created_at?: string
          creative_volume?: string | null
          email?: string
          id?: string
          main_challenge?: string | null
          monthly_ad_spend?: string | null
          name?: string
        }
        Relationships: []
      }
      output_feedback: {
        Row: {
          comment: string | null
          context: Json | null
          created_at: string | null
          id: string
          output_id: string | null
          output_type: string
          rating: number | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          output_id?: string | null
          output_type: string
          rating?: number | null
          user_id: string
        }
        Update: {
          comment?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          output_id?: string | null
          output_type?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          answers: Json | null
          brand_kit: Json | null
          created_at: string | null
          id: string
          result: Json | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          brand_kit?: Json | null
          created_at?: string | null
          id?: string
          result?: Json | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          brand_kit?: Json | null
          created_at?: string | null
          id?: string
          result?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          last_ai_action_at: string | null
          name: string | null
          onboarding_completed: boolean | null
          onboarding_data: Json | null
          plan: string
          plan_started_at: string | null
          preferred_language: string | null
          preferred_market: string | null
          stripe_customer_id: string | null
          usage_alert_flags: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          last_ai_action_at?: string | null
          name?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          plan?: string
          plan_started_at?: string | null
          preferred_language?: string | null
          preferred_market?: string | null
          stripe_customer_id?: string | null
          usage_alert_flags?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_ai_action_at?: string | null
          name?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          plan?: string
          plan_started_at?: string | null
          preferred_language?: string | null
          preferred_market?: string | null
          stripe_customer_id?: string | null
          usage_alert_flags?: Json | null
        }
        Relationships: []
      }
      signup_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      template_usage: {
        Row: {
          created_at: string
          id: string
          template_id: string
          template_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_id: string
          template_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template_id?: string
          template_name?: string
          user_id?: string
        }
        Relationships: []
      }
      translations: {
        Row: {
          character_count: number | null
          context: string | null
          created_at: string
          from_language: string | null
          id: string
          source_text: string
          to_language: string
          tone: string | null
          translated_text: string | null
          user_id: string
        }
        Insert: {
          character_count?: number | null
          context?: string | null
          created_at?: string
          from_language?: string | null
          id?: string
          source_text: string
          to_language: string
          tone?: string | null
          translated_text?: string | null
          user_id: string
        }
        Update: {
          character_count?: number | null
          context?: string | null
          created_at?: string
          from_language?: string | null
          id?: string
          source_text?: string
          to_language?: string
          tone?: string | null
          translated_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage: {
        Row: {
          analyses_count: number
          boards_count: number
          created_at: string
          hooks_count: number | null
          id: string
          period: string
          preflights_count: number
          translations_count: number | null
          user_id: string
          videos_count: number
        }
        Insert: {
          analyses_count?: number
          boards_count?: number
          created_at?: string
          hooks_count?: number | null
          id?: string
          period: string
          preflights_count?: number
          translations_count?: number | null
          user_id: string
          videos_count?: number
        }
        Update: {
          analyses_count?: number
          boards_count?: number
          created_at?: string
          hooks_count?: number | null
          id?: string
          period?: string
          preflights_count?: number
          translations_count?: number | null
          user_id?: string
          videos_count?: number
        }
        Relationships: []
      }
      user_ai_profile: {
        Row: {
          ad_platforms: Json | null
          ai_recommendations: Json | null
          ai_summary: string | null
          avg_hook_score: number | null
          best_markets: Json | null
          best_platforms: Json | null
          created_at: string | null
          id: string
          industry: string | null
          last_updated: string | null
          target_markets: Json | null
          top_performing_hooks: Json | null
          top_performing_models: Json | null
          total_analyses: number | null
          user_id: string
        }
        Insert: {
          ad_platforms?: Json | null
          ai_recommendations?: Json | null
          ai_summary?: string | null
          avg_hook_score?: number | null
          best_markets?: Json | null
          best_platforms?: Json | null
          created_at?: string | null
          id?: string
          industry?: string | null
          last_updated?: string | null
          target_markets?: Json | null
          top_performing_hooks?: Json | null
          top_performing_models?: Json | null
          total_analyses?: number | null
          user_id: string
        }
        Update: {
          ad_platforms?: Json | null
          ai_recommendations?: Json | null
          ai_summary?: string | null
          avg_hook_score?: number | null
          best_markets?: Json | null
          best_platforms?: Json | null
          created_at?: string | null
          id?: string
          industry?: string | null
          last_updated?: string | null
          target_markets?: Json | null
          top_performing_hooks?: Json | null
          top_performing_models?: Json | null
          total_analyses?: number | null
          user_id?: string
        }
        Relationships: []
      }
      videos_generated: {
        Row: {
          aspect_ratio: string | null
          board_id: string | null
          created_at: string
          duration_seconds: number | null
          file_size_mb: number | null
          has_captions: boolean | null
          id: string
          output_url: string | null
          scene_count: number | null
          status: string
          title: string | null
          user_id: string
          video_url: string | null
          voice_id: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          board_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_mb?: number | null
          has_captions?: boolean | null
          id?: string
          output_url?: string | null
          scene_count?: number | null
          status?: string
          title?: string | null
          user_id: string
          video_url?: string | null
          voice_id?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          board_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          file_size_mb?: number | null
          has_captions?: boolean | null
          id?: string
          output_url?: string | null
          scene_count?: number | null
          status?: string
          title?: string | null
          user_id?: string
          video_url?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_generated_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_ai_usage: {
        Args: { p_plan?: string; p_user_id: string }
        Returns: Json
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
