'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { Activity, Plus, Edit2, Trash2, Settings, UserCircle, Package, Receipt, ShoppingCart } from 'lucide-react';

interface ActivityFeedProps {
  activities: any[];
}

export default function ActivityFeed({ activities = [] }: ActivityFeedProps) {
  const getActivityIcon = (action: string = '', entityType: string = '') => {
    const act = (action || '').toUpperCase();
    const type = (entityType || '').toUpperCase();
    
    let Icon = Activity;
    let color = 'text-gray-500';
    let bgColor = 'bg-gray-100 dark:bg-gray-800';

    if (act.includes('CREATE') || act.includes('ADD') || act.includes('SALE')) {
      Icon = Plus;
      color = 'text-green-600';
      bgColor = 'bg-green-100 dark:bg-green-900/30';
    } else if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('ADJUST')) {
      Icon = Edit2;
      color = 'text-blue-600';
      bgColor = 'bg-blue-100 dark:bg-blue-900/30';
    } else if (act.includes('DELETE') || act.includes('REMOVE')) {
      Icon = Trash2;
      color = 'text-red-600';
      bgColor = 'bg-red-100 dark:bg-red-900/30';
    }

    if (type.includes('USER') || type.includes('CUSTOMER')) {
      Icon = UserCircle;
    } else if (type.includes('PRODUCT') || type.includes('INVENTORY')) {
      Icon = Package;
    } else if (type.includes('SALE') || type.includes('INVOICE') || type.includes('POS')) {
      Icon = Receipt;
    } else if (type.includes('PURCHASE')) {
      Icon = ShoppingCart;
    } else if (type.includes('SETTING')) {
      Icon = Settings;
    }

    return { Icon, color, bgColor };
  };

  const formatActivityTime = (dateStr: string) => {
    if (!dateStr) return 'Just now';
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) return 'Recently';
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {(!activities || activities.length === 0) ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No recent activity found.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border -z-10 hidden sm:block"></div>
            <ul className="space-y-6 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
              {activities.map((log, idx) => {
                const actionStr = log.action || log.details || 'ACTIVITY';
                const entityStr = log.entity_type || log.module || 'System';
                const { Icon, color, bgColor } = getActivityIcon(actionStr, entityStr);
                const userName = log.user_name || (log.user_id ? log.user_id.substring(0, 6) : 'Demo Admin');
                
                return (
                  <li key={log.id || `act-${idx}`} className="flex gap-4 sm:items-start items-center">
                    <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgColor} ring-8 ring-background`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-1">
                      <p className="text-sm text-muted-foreground">
                        User <span className="font-medium text-foreground">{userName}</span>:{' '}
                        <span className="text-foreground">{log.details || `${actionStr} on ${entityStr}`}</span>
                      </p>
                      <time 
                        dateTime={log.created_at} 
                        className="text-xs text-muted-foreground whitespace-nowrap"
                      >
                        {formatActivityTime(log.created_at)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
