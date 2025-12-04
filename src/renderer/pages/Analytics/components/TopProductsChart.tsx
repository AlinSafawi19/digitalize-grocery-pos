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
import { TopSellingProduct } from '../../../services/report.service';
import { formatCurrency } from '../../../utils/formatters';

interface TopProductsChartProps {
  data: TopSellingProduct[];
}

const TopProductsChart: React.FC<TopProductsChartProps> = ({ data }) => {
  // Format data for chart (top 5) - memoized
  const chartData = useMemo(() => {
    return data.slice(0, 5).map((product) => ({
      name: product.productName.length > 15
        ? product.productName.substring(0, 15) + '...'
        : product.productName,
      revenue: product.revenue,
      quantity: product.quantitySold,
    }));
  }, [data]);

  // Memoize tooltip formatter
  const tooltipFormatter = useCallback((value: number, name: string) => {
    if (name === 'revenue') {
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
        Top Products
      </Typography>
      <Box sx={chartBoxSx}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={120} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey="revenue" fill="#1976d2" name="Revenue" />
            <Bar dataKey="quantity" fill="#2e7d32" name="Quantity" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default TopProductsChart;

