import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Refresh, Assessment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import MainLayout from '../../components/layout/MainLayout';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import {
  LicenseUsageStatisticsService,
  LicenseUsageStatistics,
  DeviceActivationRecord,
} from '../../services/license-usage-statistics.service';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function LicenseUsageStatisticsPage() {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<LicenseUsageStatistics | null>(null);
  const [deviceRecords, setDeviceRecords] = useState<DeviceActivationRecord[]>([]);

  const loadStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const [stats, devices] = await Promise.all([
        LicenseUsageStatisticsService.getUsageStatistics(),
        LicenseUsageStatisticsService.getDeviceActivationRecords(),
      ]);
      
      if (stats) {
        setStatistics(stats);
      } else {
        showToast('No license data found', 'warning');
      }
      setDeviceRecords(devices);
    } catch (err) {
      console.error('Error loading statistics:', err);
      showToast('Failed to load license usage statistics', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!statistics) {
    return (
      <MainLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="warning">
            No license data found. Please activate a license to view usage statistics.
          </Alert>
          <Button
            variant="contained"
            onClick={() => navigate(ROUTES.LICENSE)}
            sx={{ mt: 2 }}
          >
            Go to License Page
          </Button>
        </Box>
      </MainLayout>
    );
  }

  // Prepare chart data
  const validationTypeData = [
    { name: 'Online', value: statistics.validationStatistics.validationTypes.online },
    { name: 'Offline', value: statistics.validationStatistics.validationTypes.offline },
    { name: 'Cached', value: statistics.validationStatistics.validationTypes.cached },
  ].filter(item => item.value > 0);

  const validationResultData = [
    { name: 'Valid', value: statistics.validationStatistics.validationResults.valid },
    { name: 'Invalid', value: statistics.validationStatistics.validationResults.invalid },
    { name: 'Expired', value: statistics.validationStatistics.validationResults.expired },
    { name: 'Tampered', value: statistics.validationStatistics.validationResults.tampered },
    { name: 'Error', value: statistics.validationStatistics.validationResults.error },
  ].filter(item => item.value > 0);

  const transferStatusData = [
    { name: 'Completed', value: statistics.transferStatistics.completedTransfers },
    { name: 'Pending', value: statistics.transferStatistics.pendingTransfers },
    { name: 'Cancelled', value: statistics.transferStatistics.cancelledTransfers },
    { name: 'Failed', value: statistics.transferStatistics.failedTransfers },
  ].filter(item => item.value > 0);

  const timelineData = statistics.usageTimeline.map(item => ({
    date: formatDate(new Date(item.date), 'MMM dd'),
    validations: item.validations,
    transfers: item.transfers,
  }));

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            License Usage Statistics
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadStatistics}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {/* License Information Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              License Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  License Key
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {statistics.licenseKey.substring(0, 12)}...
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Location
                </Typography>
                <Typography variant="body1">
                  {statistics.locationName || 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Activated At
                </Typography>
                <Typography variant="body1">
                  {statistics.activatedAt ? formatDate(new Date(statistics.activatedAt)) : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Expires At
                </Typography>
                <Typography variant="body1">
                  {statistics.expiresAt ? formatDate(new Date(statistics.expiresAt)) : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  Days Remaining
                </Typography>
                <Typography variant="body1">
                  {statistics.daysRemaining !== null ? (
                    <Chip
                      label={`${statistics.daysRemaining} days`}
                      color={statistics.isExpired ? 'error' : statistics.daysRemaining <= 7 ? 'warning' : 'success'}
                      size="small"
                    />
                  ) : 'N/A'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Validations
                </Typography>
                <Typography variant="h4">
                  {statistics.validationStatistics.totalValidations}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Successful Validations
                </Typography>
                <Typography variant="h4" color="success.main">
                  {statistics.validationStatistics.successfulValidations}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Tamper Detected
                </Typography>
                <Typography variant="h4" color="error.main">
                  {statistics.validationStatistics.tamperDetectedCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Transfers
                </Typography>
                <Typography variant="h4">
                  {statistics.transferStatistics.totalTransfers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Charts Row */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Validation Types Pie Chart */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Validation Types
              </Typography>
              {validationTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={validationTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {validationTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  No validation data available
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Validation Results Pie Chart */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Validation Results
              </Typography>
              {validationResultData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={validationResultData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {validationResultData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  No validation data available
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Transfer Status Pie Chart */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Transfer Status
              </Typography>
              {transferStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={transferStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {transferStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  No transfer data available
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Usage Timeline Chart */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Usage Timeline (Last 30 Days)
          </Typography>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="validations" stroke="#8884d8" name="Validations" />
                <Line type="monotone" dataKey="transfers" stroke="#82ca9d" name="Transfers" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              No timeline data available
            </Typography>
          )}
        </Paper>

        {/* Device Activation Records */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Device Activation Records
          </Typography>
          {deviceRecords.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Hardware ID</TableCell>
                    <TableCell>Machine Name</TableCell>
                    <TableCell>Activated At</TableCell>
                    <TableCell>Last Validation</TableCell>
                    <TableCell>Validation Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deviceRecords.map((device, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {device.hardwareId.substring(0, 16)}...
                        </Typography>
                      </TableCell>
                      <TableCell>{device.machineName || 'N/A'}</TableCell>
                      <TableCell>
                        {device.activatedAt ? formatDate(new Date(device.activatedAt)) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {device.lastValidation ? formatDate(new Date(device.lastValidation)) : 'N/A'}
                      </TableCell>
                      <TableCell>{device.validationCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              No device records available
            </Typography>
          )}
        </Paper>

        <Toast
          open={toast.open}
          message={toast.message}
          severity={toast.severity}
          onClose={hideToast}
        />
      </Box>
    </MainLayout>
  );
}

