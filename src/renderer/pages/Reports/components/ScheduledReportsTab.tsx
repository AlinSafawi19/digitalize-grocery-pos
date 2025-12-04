import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip,
  TablePagination,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Schedule,
  FolderOpen,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../../store';
import {
  ScheduledReportService,
  ScheduledReport,
} from '../../../services/report.service';
import { ROUTES } from '../../../utils/constants';
import { formatDateTime } from '../../../utils/dateUtils';
import { useToast } from '../../../hooks/useToast';
import Toast from '../../../components/common/Toast';
import ConfirmDialog from '../../../components/common/ConfirmDialog';

const SCHEDULE_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const REPORT_TYPES = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'financial', label: 'Financial Report' },
  { value: 'product', label: 'Product Performance Report' },
  { value: 'purchase', label: 'Purchase Order Report' },
  { value: 'supplier', label: 'Supplier Performance Report' },
];

// Create lookup maps for O(1) access instead of O(n) array.find()
const SCHEDULE_TYPES_MAP = new Map(SCHEDULE_TYPES.map(t => [t.value, t.label]));
const REPORT_TYPES_MAP = new Map(REPORT_TYPES.map(t => [t.value, t.label]));

const ScheduledReportsTab: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadScheduledReports = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const result = await ScheduledReportService.getScheduledReports(user.id, {
        page: page + 1, // Convert from 0-based to 1-based
        pageSize,
      });
      if (result.success && result.data) {
        setScheduledReports(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        showToast(result.error || 'Failed to load scheduled reports', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, pageSize, showToast]);

  useEffect(() => {
    if (user?.id) {
      loadScheduledReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page, pageSize]);

  const handleDeleteClick = useCallback((reportId: number) => {
    setReportToDelete(reportId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    setDeleteDialogOpen(false);
    setReportToDelete(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!user?.id || !reportToDelete) return;

    setDeleting(true);
    try {
      const result = await ScheduledReportService.deleteScheduledReport(reportToDelete, user.id);
      if (result.success) {
        showToast('Scheduled report deleted successfully', 'success');
        loadScheduledReports();
        handleDeleteDialogClose();
      } else {
        showToast(result.error || 'Failed to delete scheduled report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setDeleting(false);
    }
  }, [user?.id, reportToDelete, loadScheduledReports, showToast, handleDeleteDialogClose]);

  const handleExecute = useCallback(async (reportId: number) => {
    if (!user?.id) return;

    try {
      const result = await ScheduledReportService.executeScheduledReport(reportId, user.id);
      if (result.success) {
        showToast('Report executed successfully!', 'success');
        loadScheduledReports();
      } else {
        showToast(result.error || 'Failed to execute scheduled report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  }, [user?.id, loadScheduledReports, showToast]);

  const handleToggleActive = useCallback(async (report: ScheduledReport) => {
    if (!user?.id) return;

    try {
      const result = await ScheduledReportService.updateScheduledReport(
        report.id,
        { isActive: !report.isActive },
        user.id
      );
      if (result.success) {
        showToast(`Scheduled report ${!report.isActive ? 'activated' : 'deactivated'} successfully`, 'success');
        loadScheduledReports();
      } else {
        showToast(result.error || 'Failed to update scheduled report', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  }, [user?.id, loadScheduledReports, showToast]);

  const handleOpenReportsFolder = useCallback(async () => {
    try {
      const result = await ScheduledReportService.openReportsFolder();
      if (!result.success) {
        showToast(result.error || 'Failed to open reports folder', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  }, [showToast]);

  const formatNextRun = useCallback((nextRunAt: Date | null) => {
    if (!nextRunAt) return 'N/A';
    return formatDateTime(nextRunAt);
  }, []);

  const formatLastRun = useCallback((lastRunAt: Date | null) => {
    if (!lastRunAt) return 'Never';
    return formatDateTime(lastRunAt);
  }, []);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 4,
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
  }), []);

  const buttonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
  }), []);

  const outlinedButtonSx = useMemo(() => ({
    ...buttonSx,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), [buttonSx]);

  const containedButtonSx = useMemo(() => ({
    ...buttonSx,
    backgroundColor: '#1a237e',
    '&:hover': {
      backgroundColor: '#283593',
    },
  }), [buttonSx]);

  const paperSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tableSx = useMemo(() => ({
    '& .MuiTableCell-head': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
      borderBottom: '2px solid #c0c0c0',
    },
    '& .MuiTableCell-body': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const tablePaginationSx = useMemo(() => ({
    borderTop: '1px solid #c0c0c0',
    '& .MuiTablePagination-toolbar': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-displayedRows': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const iconButtonSx = useMemo(() => ({
    fontSize: '18px',
  }), []);

  const bodyTableCellSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const headerTypographySx = useMemo(() => ({
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    py: 3,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const chipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleEditReport = useCallback((reportId: number) => {
    navigate(`${ROUTES.SCHEDULED_REPORTS}/edit/${reportId}`);
  }, [navigate]);

  const handleNewReportClick = useCallback(() => {
    navigate(ROUTES.SCHEDULED_REPORTS_NEW);
  }, [navigate]);

  const buttonsBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 2,
  }), []);

  // Memoize row component to prevent unnecessary re-renders
  const ReportRow = memo(({ 
    report, 
    onExecute, 
    onEdit, 
    onToggleActive, 
    onDelete,
    bodyCellSx,
    chipSxProp,
    iconBtnSx,
    formatNextRunFn,
    formatLastRunFn
  }: { 
    report: ScheduledReport;
    onExecute: (id: number) => void;
    onEdit: (id: number) => void;
    onToggleActive: (report: ScheduledReport) => void;
    onDelete: (id: number) => void;
    bodyCellSx: object;
    chipSxProp: object;
    iconBtnSx: object;
    formatNextRunFn: (nextRunAt: Date | null) => string;
    formatLastRunFn: (lastRunAt: Date | null) => string;
  }) => {
    const handleExecuteClick = useCallback(() => {
      onExecute(report.id);
    }, [report.id, onExecute]);

    const handleEditClick = useCallback(() => {
      onEdit(report.id);
    }, [report.id, onEdit]);

    const handleToggleActiveClick = useCallback(() => {
      onToggleActive(report);
    }, [report, onToggleActive]);

    const handleDeleteClick = useCallback(() => {
      onDelete(report.id);
    }, [report.id, onDelete]);

    const reportTypeLabel = REPORT_TYPES_MAP.get(report.reportType) || report.reportType;
    const scheduleTypeLabel = SCHEDULE_TYPES_MAP.get(report.scheduleType) || report.scheduleType;
    const scheduleText = report.scheduleConfig.time 
      ? `${scheduleTypeLabel} at ${report.scheduleConfig.time}`
      : scheduleTypeLabel;

    return (
      <TableRow>
        <TableCell sx={bodyCellSx}>{report.name}</TableCell>
        <TableCell sx={bodyCellSx}>{reportTypeLabel}</TableCell>
        <TableCell sx={bodyCellSx}>{scheduleText}</TableCell>
        <TableCell sx={bodyCellSx}>{report.exportFormat.toUpperCase()}</TableCell>
        <TableCell>
          <Chip
            label={report.isActive ? 'Active' : 'Inactive'}
            color={report.isActive ? 'success' : 'default'}
            size="small"
            sx={chipSxProp}
          />
        </TableCell>
        <TableCell sx={bodyCellSx}>{formatNextRunFn(report.nextRunAt)}</TableCell>
        <TableCell sx={bodyCellSx}>{formatLastRunFn(report.lastRunAt)}</TableCell>
        <TableCell align="right">
          <Tooltip title="Execute Now">
            <IconButton
              size="small"
              onClick={handleExecuteClick}
              color="primary"
              sx={iconBtnSx}
            >
              <PlayArrow />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={handleEditClick}
              color="primary"
              sx={iconBtnSx}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Active">
            <IconButton
              size="small"
              onClick={handleToggleActiveClick}
              color={report.isActive ? 'warning' : 'success'}
              sx={iconBtnSx}
            >
              <Schedule />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={handleDeleteClick}
              color="error"
              sx={iconBtnSx}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
    );
  });

  ReportRow.displayName = 'ReportRow';

  if (loading) {
    return (
      <Box sx={loadingBoxSx}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={headerBoxSx}>
        <Typography variant="h6" sx={headerTypographySx}>Scheduled Reports</Typography>
        <Box sx={buttonsBoxSx}>
          <Button
            variant="outlined"
            startIcon={<FolderOpen />}
            onClick={handleOpenReportsFolder}
            sx={outlinedButtonSx}
          >
            Open Reports Folder
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleNewReportClick}
            sx={containedButtonSx}
          >
            Schedule New Report
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper} sx={paperSx}>
        <Table sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Report Type</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Export Format</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scheduledReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="text.secondary" sx={emptyStateTypographySx}>
                    No scheduled reports. Click &quot;Schedule New Report&quot; to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              scheduledReports.map((report) => (
                <ReportRow 
                  key={report.id} 
                  report={report}
                  onExecute={handleExecute}
                  onEdit={handleEditReport}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDeleteClick}
                  bodyCellSx={bodyTableCellSx}
                  chipSxProp={chipSx}
                  iconBtnSx={iconButtonSx}
                  formatNextRunFn={formatNextRun}
                  formatLastRunFn={formatLastRun}
                />
              ))
            )}
          </TableBody>
        </Table>
        {pagination && (
          <TablePagination
            component="div"
            count={pagination.total}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handlePageSizeChange}
            rowsPerPageOptions={[10, 20, 50, 100]}
            sx={tablePaginationSx}
          />
        )}
      </TableContainer>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Scheduled Report"
        message="Are you sure you want to delete this scheduled report? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={handleDeleteDialogClose}
        confirmColor="error"
        loading={deleting}
      />
      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
};

export default ScheduledReportsTab;

