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
      admin_user_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          admin_note: string | null
          category: Database["public"]["Enums"]["card_category"] | null
          conversion_points: number
          created_at: string
          gacha_id: string | null
          id: string
          image_url: string | null
          name: string
          prize_tier: Database["public"]["Enums"]["prize_tier"]
          rarity: Database["public"]["Enums"]["card_rarity"]
          tenant_id: string | null
        }
        Insert: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["card_category"] | null
          conversion_points?: number
          created_at?: string
          gacha_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          prize_tier?: Database["public"]["Enums"]["prize_tier"]
          rarity?: Database["public"]["Enums"]["card_rarity"]
          tenant_id?: string | null
        }
        Update: {
          admin_note?: string | null
          category?: Database["public"]["Enums"]["card_category"] | null
          conversion_points?: number
          created_at?: string
          gacha_id?: string | null
          id?: string
          image_url?: string | null
          name?: string
          prize_tier?: Database["public"]["Enums"]["prize_tier"]
          rarity?: Database["public"]["Enums"]["card_rarity"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_gacha_id_fkey"
            columns: ["gacha_id"]
            isOneToOne: false
            referencedRelation: "gacha_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_analytics: {
        Row: {
          created_at: string | null
          date: string
          id: string
          legacy_id: number | null
          payment_amount: number | null
          points_used: number | null
          profit: number | null
          status: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          legacy_id?: number | null
          payment_amount?: number | null
          points_used?: number | null
          profit?: number | null
          status?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          legacy_id?: number | null
          payment_amount?: number | null
          points_used?: number | null
          profit?: number | null
          status?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_analytics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_animation_patterns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_animation_patterns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_animation_videos: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          gacha_id: string | null
          id: string
          pattern_id: string | null
          prize_tier: string
          tenant_id: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          gacha_id?: string | null
          id?: string
          pattern_id?: string | null
          prize_tier: string
          tenant_id?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          gacha_id?: string | null
          id?: string
          pattern_id?: string | null
          prize_tier?: string
          tenant_id?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_animation_videos_gacha_id_fkey"
            columns: ["gacha_id"]
            isOneToOne: false
            referencedRelation: "gacha_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_animation_videos_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "gacha_animation_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_animation_videos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_masters: {
        Row: {
          animation_pattern_id: string | null
          animation_type: string
          banner_url: string | null
          category: Database["public"]["Enums"]["card_category"] | null
          created_at: string
          display_tags: string[] | null
          fake_s_tier_chance: number
          id: string
          notice_text: string | null
          pop_image_url: string | null
          price_per_play: number
          remaining_slots: number
          status: Database["public"]["Enums"]["gacha_status"]
          tenant_id: string | null
          title: string
          total_slots: number
          updated_at: string
        }
        Insert: {
          animation_pattern_id?: string | null
          animation_type?: string
          banner_url?: string | null
          category?: Database["public"]["Enums"]["card_category"] | null
          created_at?: string
          display_tags?: string[] | null
          fake_s_tier_chance?: number
          id?: string
          notice_text?: string | null
          pop_image_url?: string | null
          price_per_play?: number
          remaining_slots?: number
          status?: Database["public"]["Enums"]["gacha_status"]
          tenant_id?: string | null
          title: string
          total_slots?: number
          updated_at?: string
        }
        Update: {
          animation_pattern_id?: string | null
          animation_type?: string
          banner_url?: string | null
          category?: Database["public"]["Enums"]["card_category"] | null
          created_at?: string
          display_tags?: string[] | null
          fake_s_tier_chance?: number
          id?: string
          notice_text?: string | null
          pop_image_url?: string | null
          price_per_play?: number
          remaining_slots?: number
          status?: Database["public"]["Enums"]["gacha_status"]
          tenant_id?: string | null
          title?: string
          total_slots?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_masters_animation_pattern_id_fkey"
            columns: ["animation_pattern_id"]
            isOneToOne: false
            referencedRelation: "gacha_animation_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_masters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_slots: {
        Row: {
          card_id: string | null
          created_at: string
          drawn_at: string | null
          gacha_id: string
          id: string
          is_drawn: boolean
          selection_deadline: string | null
          slot_number: number
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          drawn_at?: string | null
          gacha_id: string
          id?: string
          is_drawn?: boolean
          selection_deadline?: string | null
          slot_number: number
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          created_at?: string
          drawn_at?: string | null
          gacha_id?: string
          id?: string
          is_drawn?: boolean
          selection_deadline?: string | null
          slot_number?: number
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gacha_slots_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_slots_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_slots_gacha_id_fkey"
            columns: ["gacha_id"]
            isOneToOne: false
            referencedRelation: "gacha_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gacha_slots_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "user_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_banners: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_banners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type"]
          card_id: string | null
          converted_points: number | null
          id: string
          processed_at: string | null
          requested_at: string
          slot_id: string | null
          status: Database["public"]["Enums"]["action_status"]
          tenant_id: string | null
          tracking_number: string | null
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["action_type"]
          card_id?: string | null
          converted_points?: number | null
          id?: string
          processed_at?: string | null
          requested_at?: string
          slot_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tenant_id?: string | null
          tracking_number?: string | null
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["action_type"]
          card_id?: string | null
          converted_points?: number | null
          id?: string
          processed_at?: string | null
          requested_at?: string
          slot_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tenant_id?: string | null
          tracking_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_actions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_actions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_actions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "gacha_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string
          points_added: number
          status: string
          stripe_payment_id: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method?: string
          points_added: number
          status?: string
          stripe_payment_id?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string
          points_added?: number
          status?: string
          stripe_payment_id?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          allow_dm: boolean | null
          city: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          first_name_kana: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          last_name_kana: string | null
          phone_number: string | null
          points_balance: number
          postal_code: string | null
          prefecture: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          allow_dm?: boolean | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          first_name_kana?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          last_name_kana?: string | null
          phone_number?: string | null
          points_balance?: number
          postal_code?: string | null
          prefecture?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          allow_dm?: boolean | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          first_name_kana?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          last_name_kana?: string | null
          phone_number?: string | null
          points_balance?: number
          postal_code?: string | null
          prefecture?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          is_paid: boolean | null
          status: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          is_paid?: boolean | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          is_paid?: boolean | null
          status?: Database["public"]["Enums"]["ticket_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          allowed_ips: string[] | null
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          allowed_ips?: string[] | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          allowed_ips?: string[] | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_migrations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string | null
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          is_applied: boolean | null
          last_name: string | null
          legacy_user_id: number | null
          phone_number: string | null
          points_balance: number | null
          postal_code: string | null
          prefecture: string | null
          tenant_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_applied?: boolean | null
          last_name?: string | null
          legacy_user_id?: number | null
          phone_number?: string | null
          points_balance?: number | null
          postal_code?: string | null
          prefecture?: string | null
          tenant_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_applied?: boolean | null
          last_name?: string | null
          legacy_user_id?: number | null
          phone_number?: string | null
          points_balance?: number | null
          postal_code?: string | null
          prefecture?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_migrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_transactions: {
        Row: {
          created_at: string
          gacha_id: string | null
          id: string
          play_count: number
          result_items: Json
          status: Database["public"]["Enums"]["transaction_status"]
          tenant_id: string | null
          total_spent_points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          gacha_id?: string | null
          id?: string
          play_count?: number
          result_items?: Json
          status?: Database["public"]["Enums"]["transaction_status"]
          tenant_id?: string | null
          total_spent_points?: number
          user_id: string
        }
        Update: {
          created_at?: string
          gacha_id?: string | null
          id?: string
          play_count?: number
          result_items?: Json
          status?: Database["public"]["Enums"]["transaction_status"]
          tenant_id?: string | null
          total_spent_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_transactions_gacha_id_fkey"
            columns: ["gacha_id"]
            isOneToOne: false
            referencedRelation: "gacha_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cards_public: {
        Row: {
          conversion_points: number | null
          created_at: string | null
          gacha_id: string | null
          id: string | null
          image_url: string | null
          name: string | null
          prize_tier: Database["public"]["Enums"]["prize_tier"] | null
          rarity: Database["public"]["Enums"]["card_rarity"] | null
        }
        Insert: {
          conversion_points?: number | null
          created_at?: string | null
          gacha_id?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          prize_tier?: Database["public"]["Enums"]["prize_tier"] | null
          rarity?: Database["public"]["Enums"]["card_rarity"] | null
        }
        Update: {
          conversion_points?: number | null
          created_at?: string | null
          gacha_id?: string | null
          id?: string | null
          image_url?: string | null
          name?: string | null
          prize_tier?: Database["public"]["Enums"]["prize_tier"] | null
          rarity?: Database["public"]["Enums"]["card_rarity"] | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_gacha_id_fkey"
            columns: ["gacha_id"]
            isOneToOne: false
            referencedRelation: "gacha_masters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_tenant_profile: {
        Args: {
          p_display_name?: string
          p_email?: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: string
      }
      get_user_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      play_gacha_atomic: {
        Args: { p_gacha_id: string; p_play_count: number; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      action_status: "pending" | "processing" | "completed" | "shipped"
      action_type: "shipping" | "conversion"
      app_role: "admin" | "user" | "super_admin"
      card_category: "yugioh" | "pokemon" | "weiss" | "onepiece"
      card_rarity: "S" | "A" | "B" | "C" | "D"
      gacha_status: "draft" | "active" | "sold_out" | "archived"
      prize_tier: "S" | "A" | "B" | "miss"
      ticket_status: "pending" | "in_progress" | "completed" | "cancelled"
      transaction_status: "pending" | "completed" | "error"
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
      action_status: ["pending", "processing", "completed", "shipped"],
      action_type: ["shipping", "conversion"],
      app_role: ["admin", "user", "super_admin"],
      card_category: ["yugioh", "pokemon", "weiss", "onepiece"],
      card_rarity: ["S", "A", "B", "C", "D"],
      gacha_status: ["draft", "active", "sold_out", "archived"],
      prize_tier: ["S", "A", "B", "miss"],
      ticket_status: ["pending", "in_progress", "completed", "cancelled"],
      transaction_status: ["pending", "completed", "error"],
    },
  },
} as const
