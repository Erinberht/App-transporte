export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      buses: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          route_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          route_id: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          route_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'buses_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
        ];
      };
      dataset_meta: {
        Row: {
          description: string;
          generated_at: string;
          id: boolean;
          kind: string;
          loaded_at: string;
          schema_version: number;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          generated_at: string;
          id?: boolean;
          kind: string;
          loaded_at?: string;
          schema_version?: number;
        };
        Update: {
          description?: string;
          generated_at?: string;
          id?: boolean;
          kind?: string;
          loaded_at?: string;
          schema_version?: number;
        };
        Relationships: [];
      };
      occupancy_reports: {
        Row: {
          id: number;
          level: Database['public']['Enums']['occupancy_level'];
          reported_at: string;
          route_id: string;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          level: Database['public']['Enums']['occupancy_level'];
          reported_at?: string;
          route_id: string;
          trip_id: string;
        };
        Update: {
          id?: never;
          level?: Database['public']['Enums']['occupancy_level'];
          reported_at?: string;
          route_id?: string;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'occupancy_reports_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'occupancy_reports_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'shared_trips';
            referencedColumns: ['id'];
          },
        ];
      };
      pattern_stops: {
        Row: {
          minutes_from_start: number;
          pattern_id: string;
          sequence: number;
          stop_id: string;
        };
        ComputedFields: never;
        Insert: {
          minutes_from_start: number;
          pattern_id: string;
          sequence: number;
          stop_id: string;
        };
        Update: {
          minutes_from_start?: number;
          pattern_id?: string;
          sequence?: number;
          stop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pattern_stops_pattern_id_fkey';
            columns: ['pattern_id'];
            isOneToOne: false;
            referencedRelation: 'route_patterns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pattern_stops_stop_id_fkey';
            columns: ['stop_id'];
            isOneToOne: false;
            referencedRelation: 'stops';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          location_consent_at: string | null;
          model_consent_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          location_consent_at?: string | null;
          model_consent_at?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          location_consent_at?: string | null;
          model_consent_at?: string | null;
        };
        Relationships: [];
      };
      route_patterns: {
        Row: {
          direction: number;
          headsign: string;
          id: string;
          quality: Database['public']['Enums']['data_quality'];
          route_id: string;
          shape: unknown;
        };
        ComputedFields: never;
        Insert: {
          direction: number;
          headsign: string;
          id: string;
          quality: Database['public']['Enums']['data_quality'];
          route_id: string;
          shape: unknown;
        };
        Update: {
          direction?: number;
          headsign?: string;
          id?: string;
          quality?: Database['public']['Enums']['data_quality'];
          route_id?: string;
          shape?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: 'route_patterns_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
        ];
      };
      routes: {
        Row: {
          color: string;
          id: string;
          long_name: string;
          operator: string;
          short_name: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          color: string;
          id: string;
          long_name: string;
          operator?: string;
          short_name: string;
          sort_order?: number;
        };
        Update: {
          color?: string;
          id?: string;
          long_name?: string;
          operator?: string;
          short_name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      service_headways: {
        Row: {
          days: Database['public']['Enums']['day_type'];
          end_time: string;
          every_minutes: number;
          quality: Database['public']['Enums']['data_quality'];
          route_id: string;
          start_time: string;
        };
        ComputedFields: never;
        Insert: {
          days: Database['public']['Enums']['day_type'];
          end_time: string;
          every_minutes: number;
          quality: Database['public']['Enums']['data_quality'];
          route_id: string;
          start_time: string;
        };
        Update: {
          days?: Database['public']['Enums']['day_type'];
          end_time?: string;
          every_minutes?: number;
          quality?: Database['public']['Enums']['data_quality'];
          route_id?: string;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_headways_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
        ];
      };
      shared_trips: {
        Row: {
          bus_id: string | null;
          ended_at: string | null;
          ended_reason: Database['public']['Enums']['trip_end_reason'] | null;
          id: string;
          route_id: string;
          started_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          bus_id?: string | null;
          ended_at?: string | null;
          ended_reason?: Database['public']['Enums']['trip_end_reason'] | null;
          id?: string;
          route_id: string;
          started_at?: string;
          user_id?: string;
        };
        Update: {
          bus_id?: string | null;
          ended_at?: string | null;
          ended_reason?: Database['public']['Enums']['trip_end_reason'] | null;
          id?: string;
          route_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shared_trips_bus_id_fkey';
            columns: ['bus_id'];
            isOneToOne: false;
            referencedRelation: 'buses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shared_trips_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
        ];
      };
      stops: {
        Row: {
          id: string;
          location: unknown;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          location: unknown;
          name: string;
        };
        Update: {
          id?: string;
          location?: unknown;
          name?: string;
        };
        Relationships: [];
      };
      trip_positions: {
        Row: {
          accuracy_m: number | null;
          created_at: string;
          id: number;
          location: unknown;
          recorded_at: string;
          speed_mps: number | null;
          trip_id: string;
        };
        ComputedFields: never;
        Insert: {
          accuracy_m?: number | null;
          created_at?: string;
          id?: never;
          location: unknown;
          recorded_at: string;
          speed_mps?: number | null;
          trip_id: string;
        };
        Update: {
          accuracy_m?: number | null;
          created_at?: string;
          id?: never;
          location?: unknown;
          recorded_at?: string;
          speed_mps?: number | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_positions_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'shared_trips';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      close_stale_trips: { Args: Record<PropertyKey, never>; Returns: number };
      delete_my_data: { Args: Record<PropertyKey, never>; Returns: undefined };
      get_transit_dataset: { Args: Record<PropertyKey, never>; Returns: Json };
      in_monteria: { Args: { g: unknown }; Returns: boolean };
      live_bus_clusters: {
        Args: { p_route_id: string };
        Returns: {
          cluster_id: number;
          location: unknown;
          recorded_at: string;
        }[];
      };
      purge_expired_data: { Args: Record<PropertyKey, never>; Returns: undefined };
      route_live_buses: {
        Args: { p_route_id: string };
        Returns: {
          latitude: number;
          longitude: number;
          position_at: string;
          travelers: number;
        }[];
      };
      route_live_status: {
        Args: { p_route_id: string };
        Returns: {
          active_trips: number;
          latitude: number;
          longitude: number;
          occupancy: Database['public']['Enums']['occupancy_level'];
          occupancy_at: string;
          occupancy_reports: number;
          position_at: string;
        }[];
      };
    };
    Enums: {
      data_quality: 'ficticio' | 'aproximado' | 'verificado';
      day_type: 'weekday' | 'saturday' | 'sunday_holiday';
      occupancy_level: 'full' | 'medium' | 'empty';
      trip_end_reason: 'user' | 'auto_alighted' | 'timeout';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      data_quality: ['ficticio', 'aproximado', 'verificado'],
      day_type: ['weekday', 'saturday', 'sunday_holiday'],
      occupancy_level: ['full', 'medium', 'empty'],
      trip_end_reason: ['user', 'auto_alighted', 'timeout'],
    },
  },
} as const;
