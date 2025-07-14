import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types for TypeScript
export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          id: string
          white_player_id: string | null
          black_player_id: string | null
          fen: string
          pgn: string | null
          status: string
          winner: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          white_player_id?: string | null
          black_player_id?: string | null
          fen?: string
          pgn?: string | null
          status?: string
          winner?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          white_player_id?: string | null
          black_player_id?: string | null
          fen?: string
          pgn?: string | null
          status?: string
          winner?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      moves: {
        Row: {
          id: string
          game_id: string
          move_number: number
          san: string
          fen_after: string
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          move_number: number
          san: string
          fen_after: string
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          move_number?: number
          san?: string
          fen_after?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
