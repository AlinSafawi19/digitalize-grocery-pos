import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  ChipProps,
  IconButton,
  Menu,
  MenuItem,
  Button,
  CircularProgress,
  Grid,
  Checkbox,
} from '@mui/material';
import {
  CheckCircle,
  Delete as DeleteIcon,
  CheckCircleOutline,
  Home,
  Menu as MenuIcon,
  Dashboard,
  Inventory,
  Category,
  LocalShipping,
  Receipt,
  Warehouse,
  ShoppingCart as ShoppingCartIcon,
  LocalOffer,
  Assessment,
  Analytics,
  History,
  Settings,
  Backup,
  ChatBubble as MessageCircle,
  VpnKey,
  Visibility,
  People,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { ROUTES } from '../../utils/constants';
import {
  NotificationService,
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationListOptions,
} from '../../services/notification.service';
import { useRoutePermission } from '../../hooks/usePermission';
import { formatDateTime, convertDateRangeToUTC } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FilterHeader from '../../components/common/FilterHeader';

// Helper functions will be memoized inside the component

export default function NotificationsPage() {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const { toast, showToast, hideToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState<NotificationType | 'all'>('all');
  const [filterIsRead, setFilterIsRead] = useState<'all' | 'read' | 'unread'>('all');
  const [filterPriority, setFilterPriority] = useState<NotificationPriority | 'all'>('all');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Permission checks for navigation menu
  const canAccessProducts = useRoutePermission(ROUTES.PRODUCTS);
  const canAccessCategories = useRoutePermission(ROUTES.CATEGORIES);
  const canAccessSuppliers = useRoutePermission(ROUTES.SUPPLIERS);
  // Cashiers page is only accessible by main user (ID = 1)
  const canAccessCashiers = user?.id === 1;
  const canAccessTransactions = useRoutePermission(ROUTES.TRANSACTIONS);
  const canAccessInventory = useRoutePermission(ROUTES.INVENTORY);
  const canAccessPurchaseOrders = useRoutePermission(ROUTES.PURCHASE_ORDERS);
  const canAccessPricing = useRoutePermission(ROUTES.PRICING_RULES);
  const canAccessReports = useRoutePermission(ROUTES.REPORTS);
  const canAccessAnalytics = useRoutePermission(ROUTES.ANALYTICS);
  const canAccessSettings = useRoutePermission(ROUTES.SETTINGS);

  // Memoize helper functions
  const getNotificationColor = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  }, []);

  // Extract report file path from notification message
  const extractReportPath = useCallback((message: string): string | null => {
    const match = message.match(/REPORT_PATH:(.+)$/);
    return match ? match[1] : null;
  }, []);

  // Get display message without the path marker
  const getDisplayMessage = useCallback((message: string): string => {
    return message.split('|REPORT_PATH:')[0];
  }, []);

  // Check if notification is a report notification
  const isReportNotification = useCallback((notification: Notification): boolean => {
    return notification.title === 'Scheduled Report Generated' && 
           notification.message.includes('REPORT_PATH:');
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Convert date range from Beirut timezone to UTC for API
      const { startDate: startDateUTC, endDate: endDateUTC } = convertDateRangeToUTC(startDate, endDate);
      
      const options: NotificationListOptions = {
        page: page + 1,
        pageSize,
        type: filterType !== 'all' ? filterType : undefined,
        isRead: filterIsRead === 'all' ? undefined : filterIsRead === 'read',
        priority: filterPriority !== 'all' ? (filterPriority as NotificationPriority) : undefined,
        startDate: startDateUTC || undefined,
        endDate: endDateUTC || undefined,
      };

      const result = await NotificationService.getNotifications(options, user.id);
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
        setTotal(result.total || 0);
        setUnreadCount(result.unreadCount || 0);
      } else {
        showToast(result.error || 'Failed to load notifications', 'error');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      showToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, page, pageSize, filterType, filterIsRead, filterPriority, startDate, endDate, showToast]);

  useEffect(() => {
    loadNotifications();
    // Clear selection when filters or page change
    setSelectedNotifications(new Set());
  }, [loadNotifications]);

  // Reset page when total changes and current page is invalid (only when not loading to prevent flickering)
  useEffect(() => {
    if (loading) return;
    
    if (total === 0 && page > 0) {
      setPage(0);
      return;
    }
    
    if (total > 0) {
      const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      if (page > maxPage) {
        setPage(0);
      }
    }
  }, [total, pageSize, page, loading]);

  const handleMarkAsRead = useCallback(async (notification: Notification) => {
    if (!user?.id || notification.isRead) return;

    try {
      const result = await NotificationService.markNotificationRead(notification.id, user.id);
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        showToast('Notification marked as read', 'success');
      } else {
        showToast(result.error || 'Failed to mark notification as read', 'error');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      showToast('Failed to mark notification as read', 'error');
    }
  }, [user?.id, showToast]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const result = await NotificationService.markAllNotificationsRead(undefined, user.id);
      if (result.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        showToast('All notifications marked as read', 'success');
      } else {
        showToast(result.error || 'Failed to mark all as read', 'error');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      showToast('Failed to mark all as read', 'error');
    }
  }, [user?.id, showToast]);

  const handleDelete = useCallback((notification: Notification) => {
    setNotificationToDelete(notification);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!user?.id || !notificationToDelete) return;

    setDeleting(true);
    try {
      const result = await NotificationService.deleteNotification(notificationToDelete.id, user.id);
      if (result.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationToDelete.id));
        setTotal((prev) => prev - 1);
        if (!notificationToDelete.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        showToast('Notification deleted successfully', 'success');
      } else {
        showToast(result.error || 'Failed to delete notification', 'error');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      showToast('Failed to delete notification', 'error');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setNotificationToDelete(null);
    }
  }, [user?.id, notificationToDelete, showToast]);

  const handleDeleteDialogClose = useCallback(() => {
    if (!deleting) {
      setDeleteDialogOpen(false);
      setNotificationToDelete(null);
    }
  }, [deleting]);

  const handleSelectNotification = useCallback((notificationId: number) => {
    setSelectedNotifications((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedNotifications((prev) => {
      if (prev.size === notifications.length) {
        return new Set();
      } else {
        return new Set(notifications.map((n) => n.id));
      }
    });
  }, [notifications]);

  const handleBulkDelete = useCallback(() => {
    if (selectedNotifications.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedNotifications.size]);

  const confirmBulkDelete = useCallback(async () => {
    if (!user?.id || selectedNotifications.size === 0) return;

    const selectedIds = Array.from(selectedNotifications);
    let successCount = 0;
    let unreadDeletedCount = 0;

    setDeleting(true);
    try {
      // Delete notifications one by one
      for (const id of selectedIds) {
        const notification = notifications.find((n) => n.id === id);
        if (!notification) continue;

        const result = await NotificationService.deleteNotification(id, user.id);
        if (result.success) {
          successCount++;
          if (!notification.isRead) {
            unreadDeletedCount++;
          }
        }
      }

      // Update UI
      setNotifications((prev) => prev.filter((n) => !selectedNotifications.has(n.id)));
      setTotal((prev) => prev - successCount);
      setUnreadCount((prev) => Math.max(0, prev - unreadDeletedCount));
      setSelectedNotifications(new Set());
      showToast(`Successfully deleted ${successCount} notification${successCount !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Error deleting notifications:', error);
      showToast('Failed to delete notifications', 'error');
    } finally {
      setDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }, [user?.id, selectedNotifications, notifications, showToast]);

  const handleBulkDeleteDialogClose = useCallback(() => {
    if (!deleting) {
      setBulkDeleteDialogOpen(false);
    }
  }, [deleting]);

  const handleViewReport = useCallback(async (notification: Notification) => {
    const reportPath = extractReportPath(notification.message);
    if (!reportPath) return;

    try {
      // Open the reports folder first (this will show the file in the folder)
      await window.electron.ipcRenderer.invoke('reports:openReportsFolder');
      
      // Then open the file itself
      await window.electron.ipcRenderer.invoke('file:open', reportPath);
    } catch (error) {
      console.error('Error opening report:', error);
      showToast('Failed to open report', 'error');
    }
  }, [extractReportPath, showToast]);

  const handleNavMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  }, []);

  const handleNavMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  const handleNavigateToDashboard = useCallback(() => {
    navigate(ROUTES.DASHBOARD);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToProducts = useCallback(() => {
    navigate(ROUTES.PRODUCTS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToCategories = useCallback(() => {
    navigate(ROUTES.CATEGORIES);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToSuppliers = useCallback(() => {
    navigate(ROUTES.SUPPLIERS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToCashiers = useCallback(() => {
    navigate(ROUTES.CASHIERS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToTransactions = useCallback(() => {
    navigate(ROUTES.TRANSACTIONS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToInventory = useCallback(() => {
    navigate(ROUTES.INVENTORY);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToPurchaseOrders = useCallback(() => {
    navigate(ROUTES.PURCHASE_ORDERS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToPricingRules = useCallback(() => {
    navigate(ROUTES.PRICING_RULES);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToReports = useCallback(() => {
    navigate(ROUTES.REPORTS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToAnalytics = useCallback(() => {
    navigate(ROUTES.ANALYTICS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose]);

  const handleNavigateToLogs = useCallback(() => {
    // Only main user (ID = 1) can access logs page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED);
      handleNavMenuClose();
      return;
    }
    navigate(ROUTES.LOGS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose, user?.id]);

  const handleNavigateToSettings = useCallback(() => {
    // Only main user (ID = 1) can access settings page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED);
      handleNavMenuClose();
      return;
    }
    navigate(ROUTES.SETTINGS);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose, user?.id]);

  const handleNavigateToBackup = useCallback(() => {
    // Only main user (ID = 1) can access backup page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED);
      handleNavMenuClose();
      return;
    }
    navigate(ROUTES.BACKUP);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose, user?.id]);

  const handleNavigateToLicense = useCallback(() => {
    // Only main user (ID = 1) can access license page
    if (user?.id !== 1) {
      navigate(ROUTES.ACCESS_DENIED);
      handleNavMenuClose();
      return;
    }
    navigate(ROUTES.LICENSE);
    handleNavMenuClose();
  }, [navigate, handleNavMenuClose, user?.id]);

  const handleNavigateToDashboardDirect = useCallback(() => {
    navigate(ROUTES.DASHBOARD);
  }, [navigate]);

  // FilterHeader handlers - convert to FilterHeader onChange signature
  const handleFilterTypeChange = useCallback((value: unknown) => {
    setFilterType(value as NotificationType | 'all');
    setPage(0);
  }, []);

  const handleFilterIsReadChange = useCallback((value: unknown) => {
    setFilterIsRead(value as 'all' | 'read' | 'unread');
    setPage(0);
  }, []);

  const handleFilterPriorityChange = useCallback((value: unknown) => {
    setFilterPriority(value as NotificationPriority | 'all');
    setPage(0);
  }, []);

  const handleStartDateChange = useCallback((value: unknown) => {
    setStartDate(value as Date | null);
    setPage(0);
  }, []);

  const handleEndDateChange = useCallback((value: unknown) => {
    setEndDate(value as Date | null);
    setPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterType('all');
    setFilterIsRead('all');
    setFilterPriority('all');
    setStartDate(null);
    setEndDate(null);
    setPage(0);
  }, []);

  const handleViewMessage = useCallback((notification: Notification) => {
    showToast(`${notification.title}\n\n${getDisplayMessage(notification.message)}`, 'info');
  }, [showToast, getDisplayMessage]);

  const handleChangePage = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangePageSize = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Memoize sx prop objects to avoid recreation on every render
  const containerBoxSx = useMemo(() => ({
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  }), []);

  const headerPaperSx = useMemo(() => ({
    p: 2,
    borderRadius: 0,
    borderBottom: '1px solid #c0c0c0',
    backgroundColor: '#ffffff',
    boxShadow: 'none',
  }), []);

  const homeIconButtonSx = useMemo(() => ({
    mr: 1,
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#e3f2fd',
    },
  }), []);

  const menuIconButtonSx = useMemo(() => ({
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#e3f2fd',
    },
  }), []);

  const menuPaperSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    mt: 1,
  }), []);

  const menuItemSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 'bold',
  }), []);

  const mainContentBoxSx = useMemo(() => ({
    flex: 1,
    overflow: 'auto',
    p: 3,
  }), []);

  const actionsBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
    flexWrap: 'wrap',
    gap: 2,
  }), []);

  const bulkDeleteButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#d32f2f',
    padding: '6px 16px',
    '&:hover': {
      backgroundColor: '#c62828',
    },
  }), []);

  const markAllReadButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    padding: '6px 16px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);


  // Memoize FilterHeader fields configuration
  const filterFields = useMemo(() => [
    {
      type: 'select' as const,
      label: 'Type',
      value: filterType,
      onChange: handleFilterTypeChange,
      options: [
        { value: 'all', label: 'All Types' },
        { value: 'low_stock', label: 'Low Stock' },
        { value: 'expiry_warning', label: 'Expiry Warning' },
        { value: 'system_error', label: 'System Error' },
        { value: 'system_warning', label: 'System Warning' },
        { value: 'transaction', label: 'Transaction' },
        { value: 'backup_completion', label: 'Backup Completion' },
        { value: 'backup_failed', label: 'Backup Failed' },
        { value: 'price_change', label: 'Price Change' },
        { value: 'stock_adjustment', label: 'Stock Adjustment' },
        { value: 'purchase_order', label: 'Purchase Order' },
        { value: 'payment_due', label: 'Payment Due' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Status',
      value: filterIsRead,
      onChange: handleFilterIsReadChange,
      options: [
        { value: 'all', label: 'All' },
        { value: 'unread', label: 'Unread' },
        { value: 'read', label: 'Read' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'select' as const,
      label: 'Priority',
      value: filterPriority,
      onChange: handleFilterPriorityChange,
      options: [
        { value: 'all', label: 'All Priorities' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'high', label: 'High' },
        { value: 'normal', label: 'Normal' },
        { value: 'low', label: 'Low' },
      ],
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'date' as const,
      label: 'Start Date',
      value: startDate,
      onChange: handleStartDateChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
    {
      type: 'date' as const,
      label: 'End Date',
      value: endDate,
      onChange: handleEndDateChange,
      gridSize: { xs: 12, sm: 6, md: 2 },
    },
  ], [filterType, filterIsRead, filterPriority, startDate, endDate, handleFilterTypeChange, handleFilterIsReadChange, handleFilterPriorityChange, handleStartDateChange, handleEndDateChange]);

  const tableContainerSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const tableSx = useMemo(() => ({
    '& .MuiTableCell-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderColor: '#e0e0e0',
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
    },
    '& .MuiTableRow-root:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const checkboxSx = useMemo(() => ({
    color: '#1a237e',
    '&.Mui-checked': {
      color: '#1a237e',
    },
  }), []);

  const loadingCellSx = useMemo(() => ({
    py: 4,
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const getRowSx = useCallback((isRead: boolean) => ({
    backgroundColor: isRead ? 'transparent' : '#e3f2fd',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const typeTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const getTitleTypographySx = useCallback((isRead: boolean) => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: isRead ? 400 : 600,
  }), []);

  const messageBoxSx = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 0.5,
  }), []);

  const messageRowBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  }), []);

  const messageTypographySx = useMemo(() => ({
    maxWidth: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const viewMessageIconButtonSx = useMemo(() => ({
    color: '#1a237e',
    width: '48px',
    height: '48px',
    padding: '8px',
    '&:hover': {
      backgroundColor: '#e3f2fd',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const viewReportButtonSx = useMemo(() => ({
    alignSelf: 'flex-start',
    mt: 0.5,
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    borderColor: '#c0c0c0',
    color: '#1a237e',
    padding: '8px 16px',
    minHeight: '40px',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const priorityChipSx = useMemo(() => ({
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const dateTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const actionsCellBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 0.5,
    justifyContent: 'flex-end',
  }), []);

  const markReadIconButtonSx = useMemo(() => ({
    color: '#1a237e',
    width: '48px',
    height: '48px',
    padding: '8px',
    '&:hover': {
      backgroundColor: '#e3f2fd',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const deleteIconButtonSx = useMemo(() => ({
    color: '#d32f2f',
    width: '48px',
    height: '48px',
    padding: '8px',
    '&:hover': {
      backgroundColor: '#ffebee',
    },
    '& .MuiSvgIcon-root': {
      fontSize: '28px',
    },
  }), []);

  const paginationSx = useMemo(() => ({
    '& .MuiTablePagination-toolbar': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const footerPaperSx = useMemo(() => ({
    position: 'sticky',
    bottom: 0,
    width: '100%',
    backgroundColor: '#f5f5f5',
    color: '#333333',
    py: 1.5,
    px: 3,
    zIndex: 1000,
    borderTop: '1px solid #c0c0c0',
    borderRadius: 0,
    boxShadow: 'none',
  }), []);

  const footerBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  }), []);

  const footerLabelTypographySx = useMemo(() => ({
    fontWeight: 500,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const footerPhoneBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  }), []);

  const footerPhoneLinkSx = useMemo(() => ({
    color: 'inherit',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '&:hover': {
      textDecoration: 'underline',
    },
  }), []);

  return (
    <Box sx={containerBoxSx}>
      {/* Header */}
      <Paper sx={headerPaperSx}>
        <Grid container spacing={2} alignItems="center">
          {/* Navigation Buttons */}
          <Grid item xs="auto">
            <IconButton
              onClick={handleNavigateToDashboardDirect}
              color="primary"
              title="Go to Dashboard"
              sx={homeIconButtonSx}
            >
              <Home sx={{ fontSize: '20px' }} />
            </IconButton>
            <IconButton
              onClick={handleNavMenuOpen}
              color="primary"
              title="Navigation Menu"
              sx={menuIconButtonSx}
            >
              <MenuIcon sx={{ fontSize: '20px' }} />
            </IconButton>
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={handleNavMenuClose}
              PaperProps={{
                sx: menuPaperSx,
              }}
            >
              <MenuItem onClick={handleNavigateToDashboard} sx={menuItemSx}>
                <Dashboard sx={{ mr: 1, fontSize: '18px' }} />
                Dashboard
              </MenuItem>
              {canAccessProducts && (
                <MenuItem onClick={handleNavigateToProducts} sx={menuItemSx}>
                  <Inventory sx={{ mr: 1, fontSize: '18px' }} />
                  Products
                </MenuItem>
              )}
              {canAccessCategories && (
                <MenuItem onClick={handleNavigateToCategories} sx={menuItemSx}>
                  <Category sx={{ mr: 1, fontSize: '18px' }} />
                  Categories
                </MenuItem>
              )}
              {canAccessSuppliers && (
                <MenuItem onClick={handleNavigateToSuppliers} sx={menuItemSx}>
                  <LocalShipping sx={{ mr: 1, fontSize: '18px' }} />
                  Suppliers
                </MenuItem>
              )}
              {canAccessCashiers && (
                <MenuItem onClick={handleNavigateToCashiers} sx={menuItemSx}>
                  <People sx={{ mr: 1, fontSize: '18px' }} />
                  Cashiers
                </MenuItem>
              )}
              {canAccessTransactions && (
                <MenuItem onClick={handleNavigateToTransactions} sx={menuItemSx}>
                  <Receipt sx={{ mr: 1, fontSize: '18px' }} />
                  Transactions
                </MenuItem>
              )}
              {canAccessInventory && (
                <MenuItem onClick={handleNavigateToInventory} sx={menuItemSx}>
                  <Warehouse sx={{ mr: 1, fontSize: '18px' }} />
                  Inventory
                </MenuItem>
              )}
              {canAccessPurchaseOrders && (
                <MenuItem onClick={handleNavigateToPurchaseOrders} sx={menuItemSx}>
                  <ShoppingCartIcon sx={{ mr: 1, fontSize: '18px' }} />
                  Purchase Orders
                </MenuItem>
              )}
              {canAccessPricing && (
                <MenuItem onClick={handleNavigateToPricingRules} sx={menuItemSx}>
                  <LocalOffer sx={{ mr: 1, fontSize: '18px' }} />
                  Pricing
                </MenuItem>
              )}
              {canAccessReports && (
                <MenuItem onClick={handleNavigateToReports} sx={menuItemSx}>
                  <Assessment sx={{ mr: 1, fontSize: '18px' }} />
                  Reports
                </MenuItem>
              )}
              {canAccessAnalytics && (
                <MenuItem onClick={handleNavigateToAnalytics} sx={menuItemSx}>
                  <Analytics sx={{ mr: 1, fontSize: '18px' }} />
                  Analytics
                </MenuItem>
              )}
              {user?.id === 1 && (
                <MenuItem onClick={handleNavigateToLogs} sx={menuItemSx}>
                  <History sx={{ mr: 1, fontSize: '18px' }} />
                  Logs
                </MenuItem>
              )}
              {canAccessSettings && (
                <MenuItem onClick={handleNavigateToSettings} sx={menuItemSx}>
                  <Settings sx={{ mr: 1, fontSize: '18px' }} />
                  Settings
                </MenuItem>
              )}
              {user?.id === 1 && (
                <MenuItem onClick={handleNavigateToBackup} sx={menuItemSx}>
                  <Backup sx={{ mr: 1, fontSize: '18px' }} />
                  Backup and Restore
                </MenuItem>
              )}
              {user?.id === 1 && (
                <MenuItem onClick={handleNavigateToLicense} sx={menuItemSx}>
                  <VpnKey sx={{ mr: 1, fontSize: '18px' }} />
                  License
                </MenuItem>
              )}
            </Menu>
          </Grid>
          <Grid item xs>
            <Typography variant="h5" sx={titleTypographySx}>
              Notifications
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content */}
      <Box sx={mainContentBoxSx}>
        <Box sx={actionsBoxSx}>
          <Box>
            {selectedNotifications.size > 0 && (
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon sx={{ fontSize: '18px' }} />}
                onClick={handleBulkDelete}
                sx={bulkDeleteButtonSx}
              >
                Delete Selected ({selectedNotifications.size})
              </Button>
            )}
          </Box>
          <Box>
            {unreadCount > 0 && (
              <Button
                variant="outlined"
                startIcon={<CheckCircleOutline sx={{ fontSize: '18px' }} />}
                onClick={handleMarkAllAsRead}
                sx={markAllReadButtonSx}
              >
                Mark All as Read ({unreadCount})
              </Button>
            )}
          </Box>
        </Box>

        <FilterHeader
          onClear={handleClearFilters}
          fields={filterFields}
        />

        <TableContainer component={Paper} sx={tableContainerSx}>
        <Table sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedNotifications.size > 0 && selectedNotifications.size < notifications.length}
                  checked={notifications.length > 0 && selectedNotifications.size === notifications.length}
                  onChange={handleSelectAll}
                  sx={checkboxSx}
                />
              </TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell width="50px">Status</TableCell>
              <TableCell>Date</TableCell>
              <TableCell width="50px" align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={loadingCellSx}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={loadingCellSx}>
                  <Typography variant="body2" color="text.secondary" sx={emptyStateTypographySx}>
                    No notifications found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((notification) => {
                const priorityColor = getNotificationColor(notification.priority);
                return (
                  <TableRow key={notification.id} sx={getRowSx(notification.isRead)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedNotifications.has(notification.id)}
                        onChange={() => handleSelectNotification(notification.id)}
                        sx={checkboxSx}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={typeTypographySx}>
                        {notification.type}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={getTitleTypographySx(notification.isRead)}>
                        {notification.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={messageBoxSx}>
                        <Box sx={messageRowBoxSx}>
                          <Typography variant="body2" color="text.secondary" sx={messageTypographySx}>
                            {getDisplayMessage(notification.message)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleViewMessage(notification)}
                            title="View full message"
                            color="primary"
                            sx={viewMessageIconButtonSx}
                          >
                            <Visibility fontSize="small" sx={{ fontSize: '18px' }} />
                          </IconButton>
                        </Box>
                        {isReportNotification(notification) && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Visibility sx={{ fontSize: '16px' }} />}
                            onClick={() => handleViewReport(notification)}
                            sx={viewReportButtonSx}
                          >
                            View Report
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={notification.priority}
                        size="small"
                        color={priorityColor as ChipProps['color']}
                        sx={priorityChipSx}
                      />
                    </TableCell>
                    <TableCell>
                      <CheckCircle sx={{ color: notification.isRead ? '#9e9e9e' : '#1a237e', fontSize: '20px' }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={dateTypographySx}>
                        {formatDateTime(notification.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={actionsCellBoxSx}>
                        {!notification.isRead && (
                          <IconButton
                            size="small"
                            onClick={() => handleMarkAsRead(notification)}
                            title="Mark as Read"
                            color="primary"
                            sx={markReadIconButtonSx}
                          >
                            <CheckCircle fontSize="small" sx={{ fontSize: '18px' }} />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(notification)}
                          title="Delete"
                          color="error"
                          sx={deleteIconButtonSx}
                        >
                          <DeleteIcon fontSize="small" sx={{ fontSize: '18px' }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={pageSize}
          onRowsPerPageChange={handleChangePageSize}
          rowsPerPageOptions={[10, 20, 50, 100]}
          sx={paginationSx}
        />
      </TableContainer>
      </Box>

      {/* Contact administrator Footer - Always Visible */}
      <Paper component="footer" sx={footerPaperSx}>
        <Box sx={footerBoxSx}>
          <Typography variant="body2" sx={footerLabelTypographySx}>
            Contact Administrator:
          </Typography>
          <Box sx={footerPhoneBoxSx}>
            <MessageCircle sx={{ fontSize: 18 }} />
            <Typography variant="body2" component="a" href="https://wa.me/96171882088" sx={footerPhoneLinkSx}>
              +96171882088
            </Typography>
          </Box>
        </Box>
      </Paper>
      <Toast toast={toast} onClose={hideToast} />
      <ConfirmDialog
        open={deleteDialogOpen}
        onCancel={handleDeleteDialogClose}
        onConfirm={confirmDelete}
        title="Delete Notification"
        message="Are you sure you want to delete this notification?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleting}
      />
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onCancel={handleBulkDeleteDialogClose}
        onConfirm={confirmBulkDelete}
        title="Delete Notifications"
        message={`Are you sure you want to delete ${selectedNotifications.size} notification${selectedNotifications.size > 1 ? 's' : ''}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        loading={deleting}
      />
    </Box>
  );
}

