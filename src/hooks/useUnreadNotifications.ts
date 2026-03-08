import { useHospitalNotifications, useRealtimeNotifications } from "./useHospitalData";

export function useUnreadNotificationCount() {
  useRealtimeNotifications();
  const { data: notifications } = useHospitalNotifications();
  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;
  return unreadCount;
}
