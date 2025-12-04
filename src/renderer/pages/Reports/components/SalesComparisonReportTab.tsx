import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import {
  ReportService,
  SalesComparisonReportData,
  OptionalDateRange,
} from '../../../services/report.service';
import { formatCurrency, formatPercentage } from '../../../utils/formatters';
import {
  exportSalesComparisonReportToCSV,
  exportSalesComparisonReportToExcel,
  exportSalesComparisonReportToPDF,
} from '../../../utils/exportUtils';
import { convertDateRangeToUTC } from '../../../utils/dateUtils';
import { useToast } from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';

interface SalesComparisonReportTabProps {
  period1Range: OptionalDateRange;
  period2Range: OptionalDateRange;
  userId: number;
  onPeriod1RangeChange: (range: OptionalDateRange) => void;
  onPeriod2RangeChange: (range: OptionalDateRange) => void;
}

const SalesComparisonReportTab: React.FC<SalesComparisonReportTabProps> = ({
  period1Range,
  period2Range,
  userId,
}) => {
  const { toast, showToast, hideToast } = useToast();
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<SalesComparisonReportData | null>(null);
  const [comparisonExportMenuAnchor, setComparisonExportMenuAnchor] = useState<null | HTMLElement>(null);

  const loadComparisonReport = useCallback(async () => {
    // Don't load if any date is missing
    if (!period1Range.startDate || !period1Range.endDate || !period2Range.startDate || !period2Range.endDate) {
      setComparisonData(null);
      setComparisonLoading(false);
      return;
    }

    setComparisonLoading(true);
    try {
      // Convert date ranges from Beirut timezone to UTC for API
      const { startDate: period1StartUTC, endDate: period1EndUTC } = convertDateRangeToUTC(
        period1Range.startDate!,
        period1Range.endDate!
      );
      const { startDate: period2StartUTC, endDate: period2EndUTC } = convertDateRangeToUTC(
        period2Range.startDate!,
        period2Range.endDate!
      );

      const period1RangeUTC = { startDate: period1StartUTC!, endDate: period1EndUTC! };
      const period2RangeUTC = { startDate: period2StartUTC!, endDate: period2EndUTC! };

      const result = await ReportService.getSalesComparisonReport(period1RangeUTC, period2RangeUTC, userId);
      if (result.success && result.data) {
        setComparisonData(result.data);
      } else {
        showToast(result.error || 'Failed to load sales comparison report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred while loading sales comparison report', 'error');
    } finally {
      setComparisonLoading(false);
    }
  }, [period1Range, period2Range, userId, showToast]);

  useEffect(() => {
    loadComparisonReport();
  }, [loadComparisonReport]);

  const handleComparisonExportMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setComparisonExportMenuAnchor(event.currentTarget);
  }, []);

  const handleComparisonExportMenuClose = useCallback(() => {
    setComparisonExportMenuAnchor(null);
  }, []);

  const handleComparisonExportCSV = useCallback(async () => {
    if (comparisonData) {
      await exportSalesComparisonReportToCSV(comparisonData);
    }
    handleComparisonExportMenuClose();
  }, [comparisonData, handleComparisonExportMenuClose]);

  const handleComparisonExportExcel = useCallback(async () => {
    if (comparisonData) {
      await exportSalesComparisonReportToExcel(comparisonData);
    }
    handleComparisonExportMenuClose();
  }, [comparisonData, handleComparisonExportMenuClose]);

  const handleComparisonExportPDF = useCallback(async () => {
    if (comparisonData) {
      await exportSalesComparisonReportToPDF(comparisonData, userId);
    }
    handleComparisonExportMenuClose();
  }, [comparisonData, userId, handleComparisonExportMenuClose]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
  }), []);

  const cardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const buttonGroupSx = useMemo(() => ({
    '& .MuiButton-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'none',
      borderRadius: 0,
      borderColor: '#c0c0c0',
      color: '#1a237e',
      '&:hover': {
        borderColor: '#1a237e',
        backgroundColor: '#f5f5f5',
      },
    },
  }), []);

  // Memoize additional sx objects
  const exportButtonsBoxSx = useMemo(() => ({
    mb: 2,
    display: 'flex',
    justifyContent: 'flex-end',
  }), []);

  const bodyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h6BoldTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const h4TypographySx = useMemo(() => ({
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const getChangeTypographySx = useCallback((change: number) => ({
    color: change >= 0 ? 'success.main' : 'error.main',
    fontSize: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  return (
    <Box>
      {comparisonData && (
        <Box sx={exportButtonsBoxSx} className="no-print">
          <ButtonGroup variant="outlined" size="small" sx={buttonGroupSx}>
            <Button startIcon={<Download />} onClick={handleComparisonExportMenuOpen}>
              Export
            </Button>
          </ButtonGroup>
          <Menu
            anchorEl={comparisonExportMenuAnchor}
            open={Boolean(comparisonExportMenuAnchor)}
            onClose={handleComparisonExportMenuClose}
          >
            <MenuItem onClick={handleComparisonExportCSV}>Export as CSV</MenuItem>
            <MenuItem onClick={handleComparisonExportExcel}>Export as Excel</MenuItem>
            <MenuItem onClick={handleComparisonExportPDF}>Export as PDF</MenuItem>
          </Menu>
        </Box>
      )}
      {comparisonLoading ? (
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      ) : comparisonData ? (
        <Box>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Period 1 Sales
                  </Typography>
                  <Typography variant="h4" color="primary" sx={h4TypographySx}>
                    {formatCurrency(comparisonData.period1.totalSales)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                    {comparisonData.period1.startDate.toLocaleDateString()} -{' '}
                    {comparisonData.period1.endDate.toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Period 2 Sales
                  </Typography>
                  <Typography variant="h4" color="success.main" sx={h4TypographySx}>
                    {formatCurrency(comparisonData.period2.totalSales)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                    {comparisonData.period2.startDate.toLocaleDateString()} -{' '}
                    {comparisonData.period2.endDate.toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Sales Change
                  </Typography>
                  <Typography variant="h4" sx={getChangeTypographySx(comparisonData.comparison.salesChange)}>
                    {comparisonData.comparison.salesChange >= 0 ? '+' : ''}
                    {formatCurrency(comparisonData.comparison.salesChange)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                    {formatPercentage(comparisonData.comparison.salesChangePercent)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Transaction Count Change
                  </Typography>
                  <Typography variant="h4" sx={getChangeTypographySx(comparisonData.comparison.transactionCountChange)}>
                    {comparisonData.comparison.transactionCountChange >= 0 ? '+' : ''}
                    {comparisonData.comparison.transactionCountChange}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                    {formatPercentage(comparisonData.comparison.transactionCountChangePercent)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={cardSx}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={h6BoldTypographySx}>
                    Avg Transaction Value Change
                  </Typography>
                  <Typography variant="h4" sx={getChangeTypographySx(comparisonData.comparison.averageTransactionValueChange)}>
                    {comparisonData.comparison.averageTransactionValueChange >= 0 ? '+' : ''}
                    {formatCurrency(comparisonData.comparison.averageTransactionValueChange)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={bodyTypographySx}>
                    {formatPercentage(
                      comparisonData.comparison.averageTransactionValueChangePercent
                    )}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Box sx={loadingBoxSx}>
          <Typography sx={emptyStateTypographySx}>
            No comparison data available. Please select date ranges for both periods.
          </Typography>
        </Box>
      )}
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default SalesComparisonReportTab;

