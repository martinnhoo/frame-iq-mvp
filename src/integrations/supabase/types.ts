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
      account_alerts: {
        Row: {
          action_suggestion: string | null
          ad_name: string | null
          campaign_name: string | null
          created_at: string | null
          detail: string
          dismissed_at: string | null
          emailed_at: string | null
          id: string
          kpi_label: string | null
          kpi_value: string | null
          telegram_sent_at: string | null
          type: string
          urgency: string
          user_id: string
        }
        Insert: {
          action_suggestion?: string | null
          ad_name?: string | null
          campaign_name?: string | null
          created_at?: string | null
          detail: string
          dismissed_at?: string | null
          emailed_at?: string | null
          id?: string
          kpi_label?: string | null
          kpi_value?: string | null
          telegram_sent_at?: string | null
          type?: string
          urgency?: string
          user_id: string
        }
        Update: {
          action_suggestion?: string | null
          ad_name?: string | null
          campaign_name?: string | null
          created_at?: string | null
          detail?: string
          dismissed_at?: string | null
          emailed_at?: string | null
          id?: string
          kpi_label?: string | null
          kpi_value?: string | null
          telegram_sent_at?: string | null
          type?: string
          urgency?: string
          user_id?: string
        }
        Relationships: []
      }
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
      ai_action_log: {
        Row: {
          action: string | null
          error_msg: string | null
          executed_at: string | null
          id: string
          success: boolean | null
          target_id: string | null
          target_name: string | null
          target_type: string | null
          title: string | null
          user_id: string | null
          value: string | null
        }
        Insert: {
          action?: string | null
          error_msg?: string | null
          executed_at?: string | null
          id?: string
          success?: boolean | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          title?: string | null
          user_id?: string | null
          value?: string | null
        }
        Update: {
          action?: string | null
          error_msg?: string | null
          executed_at?: string | null
          id?: string
          success?: boolean | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
          title?: string | null
          user_id?: string | null
          value?: string | null
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
          persona_id: string | null
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
          persona_id?: string | null
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
          persona_id?: string | null
          processing_time_seconds?: number | null
          recommended_platforms?: string[] | null
          result?: Json | null
          status?: string
          title?: string | null
          user_id?: string
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
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
      chat_examples: {
        Row: {
          assistant_blocks: Json
          created_at: string | null
          id: string
          persona_id: string | null
          quality_score: number | null
          times_shown: number | null
          user_id: string
          user_message: string
        }
        Insert: {
          assistant_blocks: Json
          created_at?: string | null
          id?: string
          persona_id?: string | null
          quality_score?: number | null
          times_shown?: number | null
          user_id: string
          user_message: string
        }
        Update: {
          assistant_blocks?: Json
          created_at?: string | null
          id?: string
          persona_id?: string | null
          quality_score?: number | null
          times_shown?: number | null
          user_id?: string
          user_message?: string
        }
        Relationships: []
      }
      chat_memory: {
        Row: {
          confirmed: boolean | null
          created_at: string | null
          id: string
          importance: number | null
          memory_text: string
          memory_type: string | null
          persona_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          importance?: number | null
          memory_text: string
          memory_type?: string | null
          persona_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          confirmed?: boolean | null
          created_at?: string | null
          id?: string
          importance?: number | null
          memory_text?: string
          memory_type?: string | null
          persona_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          persona_id: string | null
          role: string
          ts: number
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: string
          persona_id?: string | null
          role: string
          ts: number
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          persona_id?: string | null
          role?: string
          ts?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          facebook: string | null
          id: string
          industry: string
          instagram: string | null
          name: string
          tiktok: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          facebook?: string | null
          id?: string
          industry: string
          instagram?: string | null
          name: string
          tiktok?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          facebook?: string | null
          id?: string
          industry?: string
          instagram?: string | null
          name?: string
          tiktok?: string | null
          user_id?: string
          website?: string | null
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
      cost_alerts: {
        Row: {
          alert_date: string | null
          cost_pct: number | null
          estimated_cost: number | null
          last_updated: string | null
          monthly_msgs: number | null
          plan: string | null
          plan_revenue: number | null
          user_id: string
        }
        Insert: {
          alert_date?: string | null
          cost_pct?: number | null
          estimated_cost?: number | null
          last_updated?: string | null
          monthly_msgs?: number | null
          plan?: string | null
          plan_revenue?: number | null
          user_id: string
        }
        Update: {
          alert_date?: string | null
          cost_pct?: number | null
          estimated_cost?: number | null
          last_updated?: string | null
          monthly_msgs?: number | null
          plan?: string | null
          plan_revenue?: number | null
          user_id?: string
        }
        Relationships: []
      }
      creative_entries: {
        Row: {
          aspect_ratio: string | null
          audience_temp: string | null
          clicks: number | null
          client: string | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          creative_type: string | null
          ctr: number | null
          date_code: string | null
          editor: string | null
          filename: string
          hold_rate: number | null
          hook_angle: string | null
          hook_type: string | null
          id: string
          import_batch_id: string | null
          impressions: number | null
          market: string | null
          persona_id: string | null
          platform: string | null
          roas: number | null
          source: string | null
          spend: number | null
          talent: string | null
          thumb_stop_rate: number | null
          updated_at: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          audience_temp?: string | null
          clicks?: number | null
          client?: string | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_type?: string | null
          ctr?: number | null
          date_code?: string | null
          editor?: string | null
          filename: string
          hold_rate?: number | null
          hook_angle?: string | null
          hook_type?: string | null
          id?: string
          import_batch_id?: string | null
          impressions?: number | null
          market?: string | null
          persona_id?: string | null
          platform?: string | null
          roas?: number | null
          source?: string | null
          spend?: number | null
          talent?: string | null
          thumb_stop_rate?: number | null
          updated_at?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          audience_temp?: string | null
          clicks?: number | null
          client?: string | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_type?: string | null
          ctr?: number | null
          date_code?: string | null
          editor?: string | null
          filename?: string
          hold_rate?: number | null
          hook_angle?: string | null
          hook_type?: string | null
          id?: string
          import_batch_id?: string | null
          impressions?: number | null
          market?: string | null
          persona_id?: string | null
          platform?: string | null
          roas?: number | null
          source?: string | null
          spend?: number | null
          talent?: string | null
          thumb_stop_rate?: number | null
          updated_at?: string | null
          user_id?: string
          version?: string | null
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
      daily_snapshots: {
        Row: {
          account_id: string | null
          account_name: string | null
          active_ads: number | null
          ai_insight: string | null
          avg_ctr: number | null
          avg_roas: number | null
          created_at: string | null
          date: string
          id: string
          losers_count: number | null
          persona_id: string | null
          raw_period: Json | null
          top_ads: Json | null
          total_clicks: number | null
          total_spend: number | null
          user_id: string
          winners_count: number | null
          yesterday_ctr: number | null
          yesterday_spend: number | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          active_ads?: number | null
          ai_insight?: string | null
          avg_ctr?: number | null
          avg_roas?: number | null
          created_at?: string | null
          date: string
          id?: string
          losers_count?: number | null
          persona_id?: string | null
          raw_period?: Json | null
          top_ads?: Json | null
          total_clicks?: number | null
          total_spend?: number | null
          user_id: string
          winners_count?: number | null
          yesterday_ctr?: number | null
          yesterday_spend?: number | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          active_ads?: number | null
          ai_insight?: string | null
          avg_ctr?: number | null
          avg_roas?: number | null
          created_at?: string | null
          date?: string
          id?: string
          losers_count?: number | null
          persona_id?: string | null
          raw_period?: Json | null
          top_ads?: Json | null
          total_clicks?: number | null
          total_spend?: number | null
          user_id?: string
          winners_count?: number | null
          yesterday_ctr?: number | null
          yesterday_spend?: number | null
        }
        Relationships: []
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
      free_usage: {
        Row: {
          chat_count: number
          last_reset: string
          monthly_msg_count: number | null
          monthly_reset: string | null
          user_id: string
        }
        Insert: {
          chat_count?: number
          last_reset?: string
          monthly_msg_count?: number | null
          monthly_reset?: string | null
          user_id: string
        }
        Update: {
          chat_count?: number
          last_reset?: string
          monthly_msg_count?: number | null
          monthly_reset?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_patterns: {
        Row: {
          avg_cpc: number | null
          avg_ctr: number | null
          avg_roas: number | null
          avg_thumb_stop: number | null
          confidence: number | null
          created_at: string | null
          id: string
          insight_text: string | null
          is_winner: boolean | null
          last_updated: string | null
          pattern_key: string
          persona_id: string | null
          sample_size: number | null
          user_id: string | null
          variables: Json
        }
        Insert: {
          avg_cpc?: number | null
          avg_ctr?: number | null
          avg_roas?: number | null
          avg_thumb_stop?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          insight_text?: string | null
          is_winner?: boolean | null
          last_updated?: string | null
          pattern_key: string
          persona_id?: string | null
          sample_size?: number | null
          user_id?: string | null
          variables?: Json
        }
        Update: {
          avg_cpc?: number | null
          avg_ctr?: number | null
          avg_roas?: number | null
          avg_thumb_stop?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          insight_text?: string | null
          is_winner?: boolean | null
          last_updated?: string | null
          pattern_key?: string
          persona_id?: string | null
          sample_size?: number | null
          user_id?: string | null
          variables?: Json
        }
        Relationships: []
      }
      nomenclature_config: {
        Row: {
          created_at: string | null
          example_filename: string | null
          fields: Json
          id: string
          separator: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          example_filename?: string | null
          fields?: Json
          id?: string
          separator?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          example_filename?: string | null
          fields?: Json
          id?: string
          separator?: string | null
          updated_at?: string | null
          user_id?: string
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
          description: string | null
          id: string
          logo_url: string | null
          name: string | null
          result: Json | null
          user_id: string
          website: string | null
        }
        Insert: {
          answers?: Json | null
          brand_kit?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          result?: Json | null
          user_id: string
          website?: string | null
        }
        Update: {
          answers?: Json | null
          brand_kit?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          result?: Json | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          access_token: string
          ad_accounts: Json | null
          connected_at: string | null
          connection_label: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          persona_id: string | null
          platform: string
          refresh_token: string | null
          selected_account_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          ad_accounts?: Json | null
          connected_at?: string | null
          connection_label?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          persona_id?: string | null
          platform: string
          refresh_token?: string | null
          selected_account_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          ad_accounts?: Json | null
          connected_at?: string | null
          connection_label?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          persona_id?: string | null
          platform?: string
          refresh_token?: string | null
          selected_account_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      predictive_scores: {
        Row: {
          confidence: number | null
          created_at: string | null
          creative_hash: string
          id: string
          patterns_used: Json | null
          predicted_ctr: number | null
          predicted_roas: number | null
          reasoning: string | null
          score: number | null
          user_id: string
          variables: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          creative_hash: string
          id?: string
          patterns_used?: Json | null
          predicted_ctr?: number | null
          predicted_roas?: number | null
          reasoning?: string | null
          score?: number | null
          user_id: string
          variables?: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          creative_hash?: string
          id?: string
          patterns_used?: Json | null
          predicted_ctr?: number | null
          predicted_roas?: number | null
          reasoning?: string | null
          score?: number | null
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
      preflight_results: {
        Row: {
          created_at: string | null
          format: string | null
          id: string
          market: string | null
          platform: string | null
          result_json: Json | null
          score: number | null
          user_id: string
          verdict: string | null
        }
        Insert: {
          created_at?: string | null
          format?: string | null
          id?: string
          market?: string | null
          platform?: string | null
          result_json?: Json | null
          score?: number | null
          user_id: string
          verdict?: string | null
        }
        Update: {
          created_at?: string | null
          format?: string | null
          id?: string
          market?: string | null
          platform?: string | null
          result_json?: Json | null
          score?: number | null
          user_id?: string
          verdict?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dashboard_count: number | null
          dashboard_reset_date: string | null
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
          dashboard_count?: number | null
          dashboard_reset_date?: string | null
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
          dashboard_count?: number | null
          dashboard_reset_date?: string | null
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
      telegram_connections: {
        Row: {
          active: boolean | null
          chat_id: string
          connected_at: string | null
          id: string
          telegram_first_name: string | null
          telegram_username: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          chat_id: string
          connected_at?: string | null
          id?: string
          telegram_first_name?: string | null
          telegram_username?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          chat_id?: string
          connected_at?: string | null
          id?: string
          telegram_first_name?: string | null
          telegram_username?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_pairing_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
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
      trend_daily_volumes: {
        Row: {
          date: string
          id: string
          position: number | null
          term_key: string
          volume: number
        }
        Insert: {
          date?: string
          id?: string
          position?: number | null
          term_key: string
          volume: number
        }
        Update: {
          date?: string
          id?: string
          position?: number | null
          term_key?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "trend_daily_volumes_term_key_fkey"
            columns: ["term_key"]
            isOneToOne: false
            referencedRelation: "trend_intelligence"
            referencedColumns: ["term_key"]
          },
        ]
      }
      trend_intelligence: {
        Row: {
          ad_angle: string | null
          angle: string | null
          appearances: number
          avg_volume: number
          category: string | null
          created_at: string
          days_active: number
          first_seen_at: string
          id: string
          is_active: boolean
          is_blocked: boolean
          last_seen_at: string
          last_volume: number
          niches: string[] | null
          peak_volume: number
          risk_score: number
          term: string
          term_key: string
          updated_at: string
        }
        Insert: {
          ad_angle?: string | null
          angle?: string | null
          appearances?: number
          avg_volume?: number
          category?: string | null
          created_at?: string
          days_active?: number
          first_seen_at?: string
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          last_seen_at?: string
          last_volume?: number
          niches?: string[] | null
          peak_volume?: number
          risk_score?: number
          term: string
          term_key: string
          updated_at?: string
        }
        Update: {
          ad_angle?: string | null
          angle?: string | null
          appearances?: number
          avg_volume?: number
          category?: string | null
          created_at?: string
          days_active?: number
          first_seen_at?: string
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          last_seen_at?: string
          last_volume?: number
          niches?: string[] | null
          peak_volume?: number
          risk_score?: number
          term?: string
          term_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      trend_platform_baseline: {
        Row: {
          avg_volume: number | null
          geo: string
          id: string
          p75_volume: number | null
          p90_volume: number | null
          week_start: string
        }
        Insert: {
          avg_volume?: number | null
          geo?: string
          id?: string
          p75_volume?: number | null
          p90_volume?: number | null
          week_start: string
        }
        Update: {
          avg_volume?: number | null
          geo?: string
          id?: string
          p75_volume?: number | null
          p90_volume?: number | null
          week_start?: string
        }
        Relationships: []
      }
      upgrade_events: {
        Row: {
          created_at: string
          id: string
          trigger: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          trigger: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          trigger?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upgrade_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          pain_point: string | null
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
          pain_point?: string | null
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
          pain_point?: string | null
          target_markets?: Json | null
          top_performing_hooks?: Json | null
          top_performing_models?: Json | null
          total_analyses?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          disliked_patterns: string | null
          liked_patterns: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          disliked_patterns?: string | null
          liked_patterns?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          disliked_patterns?: string | null
          liked_patterns?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      platform_connections_safe: {
        Row: {
          ad_accounts: Json | null
          connected_at: string | null
          connection_label: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          persona_id: string | null
          platform: string | null
          selected_account_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_accounts?: Json | null
          connected_at?: string | null
          connection_label?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          persona_id?: string | null
          platform?: string | null
          selected_account_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_accounts?: Json | null
          connected_at?: string | null
          connection_label?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          persona_id?: string | null
          platform?: string | null
          selected_account_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adbrief_invoke_function: {
        Args: { fn_name: string; payload?: string }
        Returns: undefined
      }
      check_and_increment_ai_usage: {
        Args: { p_plan?: string; p_user_id: string }
        Returns: Json
      }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      increment_chat_usage: {
        Args: {
          p_daily_cap: number
          p_month_key: string
          p_today: string
          p_user_id: string
        }
        Returns: Json
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
