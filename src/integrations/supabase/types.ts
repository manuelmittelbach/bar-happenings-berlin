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
      bars: {
        Row: {
          address: string | null
          area: string | null
          created_at: string | null
          google_types: string | null
          id: string
          instagram: string | null
          latitude: number | null
          longitude: number | null
          name: string
          num_ratings: number | null
          opening_hours: string | null
          phone: string | null
          place_id: string | null
          rating: number | null
          source_type: string | null
          telegram: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          created_at?: string | null
          google_types?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          num_ratings?: number | null
          opening_hours?: string | null
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          source_type?: string | null
          telegram?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          created_at?: string | null
          google_types?: string | null
          id?: string
          instagram?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          num_ratings?: number | null
          opening_hours?: string | null
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          source_type?: string | null
          telegram?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          emoji: string
          enabled: boolean
          id: string
          label: string
        }
        Insert: {
          color: string
          emoji: string
          enabled?: boolean
          id: string
          label: string
        }
        Update: {
          color?: string
          emoji?: string
          enabled?: boolean
          id?: string
          label?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          address: string
          approved_at: string | null
          approved_by: string | null
          canceled_by: string | null
          category: string
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          doors_time: string | null
          editor_note: string | null
          end_time: string | null
          entry_info: string | null
          highlight_priority: number
          id: string
          image: string | null
          image_position: string
          interested_count: number | null
          is_highlight: boolean
          is_manual: boolean
          language: string | null
          neighborhood: string
          parent_id: string | null
          recurrence: string | null
          start_time: string | null
          status: string
          title: string
          url: string | null
          venue: string
          venue_id: string | null
        }
        Insert: {
          address: string
          approved_at?: string | null
          approved_by?: string | null
          canceled_by?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          doors_time?: string | null
          editor_note?: string | null
          end_time?: string | null
          entry_info?: string | null
          highlight_priority?: number
          id: string
          image?: string | null
          image_position?: string
          interested_count?: number | null
          is_highlight?: boolean
          is_manual?: boolean
          language?: string | null
          neighborhood: string
          parent_id?: string | null
          recurrence?: string | null
          start_time?: string | null
          status?: string
          title: string
          url?: string | null
          venue: string
          venue_id?: string | null
        }
        Update: {
          address?: string
          approved_at?: string | null
          approved_by?: string | null
          canceled_by?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          doors_time?: string | null
          editor_note?: string | null
          end_time?: string | null
          entry_info?: string | null
          highlight_priority?: number
          id?: string
          image?: string | null
          image_position?: string
          interested_count?: number | null
          is_highlight?: boolean
          is_manual?: boolean
          language?: string | null
          neighborhood?: string
          parent_id?: string | null
          recurrence?: string | null
          start_time?: string | null
          status?: string
          title?: string
          url?: string | null
          venue?: string
          venue_id?: string | null
        }
        Relationships: []
      }
      events_archive: {
        Row: {
          address: string
          approved_at: string | null
          approved_by: string | null
          archived_at: string
          canceled_by: string | null
          category: string
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          doors_time: string | null
          end_time: string | null
          entry_info: string | null
          id: string
          image: string | null
          image_position: string
          interested_count: number | null
          language: string | null
          neighborhood: string
          parent_id: string | null
          recurrence: string | null
          start_time: string
          status: string
          title: string
          url: string | null
          venue: string
          venue_id: string | null
        }
        Insert: {
          address: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string
          canceled_by?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          doors_time?: string | null
          end_time?: string | null
          entry_info?: string | null
          id: string
          image?: string | null
          image_position?: string
          interested_count?: number | null
          language?: string | null
          neighborhood: string
          parent_id?: string | null
          recurrence?: string | null
          start_time: string
          status?: string
          title: string
          url?: string | null
          venue: string
          venue_id?: string | null
        }
        Update: {
          address?: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string
          canceled_by?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          doors_time?: string | null
          end_time?: string | null
          entry_info?: string | null
          id?: string
          image?: string | null
          image_position?: string
          interested_count?: number | null
          language?: string | null
          neighborhood?: string
          parent_id?: string | null
          recurrence?: string | null
          start_time?: string
          status?: string
          title?: string
          url?: string | null
          venue?: string
          venue_id?: string | null
        }
        Relationships: []
      }
      pending_bar_submissions: {
        Row: {
          address: string
          created_at: string
          inside_image_position: string
          inside_image_url: string | null
          instagram: string | null
          lat: number | null
          lng: number | null
          name: string
          neighborhood: string
          phone: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address: string
          created_at?: string
          inside_image_position?: string
          inside_image_url?: string | null
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          neighborhood?: string
          phone?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          inside_image_position?: string
          inside_image_url?: string | null
          instagram?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          neighborhood?: string
          phone?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      pending_venue_claims: {
        Row: {
          created_at: string
          proposed_inside_image_position: string
          proposed_inside_image_url: string | null
          proposed_instagram: string | null
          proposed_phone: string | null
          proposed_website: string | null
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          proposed_inside_image_position?: string
          proposed_inside_image_url?: string | null
          proposed_instagram?: string | null
          proposed_phone?: string | null
          proposed_website?: string | null
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          proposed_inside_image_position?: string
          proposed_inside_image_url?: string | null
          proposed_instagram?: string | null
          proposed_phone?: string | null
          proposed_website?: string | null
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_venue_claims_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          email: string | null
          email_confirmed: boolean
          first_name: string
          id: string
          last_name: string
          role: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean
          first_name?: string
          id: string
          last_name?: string
          role?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed?: boolean
          first_name?: string
          id?: string
          last_name?: string
          role?: string
        }
        Relationships: []
      }
      scrape_logs: {
        Row: {
          error_message: string | null
          id: string
          scraped_at: string
          status: string
          venue_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          scraped_at?: string
          status: string
          venue_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          scraped_at?: string
          status?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_logs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      venue_events_staging: {
        Row: {
          category: string | null
          created_by_admin: boolean
          date: string | null
          description: string | null
          doors_time: string | null
          end_time: string | null
          entry_info: string | null
          id: string
          is_manual: boolean
          language: string | null
          recurrence: string
          recurrence_until: string | null
          replaces_event_id: string | null
          scraped_at: string
          source_url: string | null
          start_time: string | null
          title: string | null
          venue_id: string
        }
        Insert: {
          category?: string | null
          created_by_admin?: boolean
          date?: string | null
          description?: string | null
          doors_time?: string | null
          end_time?: string | null
          entry_info?: string | null
          id?: string
          is_manual?: boolean
          language?: string | null
          recurrence?: string
          recurrence_until?: string | null
          replaces_event_id?: string | null
          scraped_at?: string
          source_url?: string | null
          start_time?: string | null
          title?: string | null
          venue_id: string
        }
        Update: {
          category?: string | null
          created_by_admin?: boolean
          date?: string | null
          description?: string | null
          doors_time?: string | null
          end_time?: string | null
          entry_info?: string | null
          id?: string
          is_manual?: boolean
          language?: string | null
          recurrence?: string
          recurrence_until?: string | null
          replaces_event_id?: string | null
          scraped_at?: string
          source_url?: string | null
          start_time?: string | null
          title?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_events_staging_replaces_event_id_fkey"
            columns: ["replaces_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_events_staging_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_owners: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_owners_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          additional: string | null
          address: string
          description: string | null
          facebook: string | null
          id: string
          image: string | null
          image_position: string
          inserted_at: string | null
          inside_image_position: string
          inside_image_url: string | null
          instagram: string | null
          lat: number
          lng: number
          name: string
          neighborhood: string
          opening_hours: string | null
          phone: string | null
          scrape_enabled: boolean
          telegram: string | null
          updated_at: string | null
          website: string | null
          website_events: string | null
        }
        Insert: {
          additional?: string | null
          address: string
          description?: string | null
          facebook?: string | null
          id?: string
          image?: string | null
          image_position?: string
          inserted_at?: string | null
          inside_image_position?: string
          inside_image_url?: string | null
          instagram?: string | null
          lat: number
          lng: number
          name: string
          neighborhood: string
          opening_hours?: string | null
          phone?: string | null
          scrape_enabled?: boolean
          telegram?: string | null
          updated_at?: string | null
          website?: string | null
          website_events?: string | null
        }
        Update: {
          additional?: string | null
          address?: string
          description?: string | null
          facebook?: string | null
          id?: string
          image?: string | null
          image_position?: string
          inserted_at?: string | null
          inside_image_position?: string
          inside_image_url?: string | null
          instagram?: string | null
          lat?: number
          lng?: number
          name?: string
          neighborhood?: string
          opening_hours?: string | null
          phone?: string | null
          scrape_enabled?: boolean
          telegram?: string | null
          updated_at?: string | null
          website?: string | null
          website_events?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_past_events: { Args: never; Returns: number }
      cleanup_past_staged_events: { Args: never; Returns: number }
      cleanup_unconfirmed_signups: { Args: never; Returns: number }
      extend_recurring_series: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      truncate_staging: { Args: never; Returns: undefined }
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
