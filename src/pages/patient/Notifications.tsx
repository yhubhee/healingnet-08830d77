import { PatientLayout } from "@/layouts/PatientLayout";
import { UserNotificationsList } from "@/components/common/UserNotificationsList";

export default function PatientNotifications() {
  return (
    <PatientLayout>
      <UserNotificationsList />
    </PatientLayout>
  );
}
