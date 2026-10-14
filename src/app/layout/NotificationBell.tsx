import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { blocksClient } from "../../lib/blocks/client";

type InboxItem = {
  createdTime?: string;
  denormalizedPayload?: string;
  id?: string;
  isRead?: boolean;
};

function payloadText(item: InboxItem): string {
  const raw = item.denormalizedPayload;
  if (!raw) return "You have a new notification.";
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    return parsed.message ?? raw;
  } catch {
    return raw;
  }
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const inbox = useQuery({
    queryFn: async () => {
      const response = await blocksClient.notifier.getNotifications({ page: 1, pageSize: 15, sortDescending: true });
      const data = response as unknown as {
        notifications?: InboxItem[];
        unReadNotificationsCount?: number;
        totalNotificationsCount?: number;
      };
      return {
        items: data.notifications ?? [],
        unread: data.unReadNotificationsCount ?? (data.notifications ?? []).filter((item) => !item.isRead).length,
        total: data.totalNotificationsCount ?? (data.notifications ?? []).length
      };
    },
    queryKey: ["notifications-inbox"],
    staleTime: 30000
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markAll() {
    await blocksClient.notifier.markAllNotificationAsRead().catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: ["notifications-inbox"] });
  }

  async function openOne(item: InboxItem) {
    if (item.id && !item.isRead) {
      await blocksClient.notifier.markNotificationAsRead({ id: item.id }).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ["notifications-inbox"] });
    }
  }

  const unread = inbox.data?.unread ?? 0;

  return (
    <div className="bell" ref={panelRef}>
      <button
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        className="icon-button bell-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unread > 0 ? <span className="bell-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="bell-panel">
          <div className="panel-title">
            <h3>Notifications</h3>
            {unread > 0 ? <button className="link-button" onClick={() => void markAll()}>Mark all read</button> : null}
          </div>
          {inbox.isLoading ? <p className="muted">Loading…</p> : null}
          {!inbox.isLoading && (inbox.data?.items.length ?? 0) === 0 ? <p className="muted">Nothing new right now.</p> : null}
          <ul className="feed">
            {(inbox.data?.items ?? []).map((item, index) => (
              <li key={item.id ?? index} className={item.isRead ? undefined : "unread"}>
                <button className="link-button" onClick={() => void openOne(item)}>{payloadText(item)}</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
