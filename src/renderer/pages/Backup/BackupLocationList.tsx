import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Typography,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Refresh,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  BackupLocationService,
  BackupLocation,
} from '../../services/backup-location.service';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePermission } from '../../hooks/usePermission';

const BackupLocationList: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const canManage = usePermission('backup.manage');

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<BackupLocation[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<BackupLocation | null>(null);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await BackupLocationService.getLocations({
        page: page + 1,
        pageSize,
      });

      if (result.success && result.data) {
        setLocations(result.data);
        setTotal(result.pagination?.total || 0);
      } else {
        showToast(result.error || 'Failed to load locations', 'error');
      }
    } catch (error) {
      showToast('An error occurred while loading locations', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showToast]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleDelete = useCallback((location: BackupLocation) => {
    setDeletingLocation(location);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingLocation) return;

    try {
      const result = await BackupLocationService.deleteLocation(deletingLocation.id);
      if (result.success) {
        showToast('Location deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setDeletingLocation(null);
        loadLocations();
      } else {
        showToast(result.error || 'Failed to delete location', 'error');
      }
    } catch (error) {
      showToast('An error occurred while deleting location', 'error');
    }
  }, [deletingLocation, showToast, loadLocations]);

  const handlePageChange = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  if (!canManage) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Typography>You don't have permission to manage backup locations.</Typography>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <Typography sx={titleTypographySx}>Backup Locations</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadLocations}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                // TODO: Navigate to form or open dialog
                showToast('Location form coming soon', 'info');
              }}
            >
              Add Location
            </Button>
          </Box>
        </Box>

        <Paper>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Path</TableCell>
                      <TableCell>Priority</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {locations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography>No locations found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      locations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell>
                            <Typography>{location.name}</Typography>
                          </TableCell>
                          <TableCell>
                            {BackupLocationService.getLocationTypeDisplayName(location.type)}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {location.path}
                            </Typography>
                          </TableCell>
                          <TableCell>{location.priority}</TableCell>
                          <TableCell>
                            {location.isActive ? (
                              <Chip label="Active" color="success" size="small" />
                            ) : (
                              <Chip label="Inactive" color="default" size="small" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton
                                onClick={() => {
                                  // TODO: Navigate to edit form
                                  showToast('Edit form coming soon', 'info');
                                }}
                                size="small"
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton onClick={() => handleDelete(location)} size="small" color="error">
                                <Delete />
                              </IconButton>
                            </Tooltip>
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
                rowsPerPageOptions={[10, 25, 50]}
              />
            </>
          )}
        </Paper>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          title="Delete Location"
          message={`Are you sure you want to delete "${deletingLocation?.name}"? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteDialogOpen(false);
            setDeletingLocation(null);
          }}
        />

        <Toast toast={toast} onClose={hideToast} />
      </Box>
    </MainLayout>
  );
};

export default BackupLocationList;

