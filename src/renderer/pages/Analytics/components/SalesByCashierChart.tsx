import React, { useMemo, useCallback } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../../utils/formatters';

interface SalesByCashierData {
  cashierId: number;
  cashierName: string;
  sales: number;
  transactions: number;
}

interface SalesByCashierChartProps {
  data: SalesByCashierData[];
}

const SalesByCashierChart: React.FC<SalesByCashierChartProps> = ({ data }) => {
  // Memoize chart data transformation
  const chartData = useMemo(() => {
    return data.map((cashier) => ({
      name: cashier.cashierName,
      sales: cashier.sales,
      transactions: cashier.transactions,
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
    height: 300,
    mt: 2,
  }), []);

  return (
    <Paper sx={paperSx}>
      <Typography sx={titleTypographySx}>
        Sales by Cashier
      </Typography>
      <Box sx={chartBoxSx}>
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey="sales" fill="#1976d2" name="Sales" />
            <Bar dataKey="transactions" fill="#2e7d32" name="Transactions" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default SalesByCashierChart;

