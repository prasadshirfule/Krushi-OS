'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface TopProductData {
  id?: string;
  name?: string;
  product_name?: string;
  total_sold?: number;
  quantity?: number;
  revenue?: number;
}

interface TopProductsProps {
  products: TopProductData[];
}

export default function TopProducts({ products = [] }: TopProductsProps) {
  const chartData = (products || []).map((item) => ({
    name: item.name || item.product_name || 'Unnamed Product',
    revenue: Number(item.revenue || 0),
    sold: Number(item.total_sold || item.quantity || 0),
  })).filter(p => p.revenue > 0 || p.sold > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-md z-50">
          <p className="text-sm font-medium mb-1">{payload[0].payload.name}</p>
          <p className="text-sm text-green-600 font-semibold">
            Revenue: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sold: {payload[0].payload.sold} units
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-3 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Top Selling Products</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-4">
        {chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-12 text-center">
            No product sales data for this period
          </div>
        ) : (
          <>
            <div className="h-[200px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12 }} 
                    width={110}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="#16a34a" fillOpacity={1 - (index * 0.15)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-auto">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Product Ranking</h4>
              <div className="space-y-3">
                {chartData.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="text-sm font-medium truncate max-w-[140px]" title={item.name}>
                        {item.name}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm font-semibold">{formatCurrency(item.revenue)}</div>
                      <div className="text-xs text-muted-foreground">{item.sold} sold</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
