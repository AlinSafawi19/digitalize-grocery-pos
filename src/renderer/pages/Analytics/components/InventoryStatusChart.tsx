import React, { useMemo, useCallback } from 'react';
import { Paper, Typography, Box } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { InventoryReportData } from '../../../services/report.service';

interface InventoryStatusChartProps {
  data: InventoryReportData;
}

const COLORS = ['#2e7d32', '#ed6c02', '#d32f2f', '#616161'];

const InventoryStatusChart: React.FC<InventoryStatusChartProps> = ({ data }) => {
  // Memoize inStock calculation
  const inStock = useMemo(() => {
    return data.totalProducts - data.lowStockItems - data.outOfStockItems;
  }, [data.totalProducts, data.lowStockItems, data.outOfStockItems]);

  // Memoize chart data
  const chartData = useMemo(() => {
    return [
      { name: 'In Stock', value: inStock },
      { name: 'Low Stock', value: data.lowStockItems },
      { name: 'Out of Stock', value: data.outOfStockItems },
    ].filter((item) => item.value > 0);
  }, [inStock, data.lowStockItems, data.outOfStockItems]);

  // Memoize label function
  const labelFormatter = useCallback(({ name, percent }: { name: string; percent: number }) => {
    return `${name}: ${(percent * 100).toFixed(0)}%`;
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

  const infoBoxSx = useMemo(() => ({
    mt: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  }), []);

  const infoTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '& strong': {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  // Memoize stock value string
  const stockValueText = useMemo(() => {
    return `$${data.totalStockValue.toFixed(2)}`;
  }, [data.totalStockValue]);

  return (
    <Paper sx={paperSx}>
      <Typography sx={titleTypographySx}>
        Inventory Status
      </Typography>
      <Box sx={chartBoxSx}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={labelFormatter}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={infoBoxSx}>
        <Typography sx={infoTypographySx}>
          <strong>Total Products:</strong> {data.totalProducts}
        </Typography>
        <Typography sx={infoTypographySx}>
          <strong>Stock Value:</strong> {stockValueText}
        </Typography>
      </Box>
    </Paper>
  );
};

export default InventoryStatusChart;

