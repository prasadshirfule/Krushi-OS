'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { markNotificationReadAction } from '@/actions/notifications';
import { toast } from 'sonner';
import { Bell, AlertTriangle, Info, CheckCircle, Check } from 'lucide-react';

export function NotificationList({ initialNotifications }: { initialNotifications: any[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationReadAction(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, is_read: true } : n));
      toast.success('Notification marked as read');
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const filtered = notifications.filter(n => {
    const isRead = n.read || n.is_read;
    if (filter === 'unread') return !isRead;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground">Inventory health warnings, FEFO expiry alerts, and credit updates</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
          <Check className="h-4 w-4 mr-2" /> Mark All Read
        </Button>
      </div>

      <div className="flex gap-2">
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </Button>
        <Button 
          variant={filter === 'unread' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setFilter('unread')}
        >
          Unread ({notifications.filter(n => !n.read && !n.is_read).length})
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No notifications found in this view.
          </Card>
        ) : (
          filtered.map(n => {
            const isRead = n.read || n.is_read;
            return (
              <Card key={n.id} className={`transition-colors ${isRead ? 'bg-background opacity-80' : 'bg-primary/5 border-primary/20'}`}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-full mt-0.5 ${
                      n.type === 'critical' ? 'bg-red-100 text-red-600' :
                      n.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {n.type === 'critical' || n.type === 'warning' ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <Info className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{n.title}</span>
                        {!isRead && <Badge className="bg-primary text-[10px] py-0">New</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      <span className="text-xs text-muted-foreground mt-2 block">{n.created_at}</span>
                    </div>
                  </div>
                  {!isRead && (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)} className="text-xs text-muted-foreground hover:text-primary">
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
