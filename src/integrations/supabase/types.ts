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
      consultation_requests: {
        Row: {
          call_ended_at: string | null
          call_started_at: string | null
          created_at: string
          daily_room_name: string | null
          doctor_id: string
          doctor_notes: string | null
          fee_agreed: number | null
          id: string
          meeting_link: string | null
          patient_id: string
          patient_summary: string | null
          preferred_date: string | null
          preferred_time: string | null
          reason: string
          recording_status: string | null
          recording_url: string | null
          request_type: string | null
          requesting_hospital_id: string
          specialty_needed: string | null
          status: string | null
          updated_at: string
          urgency: string | null
          video_provider: string | null
        }
        Insert: {
          call_ended_at?: string | null
          call_started_at?: string | null
          created_at?: string
          daily_room_name?: string | null
          doctor_id: string
          doctor_notes?: string | null
          fee_agreed?: number | null
          id?: string
          meeting_link?: string | null
          patient_id: string
          patient_summary?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          reason: string
          recording_status?: string | null
          recording_url?: string | null
          request_type?: string | null
          requesting_hospital_id: string
          specialty_needed?: string | null
          status?: string | null
          updated_at?: string
          urgency?: string | null
          video_provider?: string | null
        }
        Update: {
          call_ended_at?: string | null
          call_started_at?: string | null
          created_at?: string
          daily_room_name?: string | null
          doctor_id?: string
          doctor_notes?: string | null
          fee_agreed?: number | null
          id?: string
          meeting_link?: string | null
          patient_id?: string
          patient_summary?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          reason?: string
          recording_status?: string | null
          recording_url?: string | null
          request_type?: string | null
          requesting_hospital_id?: string
          specialty_needed?: string | null
          status?: string | null
          updated_at?: string
          urgency?: string | null
          video_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_requesting_hospital_id_fkey"
            columns: ["requesting_hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      doctor_availability: {
        Row: {
          accepts_in_person: boolean
          accepts_virtual: boolean
          created_at: string
          day_of_week: number
          doctor_id: string
          end_time: string
          hospital_id: string | null
          id: string
          is_available: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          accepts_in_person?: boolean
          accepts_virtual?: boolean
          created_at?: string
          day_of_week: number
          doctor_id: string
          end_time?: string
          hospital_id?: string | null
          id?: string
          is_available?: boolean
          start_time?: string
          updated_at?: string
        }
        Update: {
          accepts_in_person?: boolean
          accepts_virtual?: boolean
          created_at?: string
          day_of_week?: number
          doctor_id?: string
          end_time?: string
          hospital_id?: string | null
          id?: string
          is_available?: boolean
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctor_marketplace: {
        Row: {
          bio_for_marketplace: string | null
          created_at: string
          doctor_id: string
          external_consultation_fee: number | null
          external_virtual_fee: number | null
          home_hospital_id: string | null
          id: string
          is_available_for_external: boolean | null
          max_external_hours_per_week: number | null
          specialties_offered: Json | null
          updated_at: string
        }
        Insert: {
          bio_for_marketplace?: string | null
          created_at?: string
          doctor_id: string
          external_consultation_fee?: number | null
          external_virtual_fee?: number | null
          home_hospital_id?: string | null
          id?: string
          is_available_for_external?: boolean | null
          max_external_hours_per_week?: number | null
          specialties_offered?: Json | null
          updated_at?: string
        }
        Update: {
          bio_for_marketplace?: string | null
          created_at?: string
          doctor_id?: string
          external_consultation_fee?: number | null
          external_virtual_fee?: number | null
          home_hospital_id?: string | null
          id?: string
          is_available_for_external?: boolean | null
          max_external_hours_per_week?: number | null
          specialties_offered?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_marketplace_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: true
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_marketplace_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: true
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_marketplace_home_hospital_id_fkey"
            columns: ["home_hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_settings: {
        Row: {
          accepts_virtual_global: boolean
          availability_mode: string
          created_at: string
          doctor_id: string
          is_currently_available: boolean
          language: string | null
          notification_prefs: Json
          timezone: string | null
          updated_at: string
          virtual_consultation_fee: number | null
        }
        Insert: {
          accepts_virtual_global?: boolean
          availability_mode?: string
          created_at?: string
          doctor_id: string
          is_currently_available?: boolean
          language?: string | null
          notification_prefs?: Json
          timezone?: string | null
          updated_at?: string
          virtual_consultation_fee?: number | null
        }
        Update: {
          accepts_virtual_global?: boolean
          availability_mode?: string
          created_at?: string
          doctor_id?: string
          is_currently_available?: boolean
          language?: string | null
          notification_prefs?: Json
          timezone?: string | null
          updated_at?: string
          virtual_consultation_fee?: number | null
        }
        Relationships: []
      }
      doctors: {
        Row: {
          bio: string | null
          created_at: string
          credential_documents: Json | null
          current_practice: Json | null
          email: string | null
          first_name: string
          id: string
          is_available: boolean | null
          last_name: string
          license_council: string | null
          license_expiry: string | null
          license_number: string | null
          phone: string | null
          profile_image_url: string | null
          rating: number | null
          reference_contact: Json | null
          specialty: string | null
          updated_at: string
          user_id: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_status: string
          verification_submitted_at: string | null
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          credential_documents?: Json | null
          current_practice?: Json | null
          email?: string | null
          first_name: string
          id?: string
          is_available?: boolean | null
          last_name: string
          license_council?: string | null
          license_expiry?: string | null
          license_number?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          reference_contact?: Json | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          credential_documents?: Json | null
          current_practice?: Json | null
          email?: string | null
          first_name?: string
          id?: string
          is_available?: boolean | null
          last_name?: string
          license_council?: string | null
          license_expiry?: string | null
          license_number?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          reference_contact?: Json | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      emr_entries: {
        Row: {
          attachments: Json | null
          checkin_id: string | null
          content: string | null
          created_at: string
          doctor_id: string | null
          entry_type: string
          hospital_id: string
          id: string
          is_confidential: boolean | null
          patient_id: string
          structured_data: Json | null
          title: string
          updated_at: string
          vital_data: Json | null
        }
        Insert: {
          attachments?: Json | null
          checkin_id?: string | null
          content?: string | null
          created_at?: string
          doctor_id?: string | null
          entry_type: string
          hospital_id: string
          id?: string
          is_confidential?: boolean | null
          patient_id: string
          structured_data?: Json | null
          title: string
          updated_at?: string
          vital_data?: Json | null
        }
        Update: {
          attachments?: Json | null
          checkin_id?: string | null
          content?: string | null
          created_at?: string
          doctor_id?: string | null
          entry_type?: string
          hospital_id?: string
          id?: string
          is_confidential?: boolean | null
          patient_id?: string
          structured_data?: Json | null
          title?: string
          updated_at?: string
          vital_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "emr_entries_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "patient_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emr_entries_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emr_entries_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emr_entries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emr_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_beds: {
        Row: {
          assigned_at: string | null
          bed_number: string
          bed_type: string
          created_at: string
          daily_rate: number | null
          discharged_at: string | null
          hospital_id: string
          id: string
          notes: string | null
          patient_id: string | null
          status: string
          updated_at: string
          ward_id: string
        }
        Insert: {
          assigned_at?: string | null
          bed_number: string
          bed_type?: string
          created_at?: string
          daily_rate?: number | null
          discharged_at?: string | null
          hospital_id: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          status?: string
          updated_at?: string
          ward_id: string
        }
        Update: {
          assigned_at?: string | null
          bed_number?: string
          bed_type?: string
          created_at?: string
          daily_rate?: number | null
          discharged_at?: string | null
          hospital_id?: string
          id?: string
          notes?: string | null
          patient_id?: string | null
          status?: string
          updated_at?: string
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_beds_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_beds_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_beds_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "hospital_wards"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_billing: {
        Row: {
          amount: number
          billing_type: string
          checkin_id: string | null
          created_at: string
          description: string | null
          discount: number | null
          hospital_id: string
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          paid_at: string | null
          patient_id: string
          payment_method: string | null
          payment_status: string | null
          tax: number | null
          total: number
          updated_at: string
        }
        Insert: {
          amount: number
          billing_type: string
          checkin_id?: string | null
          created_at?: string
          description?: string | null
          discount?: number | null
          hospital_id: string
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          paid_at?: string | null
          patient_id: string
          payment_method?: string | null
          payment_status?: string | null
          tax?: number | null
          total: number
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_type?: string
          checkin_id?: string | null
          created_at?: string
          description?: string | null
          discount?: number | null
          hospital_id?: string
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          paid_at?: string | null
          patient_id?: string
          payment_method?: string | null
          payment_status?: string | null
          tax?: number | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_billing_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "patient_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_billing_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_billing_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_doctors: {
        Row: {
          commission_rate: number | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          department: string | null
          doctor_id: string
          employment_type: string
          hospital_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          salary: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          commission_rate?: number | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          department?: string | null
          doctor_id: string
          employment_type?: string
          hospital_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          salary?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          commission_rate?: number | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          department?: string | null
          doctor_id?: string
          employment_type?: string
          hospital_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          salary?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_doctors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_notification_prefs: {
        Row: {
          hospital_id: string
          prefs: Json
          updated_at: string
        }
        Insert: {
          hospital_id: string
          prefs?: Json
          updated_at?: string
        }
        Update: {
          hospital_id?: string
          prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      hospital_notifications: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          is_read: boolean | null
          message: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_notifications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_referrals: {
        Row: {
          appointment_date: string | null
          clinical_summary: string | null
          created_at: string
          feedback: string | null
          hospital_id: string
          id: string
          patient_id: string
          reason: string
          referral_type: string
          referred_to_doctor_id: string | null
          referred_to_hospital: string | null
          referring_doctor_id: string | null
          specialty: string | null
          status: string | null
          updated_at: string
          urgency: string | null
        }
        Insert: {
          appointment_date?: string | null
          clinical_summary?: string | null
          created_at?: string
          feedback?: string | null
          hospital_id: string
          id?: string
          patient_id: string
          reason: string
          referral_type: string
          referred_to_doctor_id?: string | null
          referred_to_hospital?: string | null
          referring_doctor_id?: string | null
          specialty?: string | null
          status?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          appointment_date?: string | null
          clinical_summary?: string | null
          created_at?: string
          feedback?: string | null
          hospital_id?: string
          id?: string
          patient_id?: string
          reason?: string
          referral_type?: string
          referred_to_doctor_id?: string | null
          referred_to_hospital?: string | null
          referring_doctor_id?: string | null
          specialty?: string | null
          status?: string | null
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_referrals_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_referrals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_referrals_referred_to_doctor_id_fkey"
            columns: ["referred_to_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_referrals_referred_to_doctor_id_fkey"
            columns: ["referred_to_doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_referrals_referring_doctor_id_fkey"
            columns: ["referring_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_referrals_referring_doctor_id_fkey"
            columns: ["referring_doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_staff: {
        Row: {
          created_at: string
          department: string | null
          email: string
          first_name: string
          hospital_id: string
          id: string
          is_active: boolean | null
          last_login: string | null
          last_name: string
          phone: string | null
          profile_image_url: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          first_name: string
          hospital_id: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_name: string
          phone?: string | null
          profile_image_url?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          first_name?: string
          hospital_id?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          last_name?: string
          phone?: string | null
          profile_image_url?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_staff_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          expires_at: string | null
          hospital_id: string
          id: string
          plan: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          hospital_id: string
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string | null
          hospital_id?: string
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hospital_wards: {
        Row: {
          created_at: string
          floor: string | null
          hospital_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          total_beds: number
          updated_at: string
          ward_name: string
          ward_type: string
        }
        Insert: {
          created_at?: string
          floor?: string | null
          hospital_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          total_beds?: number
          updated_at?: string
          ward_name: string
          ward_type?: string
        }
        Update: {
          created_at?: string
          floor?: string | null
          hospital_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          total_beds?: number
          updated_at?: string
          ward_name?: string
          ward_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_wards_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          lat: number | null
          license_number: string | null
          lng: number | null
          logo_url: string | null
          name: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          license_number?: string | null
          lng?: number | null
          logo_url?: string | null
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          license_number?: string | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      insurance_claims: {
        Row: {
          approved_amount: number | null
          billing_id: string | null
          claim_amount: number
          claim_date: string
          created_at: string
          hospital_id: string
          id: string
          insurance_provider: string
          notes: string | null
          paid_date: string | null
          patient_id: string
          policy_number: string | null
          rejection_reason: string | null
          service_description: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          billing_id?: string | null
          claim_amount: number
          claim_date: string
          created_at?: string
          hospital_id: string
          id?: string
          insurance_provider: string
          notes?: string | null
          paid_date?: string | null
          patient_id: string
          policy_number?: string | null
          rejection_reason?: string | null
          service_description?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          billing_id?: string | null
          claim_amount?: number
          claim_date?: string
          created_at?: string
          hospital_id?: string
          id?: string
          insurance_provider?: string
          notes?: string | null
          paid_date?: string | null
          patient_id?: string
          policy_number?: string | null
          rejection_reason?: string | null
          service_description?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "hospital_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_result_tests: {
        Row: {
          catalog_test_id: string | null
          category_name: string | null
          created_at: string
          id: string
          is_abnormal: boolean | null
          is_custom: boolean
          lab_result_id: string
          parameters: Json | null
          reference_range: string | null
          result_value: string | null
          sample_type: string | null
          test_name: string
          unit: string | null
        }
        Insert: {
          catalog_test_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          is_abnormal?: boolean | null
          is_custom?: boolean
          lab_result_id: string
          parameters?: Json | null
          reference_range?: string | null
          result_value?: string | null
          sample_type?: string | null
          test_name: string
          unit?: string | null
        }
        Update: {
          catalog_test_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          is_abnormal?: boolean | null
          is_custom?: boolean
          lab_result_id?: string
          parameters?: Json | null
          reference_range?: string | null
          result_value?: string | null
          sample_type?: string | null
          test_name?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_result_tests_lab_result_id_fkey"
            columns: ["lab_result_id"]
            isOneToOne: false
            referencedRelation: "lab_results"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          notes: string | null
          ordered_by: string | null
          patient_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          notes?: string | null
          ordered_by?: string | null
          patient_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          notes?: string | null
          ordered_by?: string | null
          patient_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_ordered_by_fkey"
            columns: ["ordered_by"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      maternity_records: {
        Row: {
          apgar_score: string | null
          baby_gender: string | null
          baby_weight: number | null
          blood_group: string | null
          complications: string | null
          created_at: string
          delivery_date: string | null
          delivery_type: string | null
          doctor_id: string | null
          edd: string | null
          genotype: string | null
          gestational_age_weeks: number | null
          gravida: number | null
          hospital_id: string
          id: string
          lmp_date: string | null
          notes: string | null
          para: number | null
          patient_id: string
          risk_level: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          apgar_score?: string | null
          baby_gender?: string | null
          baby_weight?: number | null
          blood_group?: string | null
          complications?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_type?: string | null
          doctor_id?: string | null
          edd?: string | null
          genotype?: string | null
          gestational_age_weeks?: number | null
          gravida?: number | null
          hospital_id: string
          id?: string
          lmp_date?: string | null
          notes?: string | null
          para?: number | null
          patient_id: string
          risk_level?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          apgar_score?: string | null
          baby_gender?: string | null
          baby_weight?: number | null
          blood_group?: string | null
          complications?: string | null
          created_at?: string
          delivery_date?: string | null
          delivery_type?: string | null
          doctor_id?: string | null
          edd?: string | null
          genotype?: string | null
          gestational_age_weeks?: number | null
          gravida?: number | null
          hospital_id?: string
          id?: string
          lmp_date?: string | null
          notes?: string | null
          para?: number | null
          patient_id?: string
          risk_level?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maternity_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maternity_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maternity_records_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maternity_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_appointments: {
        Row: {
          created_at: string
          daily_room_name: string | null
          doctor_id: string | null
          hospital_id: string
          id: string
          is_telemedicine: boolean
          meeting_link: string | null
          notes: string | null
          patient_id: string
          reason: string | null
          requested_date: string
          requested_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_room_name?: string | null
          doctor_id?: string | null
          hospital_id: string
          id?: string
          is_telemedicine?: boolean
          meeting_link?: string | null
          notes?: string | null
          patient_id: string
          reason?: string | null
          requested_date: string
          requested_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_room_name?: string | null
          doctor_id?: string | null
          hospital_id?: string
          id?: string
          is_telemedicine?: boolean
          meeting_link?: string | null
          notes?: string | null
          patient_id?: string
          reason?: string | null
          requested_date?: string
          requested_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_checkins: {
        Row: {
          assigned_doctor_id: string | null
          called_time: string | null
          checkin_time: string | null
          checkin_type: string
          consultation_end: string | null
          consultation_start: string | null
          created_at: string
          department: string | null
          hospital_id: string
          id: string
          notes: string | null
          patient_id: string
          queue_number: number | null
          status: string
          updated_at: string
          urgency: string | null
          vitals: Json | null
        }
        Insert: {
          assigned_doctor_id?: string | null
          called_time?: string | null
          checkin_time?: string | null
          checkin_type?: string
          consultation_end?: string | null
          consultation_start?: string | null
          created_at?: string
          department?: string | null
          hospital_id: string
          id?: string
          notes?: string | null
          patient_id: string
          queue_number?: number | null
          status?: string
          updated_at?: string
          urgency?: string | null
          vitals?: Json | null
        }
        Update: {
          assigned_doctor_id?: string | null
          called_time?: string | null
          checkin_time?: string | null
          checkin_type?: string
          consultation_end?: string | null
          consultation_start?: string | null
          created_at?: string
          department?: string | null
          hospital_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          queue_number?: number | null
          status?: string
          updated_at?: string
          urgency?: string | null
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_checkins_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_checkins_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_checkins_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_checkins_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_letters: {
        Row: {
          body: string
          created_at: string
          doctor_id: string | null
          hospital_id: string | null
          id: string
          issued_at: string
          letter_type: string
          patient_id: string
          pdf_url: string | null
          status: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          issued_at?: string
          letter_type: string
          patient_id: string
          pdf_url?: string | null
          status?: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          doctor_id?: string | null
          hospital_id?: string | null
          id?: string
          issued_at?: string
          letter_type?: string
          patient_id?: string
          pdf_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_letters_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_letters_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_letters_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_letters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_messages: {
        Row: {
          body: string
          created_at: string
          from_user_id: string
          id: string
          is_read: boolean | null
          subject: string | null
          to_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          from_user_id: string
          id?: string
          is_read?: boolean | null
          subject?: string | null
          to_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          from_user_id?: string
          id?: string
          is_read?: boolean | null
          subject?: string | null
          to_user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          blood_group: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gender: string | null
          genotype: string | null
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_name: string
          phone: string | null
          profile_image_url: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          blood_group?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gender?: string | null
          genotype?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name: string
          phone?: string | null
          profile_image_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          blood_group?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gender?: string | null
          genotype?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name?: string
          phone?: string | null
          profile_image_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pharmacy_dispensing: {
        Row: {
          created_at: string
          dispensed_at: string | null
          dispensed_by: string | null
          dosage: string | null
          drug_id: string | null
          drug_name: string
          hospital_id: string
          id: string
          notes: string | null
          patient_id: string
          payment_status: string | null
          quantity_dispensed: number | null
        }
        Insert: {
          created_at?: string
          dispensed_at?: string | null
          dispensed_by?: string | null
          dosage?: string | null
          drug_id?: string | null
          drug_name: string
          hospital_id: string
          id?: string
          notes?: string | null
          patient_id: string
          payment_status?: string | null
          quantity_dispensed?: number | null
        }
        Update: {
          created_at?: string
          dispensed_at?: string | null
          dispensed_by?: string | null
          dosage?: string | null
          drug_id?: string | null
          drug_name?: string
          hospital_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          payment_status?: string | null
          quantity_dispensed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_dispensing_dispensed_by_fkey"
            columns: ["dispensed_by"]
            isOneToOne: false
            referencedRelation: "hospital_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_dispensing_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_dispensing_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_dispensing_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_inventory: {
        Row: {
          batch_number: string | null
          category: string | null
          created_at: string
          dosage_form: string | null
          drug_name: string
          expiry_date: string | null
          generic_name: string | null
          hospital_id: string
          id: string
          location: string | null
          quantity_in_stock: number | null
          reorder_level: number | null
          strength: string | null
          supplier: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          category?: string | null
          created_at?: string
          dosage_form?: string | null
          drug_name: string
          expiry_date?: string | null
          generic_name?: string | null
          hospital_id: string
          id?: string
          location?: string | null
          quantity_in_stock?: number | null
          reorder_level?: number | null
          strength?: string | null
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          category?: string | null
          created_at?: string
          dosage_form?: string | null
          drug_name?: string
          expiry_date?: string | null
          generic_name?: string | null
          hospital_id?: string
          id?: string
          location?: string | null
          quantity_in_stock?: number | null
          reorder_level?: number | null
          strength?: string | null
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_inventory_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          doctor_id: string | null
          dosage: string | null
          drug_name: string
          duration: string | null
          frequency: string | null
          hospital_id: string
          id: string
          instructions: string | null
          patient_id: string
          refills_allowed: number | null
          refills_used: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          dosage?: string | null
          drug_name: string
          duration?: string | null
          frequency?: string | null
          hospital_id: string
          id?: string
          instructions?: string | null
          patient_id: string
          refills_allowed?: number | null
          refills_used?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          dosage?: string | null
          drug_name?: string
          duration?: string | null
          frequency?: string | null
          hospital_id?: string
          id?: string
          instructions?: string | null
          patient_id?: string
          refills_allowed?: number | null
          refills_used?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_prescriptions_doctor"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_prescriptions_doctor"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_prescriptions_hospital"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_prescriptions_patient"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      surgery_records: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          anaesthesia_type: string | null
          anaesthetist_id: string | null
          blood_loss_ml: number | null
          complications: string | null
          created_at: string
          duration_minutes: number | null
          hospital_id: string
          id: string
          notes: string | null
          operative_findings: string | null
          patient_id: string
          post_op_diagnosis: string | null
          post_op_instructions: string | null
          pre_op_diagnosis: string | null
          procedure_name: string
          procedure_type: string | null
          scheduled_date: string
          scheduled_time: string
          status: string | null
          surgeon_id: string
          theatre_number: string | null
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          anaesthesia_type?: string | null
          anaesthetist_id?: string | null
          blood_loss_ml?: number | null
          complications?: string | null
          created_at?: string
          duration_minutes?: number | null
          hospital_id: string
          id?: string
          notes?: string | null
          operative_findings?: string | null
          patient_id: string
          post_op_diagnosis?: string | null
          post_op_instructions?: string | null
          pre_op_diagnosis?: string | null
          procedure_name: string
          procedure_type?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: string | null
          surgeon_id: string
          theatre_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          anaesthesia_type?: string | null
          anaesthetist_id?: string | null
          blood_loss_ml?: number | null
          complications?: string | null
          created_at?: string
          duration_minutes?: number | null
          hospital_id?: string
          id?: string
          notes?: string | null
          operative_findings?: string | null
          patient_id?: string
          post_op_diagnosis?: string | null
          post_op_instructions?: string | null
          pre_op_diagnosis?: string | null
          procedure_name?: string
          procedure_type?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string | null
          surgeon_id?: string
          theatre_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surgery_records_anaesthetist_id_fkey"
            columns: ["anaesthetist_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgery_records_anaesthetist_id_fkey"
            columns: ["anaesthetist_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgery_records_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgery_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgery_records_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgery_records_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "my_doctor_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      triage_sessions: {
        Row: {
          chosen_doctor_id: string | null
          chosen_hospital_id: string | null
          created_at: string
          duration: string | null
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          patient_id: string
          recommended_hospitals: Json | null
          recommended_specialty: string | null
          severity_score: number | null
          severity_self: number | null
          status: string
          symptoms: Json
          updated_at: string
          urgency: string | null
        }
        Insert: {
          chosen_doctor_id?: string | null
          chosen_hospital_id?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          patient_id: string
          recommended_hospitals?: Json | null
          recommended_specialty?: string | null
          severity_score?: number | null
          severity_self?: number | null
          status?: string
          symptoms?: Json
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          chosen_doctor_id?: string | null
          chosen_hospital_id?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          patient_id?: string
          recommended_hospitals?: Json | null
          recommended_specialty?: string | null
          severity_score?: number | null
          severity_self?: number | null
          status?: string
          symptoms?: Json
          updated_at?: string
          urgency?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      my_doctor_profile: {
        Row: {
          bio: string | null
          created_at: string | null
          credential_documents: Json | null
          current_practice: Json | null
          email: string | null
          first_name: string | null
          id: string | null
          is_available: boolean | null
          last_name: string | null
          license_council: string | null
          license_expiry: string | null
          license_number: string | null
          phone: string | null
          profile_image_url: string | null
          rating: number | null
          reference_contact: Json | null
          specialty: string | null
          updated_at: string | null
          user_id: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_status: string | null
          verification_submitted_at: string | null
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          credential_documents?: Json | null
          current_practice?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_available?: boolean | null
          last_name?: string | null
          license_council?: string | null
          license_expiry?: string | null
          license_number?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          reference_contact?: Json | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_status?: string | null
          verification_submitted_at?: string | null
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          credential_documents?: Json | null
          current_practice?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          is_available?: boolean | null
          last_name?: string | null
          license_council?: string | null
          license_expiry?: string | null
          license_number?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          reference_contact?: Json | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_status?: string | null
          verification_submitted_at?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_doctor_access_patient: {
        Args: { _doctor_id: string; _patient_id: string }
        Returns: boolean
      }
      create_hospital_with_admin: {
        Args: {
          _address: string
          _email: string
          _first_name: string
          _last_name: string
          _name: string
          _phone: string
          _plan: string
        }
        Returns: string
      }
      get_doctor_hospital_id: { Args: { _doctor_id: string }; Returns: string }
      get_doctor_hospital_ids: {
        Args: { _doctor_id: string }
        Returns: {
          hospital_id: string
        }[]
      }
      get_hospital_plan: { Args: { _hospital_id: string }; Returns: string }
      get_user_doctor_id: { Args: { _user_id: string }; Returns: string }
      get_user_hospital_id: { Args: { _user_id: string }; Returns: string }
      is_doctor_at_hospital: {
        Args: { _doctor_id: string; _hospital_id: string }
        Returns: boolean
      }
      is_hospital_admin: {
        Args: { _hospital_id: string; _user_id: string }
        Returns: boolean
      }
      is_hospital_staff: {
        Args: { _hospital_id: string; _user_id: string }
        Returns: boolean
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
