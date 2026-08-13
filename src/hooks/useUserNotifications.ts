import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserNotification = {
  id: string;
  user_id: string;
  audience: string;
  type: string;
  title: string;
  message: string | null;
  reference_id: string | null;
  reference_type: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
};

export const NOTIFICATION_ICONS: Record<string, string> = {
  appointment: "📅",
  lab: "🔬",
  letter: "📄",
  prescription: "💊",
  billing: "💳",
  call_in: "☎️",
  system: "⚙️",
};

export function useUserNotifications() {
  return useQuery({
    queryKey: ["user-notifications"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [] as UserNotification[];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as UserNotification[];
    },
  });
}

export function useRealtimeUserNotifications() {
  const qc = useQueryClient();
  const instanceId = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`user-notifications-rt-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications" },
        () => qc.invalidateQueries({ queryKey: ["user-notifications"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, instanceId]);
}

export function useMarkUserNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });
}

export function useMarkAllUserNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { error } = await supabase
        .from("user_notifications")
        .update({ is_read: true })
        .eq("user_id", auth.user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });
}

export function useDeleteUserNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });
}

export type NotificationPrefs = {
  user_id: string;
  email_enabled: boolean;
  email_appointments: boolean;
  email_lab_results: boolean;
  email_prescriptions: boolean;
  email_letters: boolean;
  email_billing: boolean;
  language: string | null;
};

const DEFAULT_PREFS: Omit<NotificationPrefs, "user_id"> = {
  email_enabled: true,
  email_appointments: true,
  email_lab_results: true,
  email_prescriptions: true,
  email_letters: true,
  email_billing: true,
  language: "en",
};

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ["notification-prefs"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationPrefs) ?? { user_id: auth.user.id, ...DEFAULT_PREFS };
    },
  });
}

export function useSaveNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPrefs>) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: auth.user.id, ...DEFAULT_PREFS, ...prefs }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-prefs"] }),
  });
}
