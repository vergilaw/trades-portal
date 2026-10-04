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
      sepay_connections: {
        Row: import("@/lib/payments/types").SePayConnection;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      sepay_connection_secrets: {
        Row: { connection_id: string; encrypted_secret: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      sepay_connection_accounts: {
        Row: { connection_id: string; bank_account_id: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      sepay_transactions: {
        Row: import("@/lib/payments/types").SePayTransaction;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payment_banks: {
        Row: { bin: string; name: string };
        Insert: { bin: string; name: string };
        Update: { name?: string };
        Relationships: [];
      };
      bank_accounts: {
        Row: import("@/lib/payments/types").BankAccount;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payment_requests: {
        Row: import("@/lib/payments/types").PaymentRequest;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payment_events: {
        Row: import("@/lib/payments/types").PaymentEvent;
        Insert: never;
        Update: never;
        Relationships: [];
      };
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
      configure_sepay_connection: {
        Args: {
          p_owner_id: string;
          p_id: string;
          p_secret: string;
          p_account_ids: string[];
        };
        Returns: undefined;
      };
      disconnect_sepay_connection: {
        Args: { p_owner_id: string };
        Returns: undefined;
      };
      reconcile_sepay_transaction: {
        Args: import("@/lib/payments/sepay-webhook").ReconciliationInput;
        Returns: string;
      };
      save_bank_account: {
        Args: { p_bin: string; p_number: string; p_holder: string };
        Returns: string;
      };
      set_bank_account_active: {
        Args: { p_id: string; p_active: boolean };
        Returns: undefined;
      };
      create_quote_payment: {
        Args: { p_quote_id: string; p_account_id: string };
        Returns: string;
      };
      change_quote_payment: {
        Args: {
          p_payment_id: string;
          p_status: string;
          p_note?: string | null;
        };
        Returns: undefined;
      };
      report_portal_payment: {
        Args: { p_token: string; p_payment_id: string };
        Returns: undefined;
      };
      get_portal_payment: {
        Args: { p_token: string };
        Returns: Json;
      };
      get_portal_quote: {
        Args: { p_token: string };
        Returns: Json;
      };
      respond_to_portal_quote: {
        Args: { p_token: string; p_decision: "approved" | "rejected" };
        Returns: { status: QuoteStatus; responded_at: string }[];
      };
      update_quote_with_items: {
        Args: {
          p_quote_id: string;
          p_title: string;
          p_customer_name: string;
          p_customer_email: string | null;
          p_customer_phone: string | null;
          p_notes: string | null;
          p_tax_rate: number;
          p_expires_at: string | null;
          p_items: Json;
        };
        Returns: { quote_id: string; quote_token: string }[];
      };
      duplicate_quote: {
        Args: { p_quote_id: string };
        Returns: { quote_id: string; quote_token: string }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
