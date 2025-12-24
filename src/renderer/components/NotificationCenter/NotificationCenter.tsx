import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  Divider,
  Button,
  Chip,
  ChipProps,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Visibility,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { NotificationService, Notification, NotificationType } from '../../services/notification.service';
import { ROUTES } from '../../utils/constants';
import { SettingsService } from '../../services/settings.service';
import { playNotificationSound } from '../../utils/notificationSound';
import { formatDateTime } from '../../utils/dateUtils';

const getNotificationIcon = (type: NotificationType, priority: string) => {
  if (priority === 'urgent' || type === 'system_error') {
    return <ErrorIcon color="error" fontSize="small" />;
  }
  if (priority === 'high' || type === 'low_stock' || type === 'expiry_warning') {
    return <WarningIcon color="warning" fontSize="small" />;
  }
  return <InfoIcon color="info" fontSize="small" />;
};

const getNotificationColor = (priority: string) => {
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
};

/**
 * Check if a notification priority matches the priority filter
 * @param priority - The notification priority (low, normal, high, urgent)
 * @param filter - The priority filter setting (all, urgent, high, normal)
 * @returns true if the notification should be shown/played based on filter
 */
const checkPriorityFilter = (priority: string, filter: string): boolean => {
  if (filter === 'all') {
    return true;
  }
  
  const priorityLevels: Record<string, number> = {
    low: 0,
    normal: 1,
    high: 2,
    urgent: 3,
  };
  
  const filterLevels: Record<string, number> = {
    urgent: 3,
    high: 2,
    normal: 1,
  };
  
  const notificationLevel = priorityLevels[priority.toLowerCase()] ?? 0;
  const filterLevel = filterLevels[filter.toLowerCase()] ?? 0;
  
  return notificationLevel >= filterLevel;
};

/**
 * Check if a notification type is enabled
 * @param type - The notification type
 * @param enabledTypes - Array of enabled notification types (empty means all enabled)
 * @returns true if the notification type should play sound
 */
const checkEnabledType = (type: string, enabledTypes: string[]): boolean => {
  // If enabledTypes is empty, all types are enabled
  if (enabledTypes.length === 0) {
    return true;
  }
  return enabledTypes.includes(type);
};

interface NotificationCenterProps {
  onNotificationClick?: (notification: Notification) => void;
}

