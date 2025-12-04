import React, { useMemo, useCallback } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DailySalesStats } from '../../../services/report.service';
import { formatCurrency } from '../../../utils/formatters';

interface SalesTrendChartProps {
  data: DailySalesStats[];
}

const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ data }) => {
  // Format data for chart - memoized
  const chartData = useMemo(() => {
    return data.map((stat) => ({
      date: new Date(stat.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      sales: stat.totalSales,
      transactions: stat.totalTransactions,
      items: stat.totalItems,
    }));
  }, [data]);

  // Memoize tooltip formatter
  const tooltipFormatter = useCallback((value: number, name: string) => {
    if (name === 'sales') {
      return formatCurrency(value);
    }
    return value;
  }, []);

  const paperSx = useMemo(() => ({
    p: 3,
    height: '100%',
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 2,
  }), []);

  const chartBoxSx = useMemo(() => ({
    width: '100%',
    height: 400,
    mt: 2,
  }), []);

  return (
    <Paper sx={paperSx}>
      <Typography sx={titleTypographySx}>
        Sales Trend
      </Typography>
      <Box sx={chartBoxSx}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="sales"
              stroke="#1976d2"
              strokeWidth={2}
              name="Sales"
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="transactions"
              stroke="#2e7d32"
              strokeWidth={2}
              name="Transactions"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default SalesTrendChart;

