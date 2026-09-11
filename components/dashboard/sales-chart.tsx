'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { format, subDays, parseISO, isValid } from 'date-fns';

interface SalesData {
  date?: string;
  name?: string;
  total?: number;
  sales?: number;
}

interface SalesChartProps {
  data: SalesData[];
}

export default function SalesChart({ data = [] }: SalesChartProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const safeData = (Array.isArray(data) ? data : []).map((item: any) => ({
    date: item?.date || item?.name || new Date().toISOString().split('T')[0],
    total: Number(item?.total ?? item?.sales ?? item?.total_amount ?? 0),
  }));

  const filteredData = safeData.filter(item => {
    if (!item.date || typeof item.date !== 'string' || item.date.length < 8) return true;
    try {
      const itemDate = parseISO(item.date);
      if (!isValid(itemDate)) return true;
      const cutoffDate = subDays(new Date(), period);
      return itemDate >= cutoffDate;
    } catch {
      return true;
    }
  });

  const formatXAxis = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    if (dateStr.length < 8) return dateStr;
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) return dateStr;
      return format(d, 'dd MMM');
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-md">
          <p className="text-xs font-semibold text-muted-foreground mb-1">{formatXAxis(label)}</p>
          <p className="text-sm text-green-600 dark:text-green-400 font-bold">
            Sales: {formatCurrency(payload[0]?.value || 0)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-4 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Sales Overview</CardTitle>
        <div className="flex space-x-1 bg-muted p-1 rounded-md">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days as 7 | 30 | 90)}
              className={`text-xs px-2.5 py-1 rounded-sm font-medium transition-colors ${
                period === days
                  ? 'bg-background shadow-sm text-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px] pt-4 pb-2 px-2">
        {filteredData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
            No sales data available for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 15, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/60" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                tickLine={{ stroke: 'currentColor' }}
                axisLine={{ stroke: 'currentColor' }}
                className="text-muted-foreground"
                dy={8}
              />
              <YAxis 
                tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : value}`}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                tickLine={{ stroke: 'currentColor' }}
                axisLine={{ stroke: 'currentColor' }}
                className="text-muted-foreground"
                width={50}
                dx={-4}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#16a34a" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#16a34a' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
