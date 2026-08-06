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
      account_baselines: {
        Row: {
          account_id: string
          calculated_at: string | null
          conversion_rate_avg: number | null
          cpa_median: number | null
          cpa_p25: number | null
          cpa_p75: number | null
          ctr_median: number | null
          ctr_p25: number | null
          ctr_p75: number | null
          ctr_p95: number | null
          frequency_healthy_max: number | null
          id: string
          maturity: string | null
          period_days: number
          roas_median: number | null
          roas_p25: number | null
          roas_p75: number | null
          sample_size: number | null
          spend_daily_avg: number | null
        }
        Insert: {
          account_id: string
          calculated_at?: string | null
          conversion_rate_avg?: number | null
          cpa_median?: number | null
          cpa_p25?: number | null
          cpa_p75?: number | null
          ctr_median?: number | null
          ctr_p25?: number | null
          ctr_p75?: number | null
          ctr_p95?: number | null
          frequency_healthy_max?: number | null
          id?: string
          maturity?: string | null
          period_days: number
          roas_median?: number | null
          roas_p25?: number | null
          roas_p75?: number | null
          sample_size?: number | null
          spend_daily_avg?: number | null
        }
        Update: {
          account_id?: string
          calculated_at?: string | null
          conversion_rate_avg?: number | null
          cpa_median?: number | null
          cpa_p25?: number | null
          cpa_p75?: number | null
          ctr_median?: number | null
          ctr_p25?: number | null
          ctr_p75?: number | null
          ctr_p95?: number | null
          frequency_healthy_max?: number | null
          id?: string
          maturity?: string | null
          period_days?: number
          roas_median?: number | null
          roas_p25?: number | null
          roas_p75?: number | null
          sample_size?: number | null
          spend_daily_avg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "account_baselines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_diagnostics: {
        Row: {
          ad_account_id: string
          ads_fatigued: Json | null
          ads_to_pause: Json | null
          ads_to_scale: Json | null
          benchmarks: Json | null
          created_at: string | null
          current_roas: number | null
          id: string
          insights: Json | null
          metrics: Json | null
          persona_id: string | null
          projected_roas: number | null
          roas_improvement_pct: number | null
          score: number | null
          score_breakdown: Json | null
          top_performers: Json | null
          user_id: string
          wasted_spend: number | null
          wasted_spend_monthly: number | null
        }
        Insert: {
          ad_account_id: string
          ads_fatigued?: Json | null
          ads_to_pause?: Json | null
          ads_to_scale?: Json | null
          benchmarks?: Json | null
          created_at?: string | null
          current_roas?: number | null
          id?: string
          insights?: Json | null
          metrics?: Json | null
          persona_id?: string | null
          projected_roas?: number | null
          roas_improvement_pct?: number | null
          score?: number | null
          score_breakdown?: Json | null
          top_performers?: Json | null
          user_id: string
          wasted_spend?: number | null
          wasted_spend_monthly?: number | null
        }
        Update: {
          ad_account_id?: string
          ads_fatigued?: Json | null
          ads_to_pause?: Json | null
          ads_to_scale?: Json | null
          benchmarks?: Json | null
          created_at?: string | null
          current_roas?: number | null
          id?: string
          insights?: Json | null
          metrics?: Json | null
          persona_id?: string | null
          projected_roas?: number | null
          roas_improvement_pct?: number | null
          score?: number | null
          score_breakdown?: Json | null
          top_performers?: Json | null
          user_id?: string
          wasted_spend?: number | null
          wasted_spend_monthly?: number | null
        }
        Relationships: []
      }
      account_patterns: {
        Row: {
          account_id: string
          description: string
          discovered_at: string | null
          evidence_ad_ids: string[] | null
          evidence_spend: number | null
          id: string
          impact_percentage: number | null
          last_validated_at: string | null
          pattern_type: string
          sample_size: number | null
          status: string | null
          strength: number | null
          title: string
        }
        Insert: {
          account_id: string
          description: string
          discovered_at?: string | null
          evidence_ad_ids?: string[] | null
          evidence_spend?: number | null
          id?: string
          impact_percentage?: number | null
          last_validated_at?: string | null
          pattern_type: string
          sample_size?: number | null
          status?: string | null
          strength?: number | null
          title: string
        }
        Update: {
          account_id?: string
          description?: string
          discovered_at?: string | null
          evidence_ad_ids?: string[] | null
          evidence_spend?: number | null
          id?: string
          impact_percentage?: number | null
          last_validated_at?: string | null
          pattern_type?: string
          sample_size?: number | null
          status?: string | null
          strength?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_patterns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_status_cache: {
        Row: {
          checked_at: string
          created_at: string | null
          data: Json
          id: string
          meta_account_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          checked_at?: string
          created_at?: string | null
          data?: Json
          id?: string
          meta_account_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          checked_at?: string
          created_at?: string | null
          data?: Json
          id?: string
          meta_account_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      action_log: {
        Row: {
          account_id: string
          action_type: string
          actual_impact_48h: number | null
          confidence: number | null
          created_at: string | null
          decision_id: string | null
          decision_tag: string | null
          error_message: string | null
          estimated_daily_impact: number | null
          executed: boolean | null
          executed_at: string | null
          execution_result: Json | null
          explanation: Json | null
          financial_verdict: string | null
          id: string
          is_shadow: boolean | null
          meta_api_response: Json | null
          new_state: Json
          new_value: Json | null
          persona_id: string | null
          previous_state: Json
          previous_value: Json | null
          result: string | null
          risk_level: string | null
          rollback_action_id: string | null
          rollback_available: boolean | null
          rollback_expires_at: string | null
          rollback_reason: string | null
          rolled_back: boolean | null
          rolled_back_at: string | null
          source: string | null
          target_id: string | null
          target_meta_id: string
          target_name: string | null
          target_type: string
          triggered_by: string | null
          user_id: string
          validated_at: string | null
        }
        Insert: {
          account_id: string
          action_type: string
          actual_impact_48h?: number | null
          confidence?: number | null
          created_at?: string | null
          decision_id?: string | null
          decision_tag?: string | null
          error_message?: string | null
          estimated_daily_impact?: number | null
          executed?: boolean | null
          executed_at?: string | null
          execution_result?: Json | null
          explanation?: Json | null
          financial_verdict?: string | null
          id?: string
          is_shadow?: boolean | null
          meta_api_response?: Json | null
          new_state?: Json
          new_value?: Json | null
          persona_id?: string | null
          previous_state?: Json
          previous_value?: Json | null
          result?: string | null
          risk_level?: string | null
          rollback_action_id?: string | null
          rollback_available?: boolean | null
          rollback_expires_at?: string | null
          rollback_reason?: string | null
          rolled_back?: boolean | null
          rolled_back_at?: string | null
          source?: string | null
          target_id?: string | null
          target_meta_id: string
          target_name?: string | null
          target_type: string
          triggered_by?: string | null
          user_id: string
          validated_at?: string | null
        }
        Update: {
          account_id?: string
          action_type?: string
          actual_impact_48h?: number | null
          confidence?: number | null
          created_at?: string | null
          decision_id?: string | null
          decision_tag?: string | null
          error_message?: string | null
          estimated_daily_impact?: number | null
          executed?: boolean | null
          executed_at?: string | null
          execution_result?: Json | null
          explanation?: Json | null
          financial_verdict?: string | null
          id?: string
          is_shadow?: boolean | null
          meta_api_response?: Json | null
          new_state?: Json
          new_value?: Json | null
          persona_id?: string | null
          previous_state?: Json
          previous_value?: Json | null
          result?: string | null
          risk_level?: string | null
          rollback_action_id?: string | null
          rollback_available?: boolean | null
          rollback_expires_at?: string | null
          rollback_reason?: string | null
          rolled_back?: boolean | null
          rolled_back_at?: string | null
          source?: string | null
          target_id?: string | null
          target_meta_id?: string
          target_name?: string | null
          target_type?: string
          triggered_by?: string | null
          user_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_log_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      action_outcomes: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type_enum"]
          ai_reasoning: string | null
          alert_id: string | null
          context: Json | null
          created_at: string | null
          delta_24h: Json | null
          delta_72h: Json | null
          evaluation_metric: string | null
          finalized: boolean | null
          hypothesis: Json | null
          id: string
          impact_snapshot: number | null
          improved: boolean | null
          measured_24h_at: string | null
          measured_72h_at: string | null
          metrics_after_24h: Json | null
          metrics_after_72h: Json | null
          metrics_before: Json
          metrics_window: string
          pattern_candidate: boolean | null
          persona_id: string | null
          recovery_pct: number | null
          source: string | null
          taken_at: string
          target_id: string
          target_level: Database["public"]["Enums"]["target_level_enum"]
          target_name: string | null
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["action_type_enum"]
          ai_reasoning?: string | null
          alert_id?: string | null
          context?: Json | null
          created_at?: string | null
          delta_24h?: Json | null
          delta_72h?: Json | null
          evaluation_metric?: string | null
          finalized?: boolean | null
          hypothesis?: Json | null
          id?: string
          impact_snapshot?: number | null
          improved?: boolean | null
          measured_24h_at?: string | null
          measured_72h_at?: string | null
          metrics_after_24h?: Json | null
          metrics_after_72h?: Json | null
          metrics_before: Json
          metrics_window?: string
          pattern_candidate?: boolean | null
          persona_id?: string | null
          recovery_pct?: number | null
          source?: string | null
          taken_at?: string
          target_id: string
          target_level: Database["public"]["Enums"]["target_level_enum"]
          target_name?: string | null
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["action_type_enum"]
          ai_reasoning?: string | null
          alert_id?: string | null
          context?: Json | null
          created_at?: string | null
          delta_24h?: Json | null
          delta_72h?: Json | null
          evaluation_metric?: string | null
          finalized?: boolean | null
          hypothesis?: Json | null
          id?: string
          impact_snapshot?: number | null
          improved?: boolean | null
          measured_24h_at?: string | null
          measured_72h_at?: string | null
          metrics_after_24h?: Json | null
          metrics_after_72h?: Json | null
          metrics_before?: Json
          metrics_window?: string
          pattern_candidate?: boolean | null
          persona_id?: string | null
          recovery_pct?: number | null
          source?: string | null
          taken_at?: string
          target_id?: string
          target_level?: Database["public"]["Enums"]["target_level_enum"]
          target_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_outcomes_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          ab_test_group: string | null
          access_token_encrypted: string | null
          auto_rollback_enabled: boolean | null
          break_even_roas: number | null
          created_at: string | null
          currency: string | null
          decision_engine_version: string | null
          goal_configured_at: string | null
          goal_conversion_event: string | null
          goal_objective: string | null
          goal_primary_metric: string | null
          goal_target_value: number | null
          gradual_scaling_enabled: boolean | null
          id: string
          last_deep_sync_at: string | null
          last_fast_sync_at: string | null
          last_full_sync_at: string | null
          ltv_estimate: number | null
          max_actions_per_day: number | null
          max_budget_increase_pct: number | null
          meta_account_id: string
          monthly_budget_target: number | null
          name: string
          profit_margin_pct: number | null
          rollback_roas_drop_pct: number | null
          rollback_window_hours: number | null
          status: string | null
          timezone: string | null
          token_expires_at: string | null
          total_ads_synced: number | null
          total_spend_30d: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ab_test_group?: string | null
          access_token_encrypted?: string | null
          auto_rollback_enabled?: boolean | null
          break_even_roas?: number | null
          created_at?: string | null
          currency?: string | null
          decision_engine_version?: string | null
          goal_configured_at?: string | null
          goal_conversion_event?: string | null
          goal_objective?: string | null
          goal_primary_metric?: string | null
          goal_target_value?: number | null
          gradual_scaling_enabled?: boolean | null
          id?: string
          last_deep_sync_at?: string | null
          last_fast_sync_at?: string | null
          last_full_sync_at?: string | null
          ltv_estimate?: number | null
          max_actions_per_day?: number | null
          max_budget_increase_pct?: number | null
          meta_account_id: string
          monthly_budget_target?: number | null
          name: string
          profit_margin_pct?: number | null
          rollback_roas_drop_pct?: number | null
          rollback_window_hours?: number | null
          status?: string | null
          timezone?: string | null
          token_expires_at?: string | null
          total_ads_synced?: number | null
          total_spend_30d?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ab_test_group?: string | null
          access_token_encrypted?: string | null
          auto_rollback_enabled?: boolean | null
          break_even_roas?: number | null
          created_at?: string | null
          currency?: string | null
          decision_engine_version?: string | null
          goal_configured_at?: string | null
          goal_conversion_event?: string | null
          goal_objective?: string | null
          goal_primary_metric?: string | null
          goal_target_value?: number | null
          gradual_scaling_enabled?: boolean | null
          id?: string
          last_deep_sync_at?: string | null
          last_fast_sync_at?: string | null
          last_full_sync_at?: string | null
          ltv_estimate?: number | null
          max_actions_per_day?: number | null
          max_budget_increase_pct?: number | null
          meta_account_id?: string
          monthly_budget_target?: number | null
          name?: string
          profit_margin_pct?: number | null
          rollback_roas_drop_pct?: number | null
          rollback_window_hours?: number | null
          status?: string | null
          timezone?: string | null
          token_expires_at?: string | null
          total_ads_synced?: number | null
          total_spend_30d?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_diary: {
        Row: {
          ad_id: string
          ad_name: string | null
          adset_name: string | null
          campaign_name: string | null
          clicks: number | null
          conv_value: number | null
          conversions: number | null
          cpc: number | null
          created_at: string | null
          ctr: number | null
          days_running: number | null
          frequency: number | null
          id: string
          impressions: number | null
          launched_at: string | null
          paused_at: string | null
          peak_ctr: number | null
          peak_date: string | null
          persona_id: string | null
          platform: string
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
          thumbnail_url: string | null
          user_id: string
          verdict: string | null
          verdict_reason: string | null
        }
        Insert: {
          ad_id: string
          ad_name?: string | null
          adset_name?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conv_value?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          days_running?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          launched_at?: string | null
          paused_at?: string | null
          peak_ctr?: number | null
          peak_date?: string | null
          persona_id?: string | null
          platform: string
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          thumbnail_url?: string | null
          user_id: string
          verdict?: string | null
          verdict_reason?: string | null
        }
        Update: {
          ad_id?: string
          ad_name?: string | null
          adset_name?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conv_value?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          days_running?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          launched_at?: string | null
          paused_at?: string | null
          peak_ctr?: number | null
          peak_date?: string | null
          persona_id?: string | null
          platform?: string
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
          thumbnail_url?: string | null
          user_id?: string
          verdict?: string | null
          verdict_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_diary_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_metrics: {
        Row: {
          account_id: string
          ad_id: string
          clicks: number | null
          conversions: number | null
          cpa: number | null
          cpc: number | null
          ctr: number | null
          date: string
          frequency: number | null
          id: string
          impressions: number | null
          reach: number | null
          revenue: number | null
          roas: number | null
          spend: number | null
          synced_at: string | null
          video_views_3s: number | null
          video_views_thruplay: number | null
        }
        Insert: {
          account_id: string
          ad_id: string
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          ctr?: number | null
          date: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          reach?: number | null
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          synced_at?: string | null
          video_views_3s?: number | null
          video_views_thruplay?: number | null
        }
        Update: {
          account_id?: string
          ad_id?: string
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          cpc?: number | null
          ctr?: number | null
          date?: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          reach?: number | null
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          synced_at?: string | null
          video_views_3s?: number | null
          video_views_thruplay?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_metrics_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_sets: {
        Row: {
          account_id: string
          bid_strategy: string | null
          campaign_id: string
          daily_budget: number | null
          id: string
          lifetime_budget: number | null
          meta_adset_id: string
          name: string
          optimization_goal: string | null
          status: string | null
          synced_at: string | null
          targeting: Json | null
        }
        Insert: {
          account_id: string
          bid_strategy?: string | null
          campaign_id: string
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_adset_id: string
          name: string
          optimization_goal?: string | null
          status?: string | null
          synced_at?: string | null
          targeting?: Json | null
        }
        Update: {
          account_id?: string
          bid_strategy?: string | null
          campaign_id?: string
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_adset_id?: string
          name?: string
          optimization_goal?: string | null
          status?: string | null
          synced_at?: string | null
          targeting?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_sets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_sets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          ip: unknown
          metadata: Json
          request_id: string | null
          target_resource: string | null
          target_resource_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json
          request_id?: string | null
          target_resource?: string | null
          target_resource_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json
          request_id?: string | null
          target_resource?: string | null
          target_resource_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          note: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          account_id: string
          ad_set_id: string
          created_time: string | null
          creative_id: string | null
          effective_status: string | null
          id: string
          meta_ad_id: string
          name: string
          status: string | null
          synced_at: string | null
        }
        Insert: {
          account_id: string
          ad_set_id: string
          created_time?: string | null
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          meta_ad_id: string
          name: string
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          account_id?: string
          ad_set_id?: string
          created_time?: string | null
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          meta_ad_id?: string
          name?: string
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_ad_set_id_fkey"
            columns: ["ad_set_id"]
            isOneToOne: false
            referencedRelation: "ad_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
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
      ai_context_cache: {
        Row: {
          cache_key: string
          checked_at: string
          created_at: string | null
          data: Json
          id: string
          meta_account_id: string
          persona_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cache_key: string
          checked_at?: string
          created_at?: string | null
          data?: Json
          id?: string
          meta_account_id: string
          persona_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cache_key?: string
          checked_at?: string
          created_at?: string | null
          data?: Json
          id?: string
          meta_account_id?: string
          persona_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_cost_config: {
        Row: {
          daily_usd_cap: number
          plan: string
          updated_at: string
        }
        Insert: {
          daily_usd_cap: number
          plan: string
          updated_at?: string
        }
        Update: {
          daily_usd_cap?: number
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_cost_daily: {
        Row: {
          call_count: number
          date: string
          spent_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          call_count?: number
          date?: string
          spent_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          call_count?: number
          date?: string
          spent_usd?: number
          updated_at?: string
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
      autopilot_action_log: {
        Row: {
          action_type: string
          amount_at_risk_brl: number | null
          confidence: number
          decision_id: string | null
          executed_at: string
          expires_undo_at: string
          id: string
          meta_api_response: Json | null
          payload: Json
          reason: string
          status: string
          target_id: string
          target_kind: string
          target_name: string | null
          undone_at: string | null
          undone_by: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          amount_at_risk_brl?: number | null
          confidence: number
          decision_id?: string | null
          executed_at?: string
          expires_undo_at?: string
          id?: string
          meta_api_response?: Json | null
          payload?: Json
          reason: string
          status?: string
          target_id: string
          target_kind: string
          target_name?: string | null
          undone_at?: string | null
          undone_by?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          amount_at_risk_brl?: number | null
          confidence?: number
          decision_id?: string | null
          executed_at?: string
          expires_undo_at?: string
          id?: string
          meta_api_response?: Json | null
          payload?: Json
          reason?: string
          status?: string
          target_id?: string
          target_kind?: string
          target_name?: string | null
          undone_at?: string | null
          undone_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_action_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_settings: {
        Row: {
          accepted_terms_at: string | null
          allowed_action_types: string[]
          created_at: string
          daily_action_cap: number
          enabled: boolean
          min_amount_at_risk_brl: number
          min_confidence: number
          notify_email: boolean
          notify_telegram: boolean
          paused_until: string | null
          undo_window_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_terms_at?: string | null
          allowed_action_types?: string[]
          created_at?: string
          daily_action_cap?: number
          enabled?: boolean
          min_amount_at_risk_brl?: number
          min_confidence?: number
          notify_email?: boolean
          notify_telegram?: boolean
          paused_until?: string | null
          undo_window_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_terms_at?: string | null
          allowed_action_types?: string[]
          created_at?: string
          daily_action_cap?: number
          enabled?: boolean
          min_amount_at_risk_brl?: number
          min_confidence?: number
          notify_email?: boolean
          notify_telegram?: boolean
          paused_until?: string | null
          undo_window_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      brand_assets: {
        Row: {
          asset_url: string
          brand_id: string
          created_at: string | null
          id: string
          kind: string | null
          position: number | null
          user_id: string
        }
        Insert: {
          asset_url: string
          brand_id: string
          created_at?: string | null
          id?: string
          kind?: string | null
          position?: number | null
          user_id: string
        }
        Update: {
          asset_url?: string
          brand_id?: string
          created_at?: string | null
          id?: string
          kind?: string | null
          position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "user_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          account_id: string
          buying_type: string | null
          daily_budget: number | null
          id: string
          lifetime_budget: number | null
          meta_campaign_id: string
          name: string
          objective: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          account_id: string
          buying_type?: string | null
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_campaign_id: string
          name: string
          objective?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          account_id?: string
          buying_type?: string | null
          daily_budget?: number | null
          id?: string
          lifetime_budget?: number | null
          meta_campaign_id?: string
          name?: string
          objective?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      checkout_attempts: {
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
      ci_ad_assets: {
        Row: {
          ad_id: string
          asset_id: string
          created_at: string
          id: string
          media_source_id: string | null
          role: string
          sort_order: number
          user_id: string
          was_deduplicated: boolean
        }
        Insert: {
          ad_id: string
          asset_id: string
          created_at?: string
          id?: string
          media_source_id?: string | null
          role?: string
          sort_order?: number
          user_id: string
          was_deduplicated?: boolean
        }
        Update: {
          ad_id?: string
          asset_id?: string
          created_at?: string
          id?: string
          media_source_id?: string | null
          role?: string
          sort_order?: number
          user_id?: string
          was_deduplicated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ci_ad_assets_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_assets_media_source_id_fkey"
            columns: ["media_source_id"]
            isOneToOne: false
            referencedRelation: "ci_ad_media_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_ad_media_sources: {
        Row: {
          ad_id: string
          asset_id: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          media_url: string
          sort_order: number
          status: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_id: string
          asset_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          media_url: string
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          asset_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          media_url?: string
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_ad_media_sources_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_media_sources_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_ad_taxonomy: {
        Row: {
          ad_id: string
          asset_id: string | null
          brand_id: string
          confidence: number
          created_at: string
          evidence: string | null
          evidence_kind: string | null
          id: string
          is_primary: boolean
          model_version: string | null
          source: string
          term_id: string
          timestamp_s: number | null
          user_id: string
        }
        Insert: {
          ad_id: string
          asset_id?: string | null
          brand_id: string
          confidence?: number
          created_at?: string
          evidence?: string | null
          evidence_kind?: string | null
          id?: string
          is_primary?: boolean
          model_version?: string | null
          source: string
          term_id: string
          timestamp_s?: number | null
          user_id: string
        }
        Update: {
          ad_id?: string
          asset_id?: string | null
          brand_id?: string
          confidence?: number
          created_at?: string
          evidence?: string | null
          evidence_kind?: string | null
          id?: string
          is_primary?: boolean
          model_version?: string | null
          source?: string
          term_id?: string
          timestamp_s?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_ad_taxonomy_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_ctas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_hooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_objections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ad_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ci_taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_ads: {
        Row: {
          ad_archive_id: string
          analysis_status: string
          body_text: string | null
          brand_id: string
          concept_id: string | null
          countries: string[] | null
          created_at: string
          cta: string | null
          description: string | null
          display_format: string | null
          ended_on: string | null
          headline: string | null
          id: string
          import_run_id: string | null
          import_source: string
          imported_at: string
          is_active: boolean | null
          is_demo: boolean
          landing_page: string | null
          languages: string[] | null
          last_seen_at: string
          media_type: string | null
          page_id: string | null
          page_name: string | null
          page_profile_uri: string | null
          platforms: string[] | null
          raw_payload: Json
          running_days: number | null
          source: string
          started_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_archive_id: string
          analysis_status?: string
          body_text?: string | null
          brand_id: string
          concept_id?: string | null
          countries?: string[] | null
          created_at?: string
          cta?: string | null
          description?: string | null
          display_format?: string | null
          ended_on?: string | null
          headline?: string | null
          id?: string
          import_run_id?: string | null
          import_source?: string
          imported_at?: string
          is_active?: boolean | null
          is_demo?: boolean
          landing_page?: string | null
          languages?: string[] | null
          last_seen_at?: string
          media_type?: string | null
          page_id?: string | null
          page_name?: string | null
          page_profile_uri?: string | null
          platforms?: string[] | null
          raw_payload: Json
          running_days?: number | null
          source?: string
          started_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_archive_id?: string
          analysis_status?: string
          body_text?: string | null
          brand_id?: string
          concept_id?: string | null
          countries?: string[] | null
          created_at?: string
          cta?: string | null
          description?: string | null
          display_format?: string | null
          ended_on?: string | null
          headline?: string | null
          id?: string
          import_run_id?: string | null
          import_source?: string
          imported_at?: string
          is_active?: boolean | null
          is_demo?: boolean
          landing_page?: string | null
          languages?: string[] | null
          last_seen_at?: string
          media_type?: string | null
          page_id?: string | null
          page_name?: string | null
          page_profile_uri?: string | null
          platforms?: string[] | null
          raw_payload?: Json
          running_days?: number | null
          source?: string
          started_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_ads_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ads_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ci_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ads_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "ci_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_analysis_jobs: {
        Row: {
          asset_id: string
          attempts: number
          brand_id: string
          completed_stages: string[]
          cost_usd: number | null
          created_at: string
          error: string | null
          error_code: string | null
          finished_at: string | null
          id: string
          lease_expires_at: string | null
          llm_input_tokens: number | null
          llm_model: string | null
          llm_output_tokens: number | null
          llm_provider: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_retry_at: string | null
          priority: number
          progress: number
          requested_stages: string[]
          skipped_stages: string[]
          stage: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          warnings: Json
        }
        Insert: {
          asset_id: string
          attempts?: number
          brand_id: string
          completed_stages?: string[]
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          llm_input_tokens?: number | null
          llm_model?: string | null
          llm_output_tokens?: number | null
          llm_provider?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          priority?: number
          progress?: number
          requested_stages?: string[]
          skipped_stages?: string[]
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          warnings?: Json
        }
        Update: {
          asset_id?: string
          attempts?: number
          brand_id?: string
          completed_stages?: string[]
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          llm_input_tokens?: number | null
          llm_model?: string | null
          llm_output_tokens?: number | null
          llm_provider?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          priority?: number
          progress?: number
          requested_stages?: string[]
          skipped_stages?: string[]
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ci_analysis_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_analysis_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_analysis_results: {
        Row: {
          ad_id: string | null
          asset_id: string
          brand_id: string
          confidence: number | null
          created_at: string
          cut_count: number | null
          cuts_per_second: number | null
          fidelity: string
          has_before_after: boolean | null
          has_demonstration: boolean | null
          has_problem_solution: boolean | null
          has_social_proof: boolean | null
          has_testimonial: boolean | null
          has_urgency: boolean | null
          hook_duration_s: number | null
          id: string
          kind: string
          model: string | null
          model_run_id: string | null
          normalized_output: Json
          prompt_version: string | null
          provider: string | null
          raw_output: Json
          text_per_second: number | null
          time_to_cta_s: number | null
          time_to_offer_s: number | null
          time_to_product_s: number | null
          user_id: string
          warnings: Json
        }
        Insert: {
          ad_id?: string | null
          asset_id: string
          brand_id: string
          confidence?: number | null
          created_at?: string
          cut_count?: number | null
          cuts_per_second?: number | null
          fidelity?: string
          has_before_after?: boolean | null
          has_demonstration?: boolean | null
          has_problem_solution?: boolean | null
          has_social_proof?: boolean | null
          has_testimonial?: boolean | null
          has_urgency?: boolean | null
          hook_duration_s?: number | null
          id?: string
          kind?: string
          model?: string | null
          model_run_id?: string | null
          normalized_output: Json
          prompt_version?: string | null
          provider?: string | null
          raw_output: Json
          text_per_second?: number | null
          time_to_cta_s?: number | null
          time_to_offer_s?: number | null
          time_to_product_s?: number | null
          user_id: string
          warnings?: Json
        }
        Update: {
          ad_id?: string | null
          asset_id?: string
          brand_id?: string
          confidence?: number | null
          created_at?: string
          cut_count?: number | null
          cuts_per_second?: number | null
          fidelity?: string
          has_before_after?: boolean | null
          has_demonstration?: boolean | null
          has_problem_solution?: boolean | null
          has_social_proof?: boolean | null
          has_testimonial?: boolean | null
          has_urgency?: boolean | null
          hook_duration_s?: number | null
          id?: string
          kind?: string
          model?: string | null
          model_run_id?: string | null
          normalized_output?: Json
          prompt_version?: string | null
          provider?: string | null
          raw_output?: Json
          text_per_second?: number | null
          time_to_cta_s?: number | null
          time_to_offer_s?: number | null
          time_to_product_s?: number | null
          user_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ci_analysis_results_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_analysis_results_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_analysis_results_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_analysis_results_model_run_id_fkey"
            columns: ["model_run_id"]
            isOneToOne: false
            referencedRelation: "ci_model_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_assets: {
        Row: {
          analysis_status: string
          analysis_version: string | null
          analyzed_at: string | null
          aspect_ratio: string | null
          audio_codec: string | null
          bitrate: number | null
          brand_id: string
          created_at: string
          downloaded_at: string | null
          duration_seconds: number | null
          file_ext: string | null
          file_size_bytes: number | null
          fps: number | null
          has_audio: boolean | null
          height: number | null
          id: string
          integrity_note: string | null
          integrity_ok: boolean | null
          is_demo: boolean
          media_type: string
          mime_type: string | null
          sha256: string
          source_url: string | null
          storage_bucket: string
          storage_key: string
          thumbnail_key: string | null
          updated_at: string
          user_id: string
          video_codec: string | null
          width: number | null
        }
        Insert: {
          analysis_status?: string
          analysis_version?: string | null
          analyzed_at?: string | null
          aspect_ratio?: string | null
          audio_codec?: string | null
          bitrate?: number | null
          brand_id: string
          created_at?: string
          downloaded_at?: string | null
          duration_seconds?: number | null
          file_ext?: string | null
          file_size_bytes?: number | null
          fps?: number | null
          has_audio?: boolean | null
          height?: number | null
          id?: string
          integrity_note?: string | null
          integrity_ok?: boolean | null
          is_demo?: boolean
          media_type?: string
          mime_type?: string | null
          sha256: string
          source_url?: string | null
          storage_bucket?: string
          storage_key: string
          thumbnail_key?: string | null
          updated_at?: string
          user_id: string
          video_codec?: string | null
          width?: number | null
        }
        Update: {
          analysis_status?: string
          analysis_version?: string | null
          analyzed_at?: string | null
          aspect_ratio?: string | null
          audio_codec?: string | null
          bitrate?: number | null
          brand_id?: string
          created_at?: string
          downloaded_at?: string | null
          duration_seconds?: number | null
          file_ext?: string | null
          file_size_bytes?: number | null
          fps?: number | null
          has_audio?: boolean | null
          height?: number | null
          id?: string
          integrity_note?: string | null
          integrity_ok?: boolean | null
          is_demo?: boolean
          media_type?: string
          mime_type?: string | null
          sha256?: string
          source_url?: string | null
          storage_bucket?: string
          storage_key?: string
          thumbnail_key?: string | null
          updated_at?: string
          user_id?: string
          video_codec?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_brand_pages: {
        Row: {
          brand_id: string
          category: string | null
          created_at: string
          discovered_at: string
          id: string
          ig_followers: number | null
          ig_username: string | null
          image_uri: string | null
          is_selected: boolean
          likes: number | null
          page_alias: string | null
          page_id: string
          page_name: string
          raw_payload: Json | null
          user_id: string
          verification: string | null
        }
        Insert: {
          brand_id: string
          category?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          ig_followers?: number | null
          ig_username?: string | null
          image_uri?: string | null
          is_selected?: boolean
          likes?: number | null
          page_alias?: string | null
          page_id: string
          page_name: string
          raw_payload?: Json | null
          user_id: string
          verification?: string | null
        }
        Update: {
          brand_id?: string
          category?: string | null
          created_at?: string
          discovered_at?: string
          id?: string
          ig_followers?: number | null
          ig_username?: string | null
          image_uri?: string | null
          is_selected?: boolean
          likes?: number | null
          page_alias?: string | null
          page_id?: string
          page_name?: string
          raw_payload?: Json | null
          user_id?: string
          verification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_brand_pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_brands: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          language: string | null
          market: string | null
          name: string
          notes: string | null
          slug: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          language?: string | null
          market?: string | null
          name: string
          notes?: string | null
          slug: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          language?: string | null
          market?: string | null
          name?: string
          notes?: string | null
          slug?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      ci_concept_members: {
        Row: {
          ad_id: string
          added_by: string
          brand_id: string
          concept_id: string
          created_at: string
          id: string
          is_baseline: boolean
          match_method: string
          match_reasons: Json
          match_score: number | null
          user_id: string
        }
        Insert: {
          ad_id: string
          added_by?: string
          brand_id: string
          concept_id: string
          created_at?: string
          id?: string
          is_baseline?: boolean
          match_method: string
          match_reasons?: Json
          match_score?: number | null
          user_id: string
        }
        Update: {
          ad_id?: string
          added_by?: string
          brand_id?: string
          concept_id?: string
          created_at?: string
          id?: string
          is_baseline?: boolean
          match_method?: string
          match_reasons?: Json
          match_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_concept_members_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concept_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concept_members_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ci_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_concept_scale_components: {
        Row: {
          band: string
          brand_id: string
          computed_at: string
          concept_id: string
          config_version: string
          contributions: Json
          id: string
          normalized: Json
          raw: Json
          signal: number
          user_id: string
        }
        Insert: {
          band?: string
          brand_id: string
          computed_at?: string
          concept_id: string
          config_version?: string
          contributions?: Json
          id?: string
          normalized?: Json
          raw?: Json
          signal?: number
          user_id: string
        }
        Update: {
          band?: string
          brand_id?: string
          computed_at?: string
          concept_id?: string
          config_version?: string
          contributions?: Json
          id?: string
          normalized?: Json
          raw?: Json
          signal?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_concept_scale_components_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concept_scale_components_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ci_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_concepts: {
        Row: {
          ad_count: number
          angle_term_id: string | null
          baseline_ad_id: string | null
          brand_id: string
          confidence: number | null
          created_at: string
          description: string | null
          first_seen_at: string | null
          format_count: number
          grouping_method: string
          hypothesis: string | null
          id: string
          is_active: boolean
          is_demo: boolean
          last_seen_at: string | null
          longevity_days: number
          market_count: number
          mechanism_term_id: string | null
          merged_into_id: string | null
          name: string
          person_count: number
          product_term_id: string | null
          proof_term_id: string | null
          review_status: string
          reviewed_at: string | null
          scale_band: string | null
          scale_signal: number | null
          scenario_term_id: string | null
          signature: string | null
          signature_vector: Json | null
          unique_asset_count: number
          updated_at: string
          user_id: string
          variant_count: number
        }
        Insert: {
          ad_count?: number
          angle_term_id?: string | null
          baseline_ad_id?: string | null
          brand_id: string
          confidence?: number | null
          created_at?: string
          description?: string | null
          first_seen_at?: string | null
          format_count?: number
          grouping_method?: string
          hypothesis?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          last_seen_at?: string | null
          longevity_days?: number
          market_count?: number
          mechanism_term_id?: string | null
          merged_into_id?: string | null
          name: string
          person_count?: number
          product_term_id?: string | null
          proof_term_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          scale_band?: string | null
          scale_signal?: number | null
          scenario_term_id?: string | null
          signature?: string | null
          signature_vector?: Json | null
          unique_asset_count?: number
          updated_at?: string
          user_id: string
          variant_count?: number
        }
        Update: {
          ad_count?: number
          angle_term_id?: string | null
          baseline_ad_id?: string | null
          brand_id?: string
          confidence?: number | null
          created_at?: string
          description?: string | null
          first_seen_at?: string | null
          format_count?: number
          grouping_method?: string
          hypothesis?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          last_seen_at?: string | null
          longevity_days?: number
          market_count?: number
          mechanism_term_id?: string | null
          merged_into_id?: string | null
          name?: string
          person_count?: number
          product_term_id?: string | null
          proof_term_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          scale_band?: string | null
          scale_signal?: number | null
          scenario_term_id?: string | null
          signature?: string | null
          signature_vector?: Json | null
          unique_asset_count?: number
          updated_at?: string
          user_id?: string
          variant_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_ctas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_hooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_objections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_angle_term_id_fkey"
            columns: ["angle_term_id"]
            isOneToOne: false
            referencedRelation: "ci_taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_baseline_ad_id_fkey"
            columns: ["baseline_ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_ctas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_hooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_objections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_mechanism_term_id_fkey"
            columns: ["mechanism_term_id"]
            isOneToOne: false
            referencedRelation: "ci_taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "ci_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_ctas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_hooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_objections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_product_term_id_fkey"
            columns: ["product_term_id"]
            isOneToOne: false
            referencedRelation: "ci_taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_ctas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_hooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_objections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_proof_term_id_fkey"
            columns: ["proof_term_id"]
            isOneToOne: false
            referencedRelation: "ci_taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_angles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_ctas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_hooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_objections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_concepts_scenario_term_id_fkey"
            columns: ["scenario_term_id"]
            isOneToOne: false
            referencedRelation: "ci_taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_creative_variants: {
        Row: {
          ad_id: string
          baseline_ad_id: string
          brand_id: string
          change_count: number
          changed_body: boolean
          changed_creator: boolean
          changed_cta: boolean
          changed_duration: boolean
          changed_format: boolean
          changed_framing: boolean
          changed_hook: boolean
          changed_intro: boolean
          changed_landing_page: boolean
          changed_music: boolean
          changed_offer: boolean
          changed_scene_order: boolean
          changed_text: boolean
          changes: Json
          concept_id: string
          created_at: string
          distance: number | null
          id: string
          model_version: string | null
          source: string
          user_id: string
          variant_index: number
        }
        Insert: {
          ad_id: string
          baseline_ad_id: string
          brand_id: string
          change_count?: number
          changed_body?: boolean
          changed_creator?: boolean
          changed_cta?: boolean
          changed_duration?: boolean
          changed_format?: boolean
          changed_framing?: boolean
          changed_hook?: boolean
          changed_intro?: boolean
          changed_landing_page?: boolean
          changed_music?: boolean
          changed_offer?: boolean
          changed_scene_order?: boolean
          changed_text?: boolean
          changes?: Json
          concept_id: string
          created_at?: string
          distance?: number | null
          id?: string
          model_version?: string | null
          source?: string
          user_id: string
          variant_index?: number
        }
        Update: {
          ad_id?: string
          baseline_ad_id?: string
          brand_id?: string
          change_count?: number
          changed_body?: boolean
          changed_creator?: boolean
          changed_cta?: boolean
          changed_duration?: boolean
          changed_format?: boolean
          changed_framing?: boolean
          changed_hook?: boolean
          changed_intro?: boolean
          changed_landing_page?: boolean
          changed_music?: boolean
          changed_offer?: boolean
          changed_scene_order?: boolean
          changed_text?: boolean
          changes?: Json
          concept_id?: string
          created_at?: string
          distance?: number | null
          id?: string
          model_version?: string | null
          source?: string
          user_id?: string
          variant_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "ci_creative_variants_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_creative_variants_baseline_ad_id_fkey"
            columns: ["baseline_ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_creative_variants_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_creative_variants_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ci_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_download_jobs: {
        Row: {
          ad_id: string
          asset_id: string | null
          attempts: number
          brand_id: string
          bytes_downloaded: number
          bytes_per_second: number | null
          bytes_total: number | null
          created_at: string
          error: string | null
          error_code: string | null
          finished_at: string | null
          id: string
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          media_source_id: string
          next_retry_at: string | null
          priority: number
          progress: number
          stage: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          was_duplicate: boolean
        }
        Insert: {
          ad_id: string
          asset_id?: string | null
          attempts?: number
          brand_id: string
          bytes_downloaded?: number
          bytes_per_second?: number | null
          bytes_total?: number | null
          created_at?: string
          error?: string | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          media_source_id: string
          next_retry_at?: string | null
          priority?: number
          progress?: number
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          was_duplicate?: boolean
        }
        Update: {
          ad_id?: string
          asset_id?: string | null
          attempts?: number
          brand_id?: string
          bytes_downloaded?: number
          bytes_per_second?: number | null
          bytes_total?: number | null
          created_at?: string
          error?: string | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          media_source_id?: string
          next_retry_at?: string | null
          priority?: number
          progress?: number
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          was_duplicate?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ci_download_jobs_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_download_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_download_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_download_jobs_media_source_id_fkey"
            columns: ["media_source_id"]
            isOneToOne: true
            referencedRelation: "ci_ad_media_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_estimated_metrics: {
        Row: {
          ad_id: string
          availability: string
          brand_id: string
          breakdown: Json | null
          collected_at: string
          created_at: string
          currency: string | null
          id: string
          is_estimated: boolean
          limitation: string
          metric: string
          source: string
          user_id: string
          value_max: number | null
          value_min: number | null
          value_numeric: number | null
        }
        Insert: {
          ad_id: string
          availability?: string
          brand_id: string
          breakdown?: Json | null
          collected_at?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_estimated?: boolean
          limitation?: string
          metric: string
          source: string
          user_id: string
          value_max?: number | null
          value_min?: number | null
          value_numeric?: number | null
        }
        Update: {
          ad_id?: string
          availability?: string
          brand_id?: string
          breakdown?: Json | null
          collected_at?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_estimated?: boolean
          limitation?: string
          metric?: string
          source?: string
          user_id?: string
          value_max?: number | null
          value_min?: number | null
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_estimated_metrics_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_estimated_metrics_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_face_tracks: {
        Row: {
          asset_id: string
          avg_face_area: number | null
          brand_id: string
          confidence: number | null
          created_at: string
          embedding: Json | null
          embedding_model: string | null
          end_seconds: number
          frame_count: number
          id: string
          match_distance: number | null
          person_cluster_id: string | null
          start_seconds: number
          thumbnail_key: string | null
          track_index: number
          user_id: string
        }
        Insert: {
          asset_id: string
          avg_face_area?: number | null
          brand_id: string
          confidence?: number | null
          created_at?: string
          embedding?: Json | null
          embedding_model?: string | null
          end_seconds: number
          frame_count?: number
          id?: string
          match_distance?: number | null
          person_cluster_id?: string | null
          start_seconds: number
          thumbnail_key?: string | null
          track_index: number
          user_id: string
        }
        Update: {
          asset_id?: string
          avg_face_area?: number | null
          brand_id?: string
          confidence?: number | null
          created_at?: string
          embedding?: Json | null
          embedding_model?: string | null
          end_seconds?: number
          frame_count?: number
          id?: string
          match_distance?: number | null
          person_cluster_id?: string | null
          start_seconds?: number
          thumbnail_key?: string | null
          track_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_face_tracks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_face_tracks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_face_tracks_person_cluster_id_fkey"
            columns: ["person_cluster_id"]
            isOneToOne: false
            referencedRelation: "ci_person_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_import_runs: {
        Row: {
          ads_created: number
          ads_returned: number
          ads_skipped_known: number
          ads_updated: number
          brand_id: string
          brand_page_id: string | null
          created_at: string
          credits_estimated: number
          credits_spent: number
          endpoint: string
          error: string | null
          filters: Json
          finished_at: string | null
          id: string
          max_ads: number
          max_credits: number
          media_urls_found: number
          next_cursor: string | null
          pages_fetched: number
          source: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ads_created?: number
          ads_returned?: number
          ads_skipped_known?: number
          ads_updated?: number
          brand_id: string
          brand_page_id?: string | null
          created_at?: string
          credits_estimated?: number
          credits_spent?: number
          endpoint: string
          error?: string | null
          filters?: Json
          finished_at?: string | null
          id?: string
          max_ads?: number
          max_credits?: number
          media_urls_found?: number
          next_cursor?: string | null
          pages_fetched?: number
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ads_created?: number
          ads_returned?: number
          ads_skipped_known?: number
          ads_updated?: number
          brand_id?: string
          brand_page_id?: string | null
          created_at?: string
          credits_estimated?: number
          credits_spent?: number
          endpoint?: string
          error?: string | null
          filters?: Json
          finished_at?: string | null
          id?: string
          max_ads?: number
          max_credits?: number
          media_urls_found?: number
          next_cursor?: string | null
          pages_fetched?: number
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_import_runs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_import_runs_brand_page_id_fkey"
            columns: ["brand_page_id"]
            isOneToOne: false
            referencedRelation: "ci_brand_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_job_events: {
        Row: {
          brand_id: string | null
          created_at: string
          id: number
          job_id: string | null
          job_kind: string
          level: string
          message: string
          payload: Json
          stage: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: number
          job_id?: string | null
          job_kind: string
          level?: string
          message: string
          payload?: Json
          stage?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: number
          job_id?: string | null
          job_kind?: string
          level?: string
          message?: string
          payload?: Json
          stage?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_job_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_keyframes: {
        Row: {
          asset_id: string
          brand_id: string
          created_at: string
          frame_index: number
          height: number | null
          id: string
          phash: string | null
          reason: string
          scene_id: string | null
          size_bytes: number | null
          storage_key: string
          timestamp_s: number
          user_id: string
          width: number | null
        }
        Insert: {
          asset_id: string
          brand_id: string
          created_at?: string
          frame_index: number
          height?: number | null
          id?: string
          phash?: string | null
          reason?: string
          scene_id?: string | null
          size_bytes?: number | null
          storage_key: string
          timestamp_s: number
          user_id: string
          width?: number | null
        }
        Update: {
          asset_id?: string
          brand_id?: string
          created_at?: string
          frame_index?: number
          height?: number | null
          id?: string
          phash?: string | null
          reason?: string
          scene_id?: string | null
          size_bytes?: number | null
          storage_key?: string
          timestamp_s?: number
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_keyframes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_keyframes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_keyframes_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "ci_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_learnings: {
        Row: {
          brand_id: string
          category: string
          confidence: number | null
          created_at: string
          evidence: Json
          evidence_count: number
          id: string
          is_demo: boolean
          limitation: string
          statement: string
          suggestion: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          category: string
          confidence?: number | null
          created_at?: string
          evidence?: Json
          evidence_count?: number
          id?: string
          is_demo?: boolean
          limitation?: string
          statement: string
          suggestion?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          category?: string
          confidence?: number | null
          created_at?: string
          evidence?: Json
          evidence_count?: number
          id?: string
          is_demo?: boolean
          limitation?: string
          statement?: string
          suggestion?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_learnings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_model_runs: {
        Row: {
          ad_id: string | null
          analysis_job_id: string | null
          asset_id: string | null
          brand_id: string
          cost_usd: number | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input_summary: Json
          input_tokens: number | null
          input_version: string | null
          latency_ms: number | null
          model: string
          output_tokens: number | null
          prompt_version: string
          provider: string
          purpose: string
          status: string
          user_id: string
        }
        Insert: {
          ad_id?: string | null
          analysis_job_id?: string | null
          asset_id?: string | null
          brand_id: string
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_summary?: Json
          input_tokens?: number | null
          input_version?: string | null
          latency_ms?: number | null
          model: string
          output_tokens?: number | null
          prompt_version: string
          provider: string
          purpose: string
          status?: string
          user_id: string
        }
        Update: {
          ad_id?: string | null
          analysis_job_id?: string | null
          asset_id?: string | null
          brand_id?: string
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_summary?: Json
          input_tokens?: number | null
          input_version?: string | null
          latency_ms?: number | null
          model?: string
          output_tokens?: number | null
          prompt_version?: string
          provider?: string
          purpose?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_model_runs_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ci_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_model_runs_analysis_job_id_fkey"
            columns: ["analysis_job_id"]
            isOneToOne: false
            referencedRelation: "ci_analysis_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_model_runs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_model_runs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_ocr_tracks: {
        Row: {
          asset_id: string
          bbox: Json | null
          confidence: number | null
          created_at: string
          engine: string
          id: string
          keyframe_id: string | null
          text: string
          timestamp_s: number
          user_id: string
        }
        Insert: {
          asset_id: string
          bbox?: Json | null
          confidence?: number | null
          created_at?: string
          engine: string
          id?: string
          keyframe_id?: string | null
          text: string
          timestamp_s: number
          user_id: string
        }
        Update: {
          asset_id?: string
          bbox?: Json | null
          confidence?: number | null
          created_at?: string
          engine?: string
          id?: string
          keyframe_id?: string | null
          text?: string
          timestamp_s?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_ocr_tracks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_ocr_tracks_keyframe_id_fkey"
            columns: ["keyframe_id"]
            isOneToOne: false
            referencedRelation: "ci_keyframes"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_onscreen_text: {
        Row: {
          asset_id: string
          brand_id: string
          confidence: number | null
          created_at: string
          end_seconds: number
          id: string
          model_version: string | null
          normalized_text: string | null
          position: string | null
          role: string | null
          source: string
          start_seconds: number
          text: string
          track_index: number
          user_id: string
        }
        Insert: {
          asset_id: string
          brand_id: string
          confidence?: number | null
          created_at?: string
          end_seconds: number
          id?: string
          model_version?: string | null
          normalized_text?: string | null
          position?: string | null
          role?: string | null
          source?: string
          start_seconds: number
          text: string
          track_index: number
          user_id: string
        }
        Update: {
          asset_id?: string
          brand_id?: string
          confidence?: number | null
          created_at?: string
          end_seconds?: number
          id?: string
          model_version?: string | null
          normalized_text?: string | null
          position?: string | null
          role?: string | null
          source?: string
          start_seconds?: number
          text?: string
          track_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_onscreen_text_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_onscreen_text_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_person_clusters: {
        Row: {
          ad_count: number
          appearance_count: number
          asset_count: number
          brand_id: string
          centroid: Json | null
          concept_count: number
          confidence: number | null
          created_at: string
          display_name: string | null
          embedding_model: string | null
          first_seen_at: string | null
          id: string
          label: string
          last_seen_at: string | null
          merged_into_id: string | null
          review_status: string
          reviewed_at: string | null
          thumbnail_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_count?: number
          appearance_count?: number
          asset_count?: number
          brand_id: string
          centroid?: Json | null
          concept_count?: number
          confidence?: number | null
          created_at?: string
          display_name?: string | null
          embedding_model?: string | null
          first_seen_at?: string | null
          id?: string
          label: string
          last_seen_at?: string | null
          merged_into_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          thumbnail_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_count?: number
          appearance_count?: number
          asset_count?: number
          brand_id?: string
          centroid?: Json | null
          concept_count?: number
          confidence?: number | null
          created_at?: string
          display_name?: string | null
          embedding_model?: string | null
          first_seen_at?: string | null
          id?: string
          label?: string
          last_seen_at?: string | null
          merged_into_id?: string | null
          review_status?: string
          reviewed_at?: string | null
          thumbnail_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_person_clusters_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_person_clusters_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "ci_person_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_scale_signal_config: {
        Row: {
          band_high: number
          band_medium: number
          band_very_high: number
          brand_id: string
          created_at: string
          id: string
          min_ads_for_band: number
          recency_window_days: number
          sat_ad_volume: number
          sat_creators: number
          sat_formats: number
          sat_longevity_days: number
          sat_markets: number
          sat_unique_assets: number
          sat_variants: number
          updated_at: string
          user_id: string
          version: string
          w_ad_volume: number
          w_creators: number
          w_estimated: number
          w_evolution: number
          w_formats: number
          w_longevity: number
          w_markets: number
          w_recency: number
          w_unique_assets: number
          w_variants: number
        }
        Insert: {
          band_high?: number
          band_medium?: number
          band_very_high?: number
          brand_id: string
          created_at?: string
          id?: string
          min_ads_for_band?: number
          recency_window_days?: number
          sat_ad_volume?: number
          sat_creators?: number
          sat_formats?: number
          sat_longevity_days?: number
          sat_markets?: number
          sat_unique_assets?: number
          sat_variants?: number
          updated_at?: string
          user_id: string
          version?: string
          w_ad_volume?: number
          w_creators?: number
          w_estimated?: number
          w_evolution?: number
          w_formats?: number
          w_longevity?: number
          w_markets?: number
          w_recency?: number
          w_unique_assets?: number
          w_variants?: number
        }
        Update: {
          band_high?: number
          band_medium?: number
          band_very_high?: number
          brand_id?: string
          created_at?: string
          id?: string
          min_ads_for_band?: number
          recency_window_days?: number
          sat_ad_volume?: number
          sat_creators?: number
          sat_formats?: number
          sat_longevity_days?: number
          sat_markets?: number
          sat_unique_assets?: number
          sat_variants?: number
          updated_at?: string
          user_id?: string
          version?: string
          w_ad_volume?: number
          w_creators?: number
          w_estimated?: number
          w_evolution?: number
          w_formats?: number
          w_longevity?: number
          w_markets?: number
          w_recency?: number
          w_unique_assets?: number
          w_variants?: number
        }
        Relationships: [
          {
            foreignKeyName: "ci_scale_signal_config_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_scenes: {
        Row: {
          action: string | null
          asset_id: string
          brand_id: string
          camera_style: string | null
          confidence: number | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          end_seconds: number
          framing: string | null
          id: string
          keyframe_key: string | null
          lighting: string | null
          model_version: string | null
          objects: Json
          product_visible: boolean | null
          scene_function: string | null
          scene_index: number
          setting: string | null
          setting_kind: string | null
          source: string
          start_seconds: number
          user_id: string
        }
        Insert: {
          action?: string | null
          asset_id: string
          brand_id: string
          camera_style?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          end_seconds: number
          framing?: string | null
          id?: string
          keyframe_key?: string | null
          lighting?: string | null
          model_version?: string | null
          objects?: Json
          product_visible?: boolean | null
          scene_function?: string | null
          scene_index: number
          setting?: string | null
          setting_kind?: string | null
          source?: string
          start_seconds: number
          user_id: string
        }
        Update: {
          action?: string | null
          asset_id?: string
          brand_id?: string
          camera_style?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          end_seconds?: number
          framing?: string | null
          id?: string
          keyframe_key?: string | null
          lighting?: string | null
          model_version?: string | null
          objects?: Json
          product_visible?: boolean | null
          scene_function?: string | null
          scene_index?: number
          setting?: string | null
          setting_kind?: string | null
          source?: string
          start_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_scenes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_scenes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_speakers: {
        Row: {
          asset_id: string
          association_conf: number | null
          created_at: string
          id: string
          label: string
          person_cluster_id: string | null
          segment_count: number
          total_seconds: number
          user_id: string
        }
        Insert: {
          asset_id: string
          association_conf?: number | null
          created_at?: string
          id?: string
          label: string
          person_cluster_id?: string | null
          segment_count?: number
          total_seconds?: number
          user_id: string
        }
        Update: {
          asset_id?: string
          association_conf?: number | null
          created_at?: string
          id?: string
          label?: string
          person_cluster_id?: string | null
          segment_count?: number
          total_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_speakers_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_speakers_person_cluster_fkey"
            columns: ["person_cluster_id"]
            isOneToOne: false
            referencedRelation: "ci_person_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_storage_objects: {
        Row: {
          asset_id: string | null
          brand_id: string
          bucket: string
          category: string
          content_type: string | null
          created_at: string
          deleted_at: string | null
          etag: string | null
          id: string
          object_key: string
          sha256: string | null
          size_bytes: number
          uploaded_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          brand_id: string
          bucket?: string
          category: string
          content_type?: string | null
          created_at?: string
          deleted_at?: string | null
          etag?: string | null
          id?: string
          object_key: string
          sha256?: string | null
          size_bytes?: number
          uploaded_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          brand_id?: string
          bucket?: string
          category?: string
          content_type?: string | null
          created_at?: string
          deleted_at?: string | null
          etag?: string | null
          id?: string
          object_key?: string
          sha256?: string | null
          size_bytes?: number
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_storage_objects_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_storage_objects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_taxonomy_terms: {
        Row: {
          ad_count: number
          asset_count: number
          brand_id: string
          concept_count: number
          created_at: string
          description: string | null
          first_seen_at: string | null
          id: string
          is_demo: boolean
          kind: string
          label: string
          last_seen_at: string | null
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_count?: number
          asset_count?: number
          brand_id: string
          concept_count?: number
          created_at?: string
          description?: string | null
          first_seen_at?: string | null
          id?: string
          is_demo?: boolean
          kind: string
          label: string
          last_seen_at?: string | null
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_count?: number
          asset_count?: number
          brand_id?: string
          concept_count?: number
          created_at?: string
          description?: string | null
          first_seen_at?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          label?: string
          last_seen_at?: string | null
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_transcript_segments: {
        Row: {
          asset_id: string
          confidence: number | null
          created_at: string
          end_seconds: number
          id: string
          no_speech_prob: number | null
          segment_index: number
          speaker_id: string | null
          start_seconds: number
          text: string
          transcript_id: string
          user_id: string
          words: Json | null
        }
        Insert: {
          asset_id: string
          confidence?: number | null
          created_at?: string
          end_seconds: number
          id?: string
          no_speech_prob?: number | null
          segment_index: number
          speaker_id?: string | null
          start_seconds: number
          text: string
          transcript_id: string
          user_id: string
          words?: Json | null
        }
        Update: {
          asset_id?: string
          confidence?: number | null
          created_at?: string
          end_seconds?: number
          id?: string
          no_speech_prob?: number | null
          segment_index?: number
          speaker_id?: string | null
          start_seconds?: number
          text?: string
          transcript_id?: string
          user_id?: string
          words?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_transcript_segments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_transcript_segments_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "ci_speakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_transcript_segments_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "ci_transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_transcripts: {
        Row: {
          asset_id: string
          brand_id: string
          confidence: number | null
          created_at: string
          duration_seconds: number | null
          engine: string
          engine_model: string | null
          full_text: string
          has_diarization: boolean
          id: string
          language: string | null
          language_prob: number | null
          speech_rate: number | null
          user_id: string
          word_count: number
        }
        Insert: {
          asset_id: string
          brand_id: string
          confidence?: number | null
          created_at?: string
          duration_seconds?: number | null
          engine: string
          engine_model?: string | null
          full_text?: string
          has_diarization?: boolean
          id?: string
          language?: string | null
          language_prob?: number | null
          speech_rate?: number | null
          user_id: string
          word_count?: number
        }
        Update: {
          asset_id?: string
          brand_id?: string
          confidence?: number | null
          created_at?: string
          duration_seconds?: number | null
          engine?: string
          engine_model?: string | null
          full_text?: string
          has_diarization?: boolean
          id?: string
          language?: string | null
          language_prob?: number | null
          speech_rate?: number | null
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ci_transcripts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "ci_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_transcripts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
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
          persona_id: string | null
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
          persona_id?: string | null
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
          persona_id?: string | null
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
          {
            foreignKeyName: "creative_memory_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          account_id: string
          analyzed_at: string | null
          body: string | null
          cluster_id: string | null
          created_at: string | null
          cta_type: string | null
          dominant_colors: Json | null
          format: string | null
          has_cta: boolean | null
          has_hook: boolean | null
          hook_rate: number | null
          hook_timing_ms: number | null
          id: string
          link_url: string | null
          meta_creative_id: string | null
          phash: string | null
          text_density: string | null
          thumbnail_url: string | null
          title: string | null
          video_url: string | null
        }
        Insert: {
          account_id: string
          analyzed_at?: string | null
          body?: string | null
          cluster_id?: string | null
          created_at?: string | null
          cta_type?: string | null
          dominant_colors?: Json | null
          format?: string | null
          has_cta?: boolean | null
          has_hook?: boolean | null
          hook_rate?: number | null
          hook_timing_ms?: number | null
          id?: string
          link_url?: string | null
          meta_creative_id?: string | null
          phash?: string | null
          text_density?: string | null
          thumbnail_url?: string | null
          title?: string | null
          video_url?: string | null
        }
        Update: {
          account_id?: string
          analyzed_at?: string | null
          body?: string | null
          cluster_id?: string | null
          created_at?: string | null
          cta_type?: string | null
          dominant_colors?: Json | null
          format?: string | null
          has_cta?: boolean | null
          has_hook?: boolean | null
          hook_rate?: number | null
          hook_timing_ms?: number | null
          id?: string
          link_url?: string | null
          meta_creative_id?: string | null
          phash?: string | null
          text_density?: string | null
          thumbnail_url?: string | null
          title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          action: string
          balance_after: number
          created_at: string
          credits: number
          id: string
          metadata: Json | null
          period: string
          user_id: string
        }
        Insert: {
          action: string
          balance_after: number
          created_at?: string
          credits: number
          id?: string
          metadata?: Json | null
          period: string
          user_id: string
        }
        Update: {
          action?: string
          balance_after?: number
          created_at?: string
          credits?: number
          id?: string
          metadata?: Json | null
          period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      decisions: {
        Row: {
          account_id: string
          acted_at: string | null
          action_recommendation: string | null
          actions: Json | null
          ad_id: string | null
          break_even_roas: number | null
          confidence_gate: string | null
          cooldown_active: boolean | null
          created_at: string | null
          data_confidence: number | null
          dismissed_at: string | null
          expires_at: string | null
          explanation_chain: Json | null
          financial_verdict: string | null
          gradual_step: number | null
          group_note: string | null
          headline: string
          id: string
          impact_7d: number | null
          impact_basis: string | null
          impact_confidence: string | null
          impact_daily: number | null
          impact_type: string | null
          invalidator: string | null
          margin_of_safety: number | null
          metrics: Json | null
          metrics_snapshot: Json | null
          pipeline_approved: boolean | null
          pipeline_mode: string | null
          priority_rank: number | null
          reason: string
          risk_level: string | null
          rollback_plan: string | null
          safety_status: string | null
          score: number
          source: string
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          account_id: string
          acted_at?: string | null
          action_recommendation?: string | null
          actions?: Json | null
          ad_id?: string | null
          break_even_roas?: number | null
          confidence_gate?: string | null
          cooldown_active?: boolean | null
          created_at?: string | null
          data_confidence?: number | null
          dismissed_at?: string | null
          expires_at?: string | null
          explanation_chain?: Json | null
          financial_verdict?: string | null
          gradual_step?: number | null
          group_note?: string | null
          headline: string
          id?: string
          impact_7d?: number | null
          impact_basis?: string | null
          impact_confidence?: string | null
          impact_daily?: number | null
          impact_type?: string | null
          invalidator?: string | null
          margin_of_safety?: number | null
          metrics?: Json | null
          metrics_snapshot?: Json | null
          pipeline_approved?: boolean | null
          pipeline_mode?: string | null
          priority_rank?: number | null
          reason: string
          risk_level?: string | null
          rollback_plan?: string | null
          safety_status?: string | null
          score: number
          source?: string
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          acted_at?: string | null
          action_recommendation?: string | null
          actions?: Json | null
          ad_id?: string | null
          break_even_roas?: number | null
          confidence_gate?: string | null
          cooldown_active?: boolean | null
          created_at?: string | null
          data_confidence?: number | null
          dismissed_at?: string | null
          expires_at?: string | null
          explanation_chain?: Json | null
          financial_verdict?: string | null
          gradual_step?: number | null
          group_note?: string | null
          headline?: string
          id?: string
          impact_7d?: number | null
          impact_basis?: string | null
          impact_confidence?: string | null
          impact_daily?: number | null
          impact_type?: string | null
          invalidator?: string | null
          margin_of_safety?: number | null
          metrics?: Json | null
          metrics_snapshot?: Json | null
          pipeline_approved?: boolean | null
          pipeline_mode?: string | null
          priority_rank?: number | null
          reason?: string
          risk_level?: string | null
          rollback_plan?: string | null
          safety_status?: string | null
          score?: number
          source?: string
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_leads: {
        Row: {
          analysis_result: Json | null
          analysis_score: number | null
          converted: boolean | null
          created_at: string | null
          email: string | null
          followup_sent_at: string | null
          id: string
          ip_address: string | null
          lang: string | null
          share_id: string | null
        }
        Insert: {
          analysis_result?: Json | null
          analysis_score?: number | null
          converted?: boolean | null
          created_at?: string | null
          email?: string | null
          followup_sent_at?: string | null
          id?: string
          ip_address?: string | null
          lang?: string | null
          share_id?: string | null
        }
        Update: {
          analysis_result?: Json | null
          analysis_score?: number | null
          converted?: boolean | null
          created_at?: string | null
          email?: string | null
          followup_sent_at?: string | null
          id?: string
          ip_address?: string | null
          lang?: string | null
          share_id?: string | null
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
      error_logs: {
        Row: {
          component: string | null
          created_at: string
          error_type: string
          id: string
          message: string | null
          metadata: Json | null
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          error_type?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          error_type?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
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
      hub_assets: {
        Row: {
          content: Json
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_campaign_redemptions: {
        Row: {
          code: string
          currency: string
          full_price_at: string | null
          id: string
          intro_months: number
          plan: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          currency: string
          full_price_at?: string | null
          id?: string
          intro_months: number
          plan: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          currency?: string
          full_price_at?: string | null
          id?: string
          intro_months?: number
          plan?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_campaign_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "hub_campaign_stats"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "hub_campaign_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "hub_campaigns"
            referencedColumns: ["code"]
          },
        ]
      }
      hub_campaigns: {
        Row: {
          active: boolean
          code: string
          created_at: string
          ends_at: string | null
          intro_months: number
          intro_price_brl: number | null
          intro_price_usd: number | null
          label: string
          max_redemptions: number | null
          plan: string
          redeemed: number
          source: string | null
          starts_at: string
          stripe_promotion_code_brl: string | null
          stripe_promotion_code_usd: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          ends_at?: string | null
          intro_months?: number
          intro_price_brl?: number | null
          intro_price_usd?: number | null
          label: string
          max_redemptions?: number | null
          plan?: string
          redeemed?: number
          source?: string | null
          starts_at?: string
          stripe_promotion_code_brl?: string | null
          stripe_promotion_code_usd?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          ends_at?: string | null
          intro_months?: number
          intro_price_brl?: number | null
          intro_price_usd?: number | null
          label?: string
          max_redemptions?: number | null
          plan?: string
          redeemed?: number
          source?: string | null
          starts_at?: string
          stripe_promotion_code_brl?: string | null
          stripe_promotion_code_usd?: string | null
        }
        Relationships: []
      }
      hub_credit_ledger: {
        Row: {
          action: string
          created_at: string
          credits: number
          id: string
          ref_id: string | null
          settled_at: string | null
          state: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits: number
          id?: string
          ref_id?: string | null
          settled_at?: string | null
          state?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits?: number
          id?: string
          ref_id?: string | null
          settled_at?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_credit_packs: {
        Row: {
          created_at: string
          credits: number
          expires_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          expires_at?: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          expires_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_elements: {
        Row: {
          byte_size: number | null
          created_at: string
          id: string
          mime_type: string | null
          name: string
          public_url: string
          storage_path: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          public_url: string
          storage_path: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          public_url?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_hook_library: {
        Row: {
          brand_kind: string | null
          category: string
          copy: string
          created_at: string
          id: string
          is_official: boolean | null
          locale: string | null
          score: number | null
        }
        Insert: {
          brand_kind?: string | null
          category: string
          copy: string
          created_at?: string
          id?: string
          is_official?: boolean | null
          locale?: string | null
          score?: number | null
        }
        Update: {
          brand_kind?: string | null
          category?: string
          copy?: string
          created_at?: string
          id?: string
          is_official?: boolean | null
          locale?: string | null
          score?: number | null
        }
        Relationships: []
      }
      hub_plan_config: {
        Row: {
          max_concurrent: number
          max_videos_day: number | null
          max_videos_month: number | null
          monthly_credits: number
          plan: string
          price_brl: number | null
          price_usd: number | null
          renews: boolean
          updated_at: string
        }
        Insert: {
          max_concurrent?: number
          max_videos_day?: number | null
          max_videos_month?: number | null
          monthly_credits: number
          plan: string
          price_brl?: number | null
          price_usd?: number | null
          renews?: boolean
          updated_at?: string
        }
        Update: {
          max_concurrent?: number
          max_videos_day?: number | null
          max_videos_month?: number | null
          monthly_credits?: number
          plan?: string
          price_brl?: number | null
          price_usd?: number | null
          renews?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hub_workflow_runs: {
        Row: {
          created_at: string
          ended_at: string | null
          error: string | null
          id: string
          inputs: Json | null
          outputs: Json | null
          started_at: string | null
          status: string
          user_id: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          error?: string | null
          id?: string
          inputs?: Json | null
          outputs?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          error?: string | null
          id?: string
          inputs?: Json | null
          outputs?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "hub_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_workflows: {
        Row: {
          brand_id: string | null
          created_at: string
          description: string | null
          graph: Json
          id: string
          is_template: boolean
          name: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          description?: string | null
          graph: Json
          id?: string
          is_template?: boolean
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          description?: string | null
          graph?: Json
          id?: string
          is_template?: boolean
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      landing_page_snapshots: {
        Row: {
          content: string | null
          created_at: string | null
          error: string | null
          fetched_at: string | null
          has_conversion_event: boolean | null
          has_fb_pixel: boolean | null
          id: string
          primary_cta: string | null
          source: string
          title: string | null
          url: string
          url_hash: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          error?: string | null
          fetched_at?: string | null
          has_conversion_event?: boolean | null
          has_fb_pixel?: boolean | null
          id?: string
          primary_cta?: string | null
          source?: string
          title?: string | null
          url: string
          url_hash: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          error?: string | null
          fetched_at?: string | null
          has_conversion_event?: boolean | null
          has_fb_pixel?: boolean | null
          id?: string
          primary_cta?: string | null
          source?: string
          title?: string | null
          url?: string
          url_hash?: string
          user_id?: string
        }
        Relationships: []
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
      money_tracker: {
        Row: {
          account_id: string
          active_days_streak: number | null
          capturable_now: number | null
          id: string
          last_active_date: string | null
          leaking_now: number | null
          longest_streak: number | null
          revenue_today: number | null
          saved_today: number | null
          total_actions_taken: number | null
          total_revenue_captured: number | null
          total_saved: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          active_days_streak?: number | null
          capturable_now?: number | null
          id?: string
          last_active_date?: string | null
          leaking_now?: number | null
          longest_streak?: number | null
          revenue_today?: number | null
          saved_today?: number | null
          total_actions_taken?: number | null
          total_revenue_captured?: number | null
          total_saved?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          active_days_streak?: number | null
          capturable_now?: number | null
          id?: string
          last_active_date?: string | null
          leaking_now?: number | null
          longest_streak?: number | null
          revenue_today?: number | null
          saved_today?: number | null
          total_actions_taken?: number | null
          total_revenue_captured?: number | null
          total_saved?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "money_tracker_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          account_id: string | null
          action_log_id: string | null
          body: string
          channel: string
          clicked_at: string | null
          created_at: string | null
          decision_id: string | null
          id: string
          notification_type: string
          read_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          action_log_id?: string | null
          body: string
          channel: string
          clicked_at?: string | null
          created_at?: string | null
          decision_id?: string | null
          id?: string
          notification_type: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          action_log_id?: string | null
          body?: string
          channel?: string
          clicked_at?: string | null
          created_at?: string | null
          decision_id?: string | null
          id?: string
          notification_type?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_action_log_id_fkey"
            columns: ["action_log_id"]
            isOneToOne: false
            referencedRelation: "action_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_action_log_id_fkey"
            columns: ["action_log_id"]
            isOneToOne: false
            referencedRelation: "pending_rollback_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
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
      pixel_health_cache: {
        Row: {
          active_ads_checked: number | null
          ad_account_id: string
          checked_at: string | null
          created_at: string | null
          error: string | null
          id: string
          last_fired_at: string | null
          message: string | null
          orphan_ads_count: number | null
          persona_id: string | null
          pixels: Json | null
          primary_pixel_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_ads_checked?: number | null
          ad_account_id: string
          checked_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          last_fired_at?: string | null
          message?: string | null
          orphan_ads_count?: number | null
          persona_id?: string | null
          pixels?: Json | null
          primary_pixel_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_ads_checked?: number | null
          ad_account_id?: string
          checked_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          last_fired_at?: string | null
          message?: string | null
          orphan_ads_count?: number | null
          persona_id?: string | null
          pixels?: Json | null
          primary_pixel_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
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
      processed_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cancel_feedback: string | null
          cancel_reason: string | null
          created_at: string
          current_period_end: string | null
          dashboard_count: number | null
          dashboard_reset_date: string | null
          email: string | null
          email_lifecycle_sent: Json | null
          health_risk_flagged: boolean | null
          health_score: number | null
          health_updated_at: string | null
          id: string
          last_ai_action_at: string | null
          last_login_at: string | null
          login_streak: number | null
          name: string | null
          onboarding_completed: boolean | null
          onboarding_data: Json | null
          pause_until: string | null
          plan: string
          plan_started_at: string | null
          preferred_language: string | null
          preferred_market: string | null
          referral_bonus_analyses: number | null
          referral_code: string | null
          referred_by: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          total_actions: number | null
          trial_end: string | null
          usage_alert_flags: Json | null
        }
        Insert: {
          avatar_url?: string | null
          cancel_feedback?: string | null
          cancel_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          dashboard_count?: number | null
          dashboard_reset_date?: string | null
          email?: string | null
          email_lifecycle_sent?: Json | null
          health_risk_flagged?: boolean | null
          health_score?: number | null
          health_updated_at?: string | null
          id: string
          last_ai_action_at?: string | null
          last_login_at?: string | null
          login_streak?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          pause_until?: string | null
          plan?: string
          plan_started_at?: string | null
          preferred_language?: string | null
          preferred_market?: string | null
          referral_bonus_analyses?: number | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          total_actions?: number | null
          trial_end?: string | null
          usage_alert_flags?: Json | null
        }
        Update: {
          avatar_url?: string | null
          cancel_feedback?: string | null
          cancel_reason?: string | null
          created_at?: string
          current_period_end?: string | null
          dashboard_count?: number | null
          dashboard_reset_date?: string | null
          email?: string | null
          email_lifecycle_sent?: Json | null
          health_risk_flagged?: boolean | null
          health_score?: number | null
          health_updated_at?: string | null
          id?: string
          last_ai_action_at?: string | null
          last_login_at?: string | null
          login_streak?: number | null
          name?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          pause_until?: string | null
          plan?: string
          plan_started_at?: string | null
          preferred_language?: string | null
          preferred_market?: string | null
          referral_bonus_analyses?: number | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          total_actions?: number | null
          trial_end?: string | null
          usage_alert_flags?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_balance_log: {
        Row: {
          balance_usd: number
          created_at: string
          id: number
          level: string
          provider: string
        }
        Insert: {
          balance_usd: number
          created_at?: string
          id?: number
          level: string
          provider: string
        }
        Update: {
          balance_usd?: number
          created_at?: string
          id?: number
          level?: string
          provider?: string
        }
        Relationships: []
      }
      referral_claims: {
        Row: {
          bonus_granted: number | null
          created_at: string | null
          id: string
          referee_id: string
          referrer_id: string
        }
        Insert: {
          bonus_granted?: number | null
          created_at?: string | null
          id?: string
          referee_id: string
          referrer_id: string
        }
        Update: {
          bonus_granted?: number | null
          created_at?: string | null
          id?: string
          referee_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_claims_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_claims_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      studio_runs: {
        Row: {
          angles: Json
          aspect_ratio: string
          brand_id: string | null
          count: number
          created_at: string | null
          finished_at: string | null
          id: string
          prompt: string
          results: Json
          status: string
          user_id: string
        }
        Insert: {
          angles?: Json
          aspect_ratio?: string
          brand_id?: string | null
          count: number
          created_at?: string | null
          finished_at?: string | null
          id?: string
          prompt: string
          results?: Json
          status?: string
          user_id: string
        }
        Update: {
          angles?: Json
          aspect_ratio?: string
          brand_id?: string | null
          count?: number
          created_at?: string | null
          finished_at?: string | null
          id?: string
          prompt?: string
          results?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_runs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "user_brands"
            referencedColumns: ["id"]
          },
        ]
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
      user_brands: {
        Row: {
          created_at: string | null
          id: string
          license: Json
          logo_url: string | null
          markets: string[] | null
          name: string
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          license?: Json
          logo_url?: string | null
          markets?: string[] | null
          name: string
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          license?: Json
          logo_url?: string | null
          markets?: string[] | null
          name?: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          bonus_credits: number
          created_at: string
          id: string
          period: string
          total_credits: number
          updated_at: string
          used_credits: number
          user_id: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          id?: string
          period: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          id?: string
          period?: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_settings: {
        Row: {
          alert_threshold_score: number | null
          auto_mode_enabled: boolean | null
          auto_mode_kill_threshold: number | null
          auto_mode_scale_threshold: number | null
          created_at: string | null
          currency_display: string | null
          email_notifications: boolean | null
          first_action_completed: boolean | null
          first_scan_completed: boolean | null
          id: string
          language: string | null
          onboarding_completed: boolean | null
          push_notifications: boolean | null
          sounds_enabled: boolean | null
          telegram_chat_id: string | null
          telegram_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_threshold_score?: number | null
          auto_mode_enabled?: boolean | null
          auto_mode_kill_threshold?: number | null
          auto_mode_scale_threshold?: number | null
          created_at?: string | null
          currency_display?: string | null
          email_notifications?: boolean | null
          first_action_completed?: boolean | null
          first_scan_completed?: boolean | null
          id?: string
          language?: string | null
          onboarding_completed?: boolean | null
          push_notifications?: boolean | null
          sounds_enabled?: boolean | null
          telegram_chat_id?: string | null
          telegram_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_threshold_score?: number | null
          auto_mode_enabled?: boolean | null
          auto_mode_kill_threshold?: number | null
          auto_mode_scale_threshold?: number | null
          created_at?: string | null
          currency_display?: string | null
          email_notifications?: boolean | null
          first_action_completed?: boolean | null
          first_scan_completed?: boolean | null
          id?: string
          language?: string | null
          onboarding_completed?: boolean | null
          push_notifications?: boolean | null
          sounds_enabled?: boolean | null
          telegram_chat_id?: string | null
          telegram_enabled?: boolean | null
          updated_at?: string | null
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
      ci_angles: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_ctas: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_dedup_stats: {
        Row: {
          ad_asset_links: number | null
          brand_id: string | null
          duplicates_avoided: number | null
          naive_bytes: number | null
          unique_assets: number | null
          unique_bytes: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_hooks: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_objections: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_offers: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_products: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_proofs: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_scenarios: {
        Row: {
          ad_count: number | null
          asset_count: number | null
          brand_id: string | null
          concept_count: number | null
          created_at: string | null
          description: string | null
          first_seen_at: string | null
          id: string | null
          is_demo: boolean | null
          label: string | null
          last_seen_at: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ad_count?: number | null
          asset_count?: number | null
          brand_id?: string | null
          concept_count?: number | null
          created_at?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string | null
          is_demo?: boolean | null
          label?: string | null
          last_seen_at?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_taxonomy_terms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_storage_usage: {
        Row: {
          brand_id: string | null
          category: string | null
          object_count: number | null
          total_bytes: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_storage_objects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ci_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_usage_overview: {
        Row: {
          bonus_credits: number | null
          email: string | null
          period: string | null
          plan: string | null
          remaining: number | null
          total_credits: number | null
          updated_at: string | null
          usage_pct: number | null
          used_credits: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_campaign_stats: {
        Row: {
          ainda_no_desconto: number | null
          code: string | null
          ja_no_preco_cheio: number | null
          label: string | null
          max_redemptions: number | null
          primeiro_resgate: string | null
          redeemed: number | null
          ultimo_resgate: string | null
        }
        Relationships: []
      }
      pending_rollback_checks: {
        Row: {
          account_id: string | null
          action_type: string | null
          executed_at: string | null
          id: string | null
          new_value: Json | null
          previous_value: Json | null
          rollback_roas_drop_pct: number | null
          rollback_window_hours: number | null
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      adbrief_cron_headers: { Args: never; Returns: Json }
      adbrief_invoke_function: {
        Args: { fn_name: string; payload?: string }
        Returns: undefined
      }
      adbrief_schedule_all_canonical: { Args: never; Returns: Json }
      adbrief_schedule_edge: {
        Args: { p_body?: string; p_cron: string; p_fn: string; p_name: string }
        Returns: undefined
      }
      adbrief_setup_cron: { Args: never; Returns: Json }
      add_bonus_credits: {
        Args: {
          p_credits: number
          p_reason?: string
          p_total_credits?: number
          p_user_id: string
        }
        Returns: Json
      }
      check_and_increment_ai_usage: {
        Args: { p_plan?: string; p_user_id: string }
        Returns: Json
      }
      ci_claim_job: {
        Args: { p_kind: string; p_lease_secs?: number; p_worker_id: string }
        Returns: Json[]
      }
      ci_compute_scale_signal: { Args: { p_brand_id: string }; Returns: number }
      ci_owns_brand: { Args: { p_brand_id: string }; Returns: boolean }
      ci_reap_stale_jobs: {
        Args: never
        Returns: {
          kind: string
          reaped: number
        }[]
      }
      ci_refresh_taxonomy_stats: {
        Args: { p_brand_id: string }
        Returns: number
      }
      cleanup_old_error_logs: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cockpit_dl_by_user: { Args: { days?: number }; Returns: Json }
      cockpit_dl_hit_rate_by_source: { Args: { days?: number }; Returns: Json }
      cockpit_dl_hit_rate_by_type: { Args: { days?: number }; Returns: Json }
      cockpit_dl_recent: { Args: { limit_rows?: number }; Returns: Json }
      cockpit_dl_totals: { Args: { days?: number }; Returns: Json }
      deduct_credits: {
        Args: {
          p_action: string
          p_bonus_credits?: number
          p_credits: number
          p_metadata?: Json
          p_total_credits: number
          p_user_id: string
        }
        Returns: Json
      }
      expire_stale_decisions: { Args: never; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      get_credit_balance: { Args: { p_user_id: string }; Returns: Json }
      hub_credit_balance: {
        Args: { p_user: string }
        Returns: {
          balance: number
          pack_credits: number
          plan_credits: number
          used: number
        }[]
      }
      hub_redeem_campaign: {
        Args: { p_code: string; p_currency: string; p_user: string }
        Returns: Json
      }
      hub_reserve_credits: {
        Args: { p_action: string; p_credits: number; p_user: string }
        Returns: Json
      }
      hub_sweep_stale_reservations: { Args: never; Returns: number }
      hub_validate_campaign: {
        Args: { p_code: string; p_user: string }
        Returns: Json
      }
      hub_validate_my_campaign: { Args: { p_code: string }; Returns: Json }
      hub_video_usage: {
        Args: { p_user: string }
        Returns: {
          day_count: number
          in_flight: number
          month_count: number
        }[]
      }
      increment_chat_usage: {
        Args: {
          p_daily_cap: number
          p_month_key: string
          p_today: string
          p_user_id: string
        }
        Returns: Json
      }
      increment_money_tracker: {
        Args: { p_account_id: string; p_amount: number; p_field: string }
        Returns: undefined
      }
      intelligence_health: {
        Args: { p_user_id: string }
        Returns: {
          metric: string
          section: string
          value: Json
        }[]
      }
      intelligence_health_json: { Args: { p_user_id: string }; Returns: Json }
      intelligence_health_summary: {
        Args: { p_user_id: string }
        Returns: string
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
    }
    Enums: {
      action_type_enum:
        | "pause_ad"
        | "enable_ad"
        | "pause_adset"
        | "enable_adset"
        | "pause_campaign"
        | "enable_campaign"
        | "budget_increase"
        | "budget_decrease"
        | "duplicate_ad"
        | "change_creative"
        | "change_audience"
      target_level_enum: "ad" | "adset" | "campaign"
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
      action_type_enum: [
        "pause_ad",
        "enable_ad",
        "pause_adset",
        "enable_adset",
        "pause_campaign",
        "enable_campaign",
        "budget_increase",
        "budget_decrease",
        "duplicate_ad",
        "change_creative",
        "change_audience",
      ],
      target_level_enum: ["ad", "adset", "campaign"],
    },
  },
} as const
