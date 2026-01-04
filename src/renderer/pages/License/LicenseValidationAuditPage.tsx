import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Refresh, Security, Warning, CheckCircle, Error as ErrorIcon, Block } from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  LicenseValidationAuditService,
  LicenseValidationAuditLog,
  LicenseValidationAuditLogListOptions,
} from '../../services/license-validation-audit.service';
import MainLayout from '../../components/layout/MainLayout';
import FilterHeader, { FilterField } from '../../components/common/FilterHeader';
import { formatDateTime, convertDateRangeToUTC } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

// Validation type options
const VALIDATION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'cached', label: 'Cached' },
];

// Validation result options
const VALIDATION_RESULTS = [
  { value: '', label: 'All Results' },
  { value: 'valid', label: 'Valid' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'expired', label: 'Expired' },
  { value: 'tampered', label: 'Tampered' },
  { value: 'error', label: 'Error' },
];

const LicenseValidationAuditPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [logs, setLogs] = useState<LicenseValidationAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Filters
  const [validationTypeFilter, setValidationTypeFilter] = useState<string>('');
  const [validationResultFilter, setValidationResultFilter] = useState<string>('');
  const [tamperDetectedFilter, setTamperDetectedFilter] = useState<boolean | ''>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const loadLogs = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(startDate, endDate);

      const options: LicenseValidationAuditLogListOptions = {
        page: page + 1,
        pageSize,
        validationType:
          validationTypeFilter && validationTypeFilter !== ''
            ? (validationTypeFilter as 'online' | 'offline' | 'cached')
            : undefined,
        validationResult:
          validationResultFilter && validationResultFilter !== ''
            ? (validationResultFilter as 'valid' | 'invalid' | 'expired' | 'tampered' | 'error')
            : undefined,
        tamperDetected: tamperDetectedFilter !== '' ? (tamperDetectedFilter as boolean) : undefined,
        startDate: startDateUTC || undefined,
        endDate: endDateUTC || undefined,
      };

      const result = await LicenseValidationAuditService.getLogs(options);
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    validationTypeFilter,
    validationResultFilter,
    tamperDetectedFilter,
    startDate,
    endDate,
    user?.id,
    showToast,
  ]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = () => {
    loadLogs();
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getResultIcon = (result: string, tamperDetected: boolean) => {
    if (tamperDetected) {
      return <Block color="error" />;
    }
    switch (result) {
      case 'valid':
        return <CheckCircle color="success" />;
      case 'invalid':
      case 'expired':
        return <ErrorIcon color="error" />;
      case 'tampered':
        return <Block color="error" />;
      case 'error':
        return <Warning color="warning" />;
      default:
        return null;
    }
  };

  const getResultColor = (result: string, tamperDetected: boolean): 'success' | 'error' | 'warning' | 'default' => {
    if (tamperDetected) {
      return 'error';
    }
    switch (result) {
      case 'valid':
        return 'success';
      case 'invalid':
      case 'expired':
      case 'tampered':
        return 'error';
      case 'error':
        return 'warning';
      default:
        return 'default';
    }
  };

  const filterFields: FilterField[] = [
    {
      label: 'Validation Type',
      value: validationTypeFilter,
      onChange: (value) => setValidationTypeFilter(value as string),
      type: 'select',
      options: VALIDATION_TYPES,
    },
    {
      label: 'Result',
      value: validationResultFilter,
      onChange: (value) => setValidationResultFilter(value as string),
      type: 'select',
      options: VALIDATION_RESULTS,
    },
    {
      label: 'Tamper Detected',
      value: tamperDetectedFilter === '' ? '' : tamperDetectedFilter ? 'true' : 'false',
      onChange: (value) => {
        if (value === '') {
          setTamperDetectedFilter('');
        } else {
          setTamperDetectedFilter(value === 'true');
        }
      },
      type: 'select',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ],
    },
    {
      label: 'Start Date',
      value: startDate,
      onChange: (value) => setStartDate(value as Date | null),
      type: 'date',
    },
    {
      label: 'End Date',
      value: endDate,
      onChange: (value) => setEndDate(value as Date | null),
      type: 'date',
    },
  ];

  const handleClearFilters = useCallback(() => {
    setValidationTypeFilter('');
    setValidationResultFilter('');
    setTamperDetectedFilter('');
    setStartDate(null);
    setEndDate(null);
  }, []);

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Security />
              <Typography variant="h5">License Validation Audit Logs</Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          <FilterHeader fields={filterFields} onClear={handleClearFilters} />

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>License Key</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Tamper Detected</TableCell>
                  <TableCell>Error Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No validation audit logs found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {log.licenseKey}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.validationType}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getResultIcon(log.validationResult, log.tamperDetected)}
                          <Chip
                            label={log.validationResult}
                            size="small"
                            color={getResultColor(log.validationResult, log.tamperDetected)}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        {log.tamperDetected ? (
                          <Chip label="Yes" size="small" color="error" icon={<Block />} />
                        ) : (
                          <Chip label="No" size="small" color="success" />
                        )}
                      </TableCell>
                      <TableCell>
                        {log.errorMessage ? (
                          <Typography variant="body2" color="error" sx={{ maxWidth: 300 }}>
                            {log.errorMessage}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handlePageSizeChange}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </Paper>
      </Box>

      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default LicenseValidationAuditPage;