export default function NotificationCenter({ onNotificationClick }: NotificationCenterProps) {
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [notificationSettings, setNotificationSettings] = useState<{
    soundEnabled: boolean;
    soundVolume: number;
    enabledTypes: string[];
    priorityFilter: string;
  } | null>(null);
  const loadingRef = useRef(false);
  const unreadCountRef = useRef(0);
  const handledNotificationIdsRef = useRef<Set<number>>(new Set());

  const open = Boolean(anchorEl);

  // Keep ref in sync with state
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const loadNotifications = useCallback(async () => {
    if (!user?.id || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const result = await NotificationService.getNotifications(
        {
          page,
          pageSize: 10,
          isRead: false, // Only show unread in the dropdown
        },
        user.id
      );

      if (result.success && result.notifications) {
        const previousCount = unreadCountRef.current;
        const newCount = result.unreadCount || 0;
        
        if (page === 1) {
          setNotifications(result.notifications);
        } else {
          setNotifications((prev) => [...prev, ...result.notifications!]);
        }
        setUnreadCount(newCount);

        // Play sound if new notifications arrived and sound is enabled
        if (newCount > previousCount && notificationSettings?.soundEnabled && notificationSettings) {
          // Get the newly arrived notifications (those that weren't in the previous count)
          const newNotifications = result.notifications.filter((n) => !n.isRead);
          
          // Check if any of the new notifications should trigger a sound
          const shouldPlaySound = newNotifications.some((notification) => {
            // Check if notification type is enabled
            const typeEnabled = checkEnabledType(
              notification.type,
              notificationSettings.enabledTypes
            );
            
            // Check if notification priority matches filter
            const priorityMatches = checkPriorityFilter(
              notification.priority,
              notificationSettings.priorityFilter
            );
            
            return typeEnabled && priorityMatches;
          });
          
          if (shouldPlaySound) {
            playNotificationSound(notificationSettings.soundVolume);
          }
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [user?.id, page, notificationSettings]);

  const loadNotificationCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const result = await NotificationService.getNotificationCount(undefined, user.id);
      if (result.success) {
        const previousCount = unreadCountRef.current;
        const newCount = result.unreadCount || 0;
        setUnreadCount(newCount);

        // If count increased and sound is enabled, check if we should play sound
        if (newCount > previousCount && notificationSettings?.soundEnabled && notificationSettings) {
          // Load the latest notifications to check their type and priority
          const notificationsResult = await NotificationService.getNotifications(
            {
              page: 1,
              pageSize: newCount - previousCount, // Only get the new ones
              isRead: false,
            },
            user.id
          );

          if (notificationsResult.success && notificationsResult.notifications) {
            // Check if any of the new notifications should trigger a sound
            // Only check notifications we haven't already handled
            const unhandledNotifications = notificationsResult.notifications.filter(
              (n) => !handledNotificationIdsRef.current.has(n.id)
            );
            
            const shouldPlaySound = unhandledNotifications.some((notification) => {
              // Check if notification type is enabled
              const typeEnabled = checkEnabledType(
                notification.type,
                notificationSettings.enabledTypes
              );
              
              // Check if notification priority matches filter
              const priorityMatches = checkPriorityFilter(
                notification.priority,
                notificationSettings.priorityFilter
              );
              
              return typeEnabled && priorityMatches;
            });
            
            if (shouldPlaySound) {
              playNotificationSound(notificationSettings.soundVolume);
              // Mark all unhandled notifications as handled
              unhandledNotifications.forEach((n) => {
                handledNotificationIdsRef.current.add(n.id);
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading notification count:', error);
    }
  }, [user?.id, notificationSettings]);

  // Load notification settings
  useEffect(() => {
    if (user?.id) {
      SettingsService.getNotificationSettings(user.id).then((result) => {
        if (result.success && result.notificationSettings) {
          setNotificationSettings(result.notificationSettings);
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      // Load count initially
      loadNotificationCount();
      
      // Listen for count updates from cron job
      const unsubscribeCountUpdate = window.electron.ipcRenderer.on('notification:countUpdated', (data: unknown) => {
        const countData = data as { userId: number; unreadCount: number; totalCount: number };
        // Only update if it's for this user
        if (countData.userId === user.id) {
          const previousCount = unreadCountRef.current;
          setUnreadCount(countData.unreadCount);
          
          // If count increased and sound is enabled, check if we should play sound
          if (countData.unreadCount > previousCount && notificationSettings?.soundEnabled && notificationSettings) {
            // Load the latest notifications to check their type and priority
            NotificationService.getNotifications(
              {
                page: 1,
                pageSize: countData.unreadCount - previousCount, // Only get the new ones
                isRead: false,
              },
              user.id
            ).then((notificationsResult) => {
              if (notificationsResult.success && notificationsResult.notifications) {
                // Check if any of the new notifications should trigger a sound
                // Only check notifications we haven't already handled
                const unhandledNotifications = notificationsResult.notifications.filter(
                  (n) => !handledNotificationIdsRef.current.has(n.id)
                );
                
                const shouldPlaySound = unhandledNotifications.some((notification) => {
                  // Check if notification type is enabled
                  const typeEnabled = checkEnabledType(
                    notification.type,
                    notificationSettings.enabledTypes
                  );
                  
                  // Check if notification priority matches filter
                  const priorityMatches = checkPriorityFilter(
                    notification.priority,
                    notificationSettings.priorityFilter
                  );
                  
                  return typeEnabled && priorityMatches;
                });
                
                if (shouldPlaySound) {
                  playNotificationSound(notificationSettings.soundVolume);
                  // Mark all unhandled notifications as handled
                  unhandledNotifications.forEach((n) => {
                    handledNotificationIdsRef.current.add(n.id);
                  });
                }
              }
            });
          }
          
          // If the popover is open, reload notifications
          if (open) {
            loadNotifications();
          }
        }
      });
      
      // Listen for real-time notification events (when new notifications are created)
      const unsubscribeNew = window.electron.ipcRenderer.on('notification:new', (notification: unknown) => {
        const newNotification = notification as Notification;
        // Only refresh if the notification is for this user or system-wide
        if (!newNotification.userId || newNotification.userId === user.id) {
          // Check if this notification should play sound based on priority filter
          // Only check if we haven't already handled this notification
          if (!handledNotificationIdsRef.current.has(newNotification.id) && notificationSettings?.soundEnabled && notificationSettings) {
            const typeEnabled = checkEnabledType(
              newNotification.type,
              notificationSettings.enabledTypes
            );
            const priorityMatches = checkPriorityFilter(
              newNotification.priority,
              notificationSettings.priorityFilter
            );
            
            // Only play sound if type is enabled and priority matches filter
            if (typeEnabled && priorityMatches) {
              playNotificationSound(notificationSettings.soundVolume);
              handledNotificationIdsRef.current.add(newNotification.id);
            }
          }
          
          // Trigger immediate count check
          loadNotificationCount();
          // If the popover is open, reload notifications
          if (open) {
            loadNotifications();
          }
        }
      });
      
      // Clean up handled notification IDs periodically (keep last 100)
      const cleanupInterval = setInterval(() => {
        if (handledNotificationIdsRef.current.size > 100) {
          const idsArray = Array.from(handledNotificationIdsRef.current);
          // Keep only the most recent 50 IDs
          handledNotificationIdsRef.current = new Set(idsArray.slice(-50));
        }
      }, 60000); // Clean up every minute
      
      return () => {
        clearInterval(cleanupInterval);
        unsubscribeCountUpdate();
        unsubscribeNew();
      };
    }
  }, [user?.id, loadNotificationCount, open, loadNotifications, notificationSettings]);

  useEffect(() => {
    if (open && user?.id) {
      setPage(1);
      loadNotifications();
    }
  }, [open, user?.id, loadNotifications]);

  // Memoize helper functions
  const extractReportPath = useCallback((message: string): string | null => {
    const match = message.match(/REPORT_PATH:(.+)$/);
    return match ? match[1] : null;
  }, []);

  const getDisplayMessage = useCallback((message: string): string => {
    return message.split('|REPORT_PATH:')[0];
  }, []);

  const isReportNotification = useCallback((notification: Notification): boolean => {
    return notification.title === 'Scheduled Report Generated' && 
           notification.message.includes('REPORT_PATH:');
  }, []);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleMarkAsRead = useCallback(async (id: number) => {
    if (!user?.id) return;

    try {
      const result = await NotificationService.markNotificationRead(id, user.id);
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user?.id]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const result = await NotificationService.markAllNotificationsRead(undefined, user.id);
      if (result.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user?.id]);

  const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;

    try {
      const result = await NotificationService.deleteNotification(id, user.id);
      if (result.success) {
        setNotifications((prev) => {
          const deleted = prev.find((n) => n.id === id);
          if (deleted && !deleted.isRead) {
            setUnreadCount((count) => Math.max(0, count - 1));
          }
          return prev.filter((n) => n.id !== id);
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user?.id]);

  const handleViewReport = useCallback(async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    const reportPath = extractReportPath(notification.message);
    if (!reportPath) return;

    try {
      // Open the reports folder first (this will show the file in the folder)
      await window.electron.ipcRenderer.invoke('reports:openReportsFolder');
      
      // Then open the file itself
      await window.electron.ipcRenderer.invoke('file:open', reportPath);
    } catch (error) {
      console.error('Error opening report:', error);
    }
  }, [extractReportPath]);

  const handleNotificationClick = useCallback((notification: Notification) => {
    if (!notification.isRead && user?.id) {
      handleMarkAsRead(notification.id);
    }
    handleClose();
    if (onNotificationClick) {
      onNotificationClick(notification);
    } else {
      // Default navigation based on notification type
      navigate(ROUTES.NOTIFICATIONS);
    }
  }, [user?.id, handleMarkAsRead, handleClose, onNotificationClick, navigate]);

  const handleViewAll = useCallback(() => {
    handleClose();
    navigate(ROUTES.NOTIFICATIONS);
  }, [handleClose, navigate]);

  // Memoize sx prop objects to avoid recreation on every render
  const iconButtonSx = useMemo(() => ({
    position: 'relative',
    padding: '4px',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  }), []);

  const badgeSx = useMemo(() => ({
    '& .MuiBadge-badge': {
      fontSize: '10px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 600,
    },
  }), []);

  const popoverPaperSx = useMemo(() => ({
    width: { xs: 'calc(100vw - 32px)', sm: 400 },
    maxWidth: 400,
    maxHeight: { xs: 'calc(100vh - 100px)', sm: 600 },
    mt: 0.5,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    backgroundColor: '#ffffff',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 1,
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const markAllButtonSx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    padding: '4px 8px',
    minHeight: '24px',
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const loadingBoxSx = useMemo(() => ({
    display: 'flex',
    justifyContent: 'center',
    p: 3,
  }), []);

  const emptyBoxSx = useMemo(() => ({
    p: 3,
    textAlign: 'center',
  }), []);

  const emptyTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  const listSx = useMemo(() => ({
    p: 0,
    maxHeight: { xs: 'calc(100vh - 200px)', sm: 400 },
    overflow: 'auto',
    '&::-webkit-scrollbar': {
      width: '8px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: '#f5f5f5',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: '#c0c0c0',
      borderRadius: '4px',
      '&:hover': {
        backgroundColor: '#a0a0a0',
      },
    },
  }), []);

  const listItemButtonSx = useMemo(() => ({
    py: 1.5,
    px: 1.5,
    '&:hover': {
      backgroundColor: '#e8e8e8',
    },
  }), []);

  const notificationContentBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
    gap: 1,
  }), []);

  const chipSx = useMemo(() => ({
    ml: 1,
    height: 20,
    fontSize: '10px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  }), []);

  const messageTypographySx = useMemo(() => ({
    mb: 0.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
    lineHeight: 1.4,
  }), []);

  const viewReportButtonSx = useMemo(() => ({
    mt: 0.5,
    mb: 0.5,
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    padding: '2px 8px',
    minHeight: '24px',
    borderColor: '#c0c0c0',
    color: '#1a237e',
    '&:hover': {
      borderColor: '#1a237e',
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const captionTypographySx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#9e9e9e',
  }), []);

  const deleteButtonSx = useMemo(() => ({
    padding: '4px',
    '&:hover': {
      backgroundColor: '#f5f5f5',
    },
  }), []);

  const viewAllButtonSx = useMemo(() => ({
    backgroundColor: '#1a237e',
    color: '#ffffff',
    borderRadius: 0,
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    textTransform: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    border: '1px solid #000051',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: '#534bae',
      boxShadow: 'none',
    },
    '&:active': {
      backgroundColor: '#000051',
    },
  }), []);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-label="notifications"
        sx={iconButtonSx}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={badgeSx}
        >
          <NotificationsIcon sx={{ fontSize: { xs: '18px', sm: '20px' } }} />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: popoverPaperSx,
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={headerBoxSx}>
            <Typography variant="h6" sx={titleTypographySx}>
              Notifications
            </Typography>
            {notifications.length > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllAsRead}
                sx={markAllButtonSx}
              >
                Mark all as read
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 1, borderColor: '#e0e0e0' }} />
          {loading && notifications.length === 0 ? (
            <Box sx={loadingBoxSx}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={emptyBoxSx}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={emptyTypographySx}
              >
                No unread notifications
              </Typography>
            </Box>
          ) : (
            <List sx={listSx}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    disablePadding
                    sx={{
                      backgroundColor: notification.isRead ? 'transparent' : '#f5f5f5',
                      '&:hover': {
                        backgroundColor: '#e8e8e8',
                      },
                    }}
                  >
                    <ListItemButton
                      onClick={() => handleNotificationClick(notification)}
                      sx={listItemButtonSx}
                    >
                      <Box sx={notificationContentBoxSx}>
                        <Box sx={{ mt: 0.5 }}>
                          {getNotificationIcon(notification.type as NotificationType, notification.priority)}
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                            <Typography
                              variant="subtitle2"
                              sx={[
                                {
                                  fontWeight: notification.isRead ? 400 : 600,
                                  flexGrow: 1,
                                  fontSize: '13px',
                                  fontFamily: 'system-ui, -apple-system, sans-serif',
                                },
                              ]}
                            >
                              {notification.title}
                            </Typography>
                            <Chip
                              label={notification.priority}
                              size="small"
                              color={getNotificationColor(notification.priority) as ChipProps['color']}
                              sx={chipSx}
                            />
                          </Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={messageTypographySx}
                          >
                            {getDisplayMessage(notification.message)}
                          </Typography>
                          {isReportNotification(notification) && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Visibility sx={{ fontSize: '14px' }} />}
                              onClick={(e) => handleViewReport(e, notification)}
                              sx={viewReportButtonSx}
                            >
                              View Report
                            </Button>
                          )}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={captionTypographySx}
                          >
                            {formatDateTime(notification.createdAt)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={(e) => handleDelete(notification.id, e)}
                            sx={deleteButtonSx}
                          >
                            <DeleteIcon sx={{ fontSize: '16px', color: '#616161' }} />
                          </IconButton>
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                  {index < notifications.length - 1 && <Divider sx={{ borderColor: '#e0e0e0' }} />}
                </React.Fragment>
              ))}
            </List>
          )}
          <Divider sx={{ mt: 1, mb: 1, borderColor: '#e0e0e0' }} />
          <Button
            fullWidth
            onClick={handleViewAll}
            sx={viewAllButtonSx}
          >
            View All Notifications
          </Button>
        </Box>
      </Popover>
    </>
  );
}

