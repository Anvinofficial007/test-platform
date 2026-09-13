// Hand-written to match supabase/schema.sql.
// Once your project exists, you can replace this with generated types:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          register_number: string;
          email: string | null;
          role: "student" | "admin";
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          register_number: string;
          email?: string | null;
          role?: "student" | "admin";
        };
        Update: Partial<{
          id: string;
          name: string;
          register_number: string;
          email: string | null;
          role: "student" | "admin";
        }>;
        Relationships: [];
      };
      tests: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          duration_minutes: number;
          start_time: string;
          end_time: string;
          total_marks: number;
          status: "draft" | "published" | "closed";
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          duration_minutes: number;
          start_time: string;
          end_time: string;
          total_marks?: number;
          status?: "draft" | "published" | "closed";
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          title: string;
          description: string | null;
          duration_minutes: number;
          start_time: string;
          end_time: string;
          total_marks: number;
          status: "draft" | "published" | "closed";
          created_at: string;
        }>;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          test_id: string;
          question_text: string;
          question_image_url: string | null;
          option_a_text: string;
          option_a_image_url: string | null;
          option_b_text: string;
          option_b_image_url: string | null;
          option_c_text: string;
          option_c_image_url: string | null;
          option_d_text: string;
          option_d_image_url: string | null;
          correct_answer: "A" | "B" | "C" | "D";
          marks: number;
          negative_marks: number;
          order_index: number;
        };
        Insert: {
          id?: string;
          test_id: string;
          question_text: string;
          question_image_url?: string | null;
          option_a_text: string;
          option_a_image_url?: string | null;
          option_b_text: string;
          option_b_image_url?: string | null;
          option_c_text: string;
          option_c_image_url?: string | null;
          option_d_text: string;
          option_d_image_url?: string | null;
          correct_answer: "A" | "B" | "C" | "D";
          marks?: number;
          negative_marks?: number;
          order_index?: number;
        };
        Update: Partial<{
          id: string;
          test_id: string;
          question_text: string;
          question_image_url: string | null;
          option_a_text: string;
          option_a_image_url: string | null;
          option_b_text: string;
          option_b_image_url: string | null;
          option_c_text: string;
          option_c_image_url: string | null;
          option_d_text: string;
          option_d_image_url: string | null;
          correct_answer: "A" | "B" | "C" | "D";
          marks: number;
          negative_marks: number;
          order_index: number;
        }>;
        Relationships: [];
      };
      attempts: {
        Row: {
          id: string;
          test_id: string;
          user_id: string;
          started_at: string;
          submitted_at: string | null;
          score: number | null;
          status: "in_progress" | "submitted" | "expired" | "disqualified";
        };
        Insert: {
          id?: string;
          test_id: string;
          user_id: string;
          started_at?: string;
          submitted_at?: string | null;
          score?: number | null;
          status?: "in_progress" | "submitted" | "expired" | "disqualified";
        };
        Update: Partial<{
          id: string;
          test_id: string;
          user_id: string;
          started_at: string;
          submitted_at: string | null;
          score: number | null;
          status: "in_progress" | "submitted" | "expired" | "disqualified";
        }>;
        Relationships: [];
      };
      answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_answer: "A" | "B" | "C" | "D" | null;
          is_correct: boolean | null;
          marks_awarded: number | null;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected_answer?: "A" | "B" | "C" | "D" | null;
          is_correct?: boolean | null;
          marks_awarded?: number | null;
        };
        Update: Partial<{
          id: string;
          attempt_id: string;
          question_id: string;
          selected_answer: "A" | "B" | "C" | "D" | null;
          is_correct: boolean | null;
          marks_awarded: number | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
