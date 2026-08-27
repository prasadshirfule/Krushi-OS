import { getNotificationsAction } from "@/actions/notifications";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata = {
  title: 'Notifications | KRUSHI OS',
};

export default async function NotificationsPage() {
  const res = await getNotificationsAction({});
  const notifications = res.success && res.data?.notifications ? res.data.notifications : [];

  return (
    <div className="space-y-6 p-6">
      <NotificationList initialNotifications={notifications} />
    </div>
  );
}
