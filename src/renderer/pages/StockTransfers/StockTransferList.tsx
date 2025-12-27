import React, { useState, useEffect, useCallback, memo } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
import FilterHeader from '../../components/common/FilterHeader';
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
  const { showToast } = useToast();
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

  if (!canView) {
    return (
      <MainLayout>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            You don't have permission to view stock transfers
          </Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            Stock Transfers
          </Typography>
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

        <Paper sx={{ mb: 2 }}>
          <FilterHeader
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by transfer number or notes..."
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_transit">In Transit</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>From Location</InputLabel>
                <Select
                  value={fromLocationFilter || ''}
                  label="From Location"
                  onChange={(e) => setFromLocationFilter(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <MenuItem value="">All</MenuItem>
                  {locations.map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>To Location</InputLabel>
                <Select
                  value={toLocationFilter || ''}
                  label="To Location"
                  onChange={(e) => setToLocationFilter(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <MenuItem value="">All</MenuItem>
                  {locations.map((loc) => (
                    <MenuItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} size="small">
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>
          </FilterHeader>

          <TableContainer>
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

        <Toast />
      </Box>
    </MainLayout>
  );
};

export default StockTransferList;

