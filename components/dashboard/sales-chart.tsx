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
  profit?: number;
}

interface SalesChartProps {
  data: SalesData[];
}

export default function SalesChart({ data = [] }: SalesChartProps) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const safeData = (Array.isArray(data) ? data : []).map((item: any) => ({
    date: item?.date || item?.name || new Date().toISOString().split('T')[0],
    total: item?.total ?? item?.sales ?? item?.total_amount ?? 0,
    profit: item?.profit ?? 0
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
        <div className="bg-background border border-border p-3 rounded-lg shadow-md">
          <p className="text-sm font-medium mb-1">{formatXAxis(label)}</p>
          <p className="text-sm text-green-600 font-semibold">
            Sales: {formatCurrency(payload[0]?.value || 0)}
          </p>
          {payload[1] && payload[1].value > 0 && (
            <p className="text-sm text-blue-600 font-semibold">
              Profit: {formatCurrency(payload[1].value)}
            </p>
          )}
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
              className={`text-xs px-2 py-1 rounded-sm transition-colors ${
                period === days
                  ? 'bg-background shadow-sm text-foreground'
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
            <AreaChart data={filteredData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                dy={10}
              />
              <YAxis 
                tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="total" 
                stroke="#16a34a" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#16a34a' }}
              />
              <Area 
                type="monotone" 
                dataKey="profit" 
                stroke="#2563eb" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorProfit)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
