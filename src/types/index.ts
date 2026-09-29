/** JSON values returned by Supabase RPC functions. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type QuoteStatus = "draft" | "sent" | "approved" | "rejected";
export type QuotePhotoPhase = "before" | "after";

/**
 * Keep this in sync with supabase/migrations/20260928000000_initial_schema.sql.
 * Replace it with `supabase gen types typescript` once a remote project is linked.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          business_name: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          business_name?: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          business_name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          contractor_id: string;
          public_token: string;
          title: string;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string | null;
          currency: string;
          notes: string | null;
          status: QuoteStatus;
          tax_rate: number;
          subtotal: number;
          tax_amount: number;
          total: number;
          expires_at: string | null;
          responded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contractor_id: string;
          public_token?: string;
          title: string;
          customer_name: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          currency?: string;
          notes?: string | null;
          status?: QuoteStatus;
          tax_rate?: number;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          expires_at?: string | null;
          responded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          currency?: string;
          notes?: string | null;
          status?: QuoteStatus;
          tax_rate?: number;
          subtotal?: number;
          tax_amount?: number;
          total?: number;
          expires_at?: string | null;
          responded_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_contractor_id_fkey";
            columns: ["contractor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          description: string;
          quantity?: number;
          unit_price: number;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          description?: string;
          quantity?: number;
          unit_price?: number;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_photos: {
        Row: {
          id: string;
          quote_id: string;
          storage_path: string;
          phase: QuotePhotoPhase;
          mime_type: "image/jpeg" | "image/png" | "image/webp";
          size_bytes: number;
          width: number;
          height: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          storage_path: string;
          phase: QuotePhotoPhase;
          mime_type: "image/jpeg" | "image/png" | "image/webp";
          size_bytes: number;
          width: number;
          height: number;
          position?: number;
          created_at?: string;
        };
        Update: {
          phase?: QuotePhotoPhase;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quote_photos_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      get_portal_quote: {
        Args: { p_token: string };
        Returns: Json;
      };
      respond_to_portal_quote: {
        Args: { p_token: string; p_decision: "approved" | "rejected" };
        Returns: { status: QuoteStatus; responded_at: string }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
