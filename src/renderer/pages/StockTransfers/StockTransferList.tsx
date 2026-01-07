import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
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
  IconButton,
  Chip,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Visibility,
  Refresh,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  LocalShipping,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import {
  StockTransferService,
  StockTransfer,
  StockTransferListOptions,
} from '../../services/stock-transfer.service';
import { LocationService, Location } from '../../services/location.service';
import MainLayout from '../../components/layout/MainLayout';
import FilterHeader, { FilterField } from '../../components/common/FilterHeader';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { usePermission } from '../../hooks/usePermission';

const statusConfig = {
  pending: { color: 'warning' as const, label: 'Pending', icon: <HourglassEmpty fontSize="small" /> },
  in_transit: { color: 'info' as const, label: 'In Transit', icon: <LocalShipping fontSize="small" /> },
  completed: { color: 'success' as const, label: 'Completed', icon: <CheckCircle fontSize="small" /> },
  cancelled: { color: 'error' as const, label: 'Cancelled', icon: <Cancel fontSize="small" /> },
};

const getStatusChip = (status: StockTransfer['status']) => {
  const config = statusConfig[status];
  return (
    <Chip
      icon={config.icon}
      label={config.label}
      size="small"
      color={config.color}
      sx={{ fontSize: '11px', fontWeight: 500 }}
    />
  );
};

interface StockTransferRowProps {
  transfer: StockTransfer;
  onView: (id: number) => void;
}

const StockTransferRow = memo(({ transfer, onView }: StockTransferRowProps) => {
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight="medium">
          {transfer.transferNumber}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {transfer.fromLocation.name}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">
          {transfer.toLocation.name}
        </Typography>
      </TableCell>
      <TableCell>
        {getStatusChip(transfer.status)}
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {transfer.items.length} item(s)
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {formatDate(transfer.requestedAt)}
        </Typography>
      </TableCell>
      <TableCell>
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => onView(transfer.id)}
            sx={{ color: '#1a237e', '&:hover': { backgroundColor: '#e3f2fd' } }}
          >
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
});

StockTransferRow.displayName = 'StockTransferRow';

const StockTransferList: React.FC = () => {
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const { user } = useSelector((state: RootState) => state.auth);
  const canCreate = usePermission('inventory.create');
  const canView = usePermission('inventory.view');

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromLocationFilter, setFromLocationFilter] = useState<number | undefined>(undefined);
  const [toLocationFilter, setToLocationFilter] = useState<number | undefined>(undefined);
  const [locations, setLocations] = useState<Location[]>([]);

  const loadLocations = useCallback(async () => {
    try {
      // Ensure default location exists
      if (user?.id) {
        await LocationService.ensureDefault(user.id);
      }
      const result = await LocationService.getAll(true);
      setLocations(result);
    } catch (error) {
      console.error('Error loading locations', error);
    }
  }, [user?.id]);

  const loadTransfers = useCallback(async () => {
    if (!canView) return;

    setLoading(true);
    try {
      const options: StockTransferListOptions = {
        page: page + 1,
        pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        fromLocationId: fromLocationFilter,
        toLocationId: toLocationFilter,
        sortBy: 'requestedAt',
        sortOrder: 'desc',
      };

      const result = await StockTransferService.getList(options);
      if (result.success && result.transfers) {
        setTransfers(result.transfers);
        setTotal(result.total || 0);
      } else {
        showToast(result.error || 'Failed to load stock transfers', 'error');
      }
    } catch (error) {
      console.error('Error loading stock transfers', error);
      showToast('Failed to load stock transfers', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, fromLocationFilter, toLocationFilter, canView, showToast]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleView = (id: number) => {
    navigate(`/stock-transfers/${id}`);
  };

  const handleCreate = () => {
    navigate('/stock-transfers/new');
  };

  const handleRefresh = () => {
    loadTransfers();
  };

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setFromLocationFilter(undefined);
    setToLocationFilter(undefined);
  }, []);

  const filterFields = useMemo<FilterField[]>(() => [
    {
      type: 'select',
      label: 'Status',
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as string),
      options: [
        { value: 'all', label: 'All' },
        { value: 'pending', label: 'Pending' },
        { value: 'in_transit', label: 'In Transit' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select',
      label: 'From Location',
      value: fromLocationFilter || '',
      onChange: (value) => setFromLocationFilter(value ? Number(value) : undefined),
      options: [
        { value: '', label: 'All' },
        ...locations.map((loc) => ({ value: String(loc.id), label: loc.name })),
      ],
      gridSize: { xs: 12, sm: 6, md: 3 },
    },
    {
      type: 'select',
      label: 'To Location',
      value: toLocationFilter || '',
      onChange: (value) => setToLocationFilter(value ? Number(value) : undefined),
      options: [
        { value: '', label: 'All' },
        ...locations.map((loc) => ({ value: String(loc.id), label: loc.name })),
      ],
      gridSize: { xs: 12, sm: 6, md: 3 },
    },
  ], [statusFilter, fromLocationFilter, toLocationFilter, locations]);

  if (!canView) {
    return (
      <MainLayout>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            You don&apos;t have permission to view stock transfers
          </Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography 
            variant="h4" 
            fontWeight="bold"
            sx={{
              fontSize: { xs: '20px', sm: '24px', md: '28px' },
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Stock Transfers
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
              sx={{
                fontSize: '16px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textTransform: 'none',
                borderRadius: 0,
                borderColor: '#c0c0c0',
                color: '#1a237e',
                padding: '8px 20px',
                minHeight: '44px',
                '&:hover': {
                  borderColor: '#1a237e',
                  backgroundColor: '#f5f5f5',
                },
                '&:disabled': {
                  borderColor: '#e0e0e0',
                  color: '#9e9e9e',
                },
              }}
            >
              Refresh
            </Button>
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleCreate}
                sx={{ backgroundColor: '#1a237e', '&:hover': { backgroundColor: '#283593' } }}
              >
                New Transfer
              </Button>
            )}
          </Box>
        </Box>

        <FilterHeader
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by transfer number or notes..."
          onClear={handleClearFilters}
          fields={filterFields}
        />

        <TableContainer component={Paper} sx={{ borderRadius: 0, border: '1px solid #c0c0c0', boxShadow: 'none', backgroundColor: '#ffffff' }}>
          <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Transfer Number</TableCell>
                  <TableCell>From Location</TableCell>
                  <TableCell>To Location</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell>Requested Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No stock transfers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer) => (
                    <StockTransferRow
                      key={transfer.id}
                      transfer={transfer}
                      onView={handleView}
                    />
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={pageSize}
              onRowsPerPageChange={handlePageSizeChange}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </TableContainer>

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default StockTransferList;

