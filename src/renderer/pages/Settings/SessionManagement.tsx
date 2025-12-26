import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Computer as ComputerIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SessionService, SessionInfo } from '../../services/session.service';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import { formatDateTime } from '../../utils/dateUtils';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

export default function SessionManagement() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionInfo | null>(null);
  const [terminateAllDialogOpen, setTerminateAllDialogOpen] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userSessions = await SessionService.getUserSessions(user.id, true);
      // Ensure dates are properly parsed (they come as strings from IPC)
      const parsedSessions = userSessions.map(session => ({
        ...session,
        lastActivity: typeof session.lastActivity === 'string' ? new Date(session.lastActivity) : session.lastActivity,
        expiresAt: typeof session.expiresAt === 'string' ? new Date(session.expiresAt) : session.expiresAt,
        createdAt: typeof session.createdAt === 'string' ? new Date(session.createdAt) : session.createdAt,
        terminatedAt: session.terminatedAt 
          ? (typeof session.terminatedAt === 'string' ? new Date(session.terminatedAt) : session.terminatedAt)
          : null,
      }));
      setSessions(parsedSessions);
    } catch (error) {
      showToast('Failed to load sessions', 'error');
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleTerminateSession = useCallback(async (session: SessionInfo) => {
    try {
      setTerminatingSessionId(session.id);
      await SessionService.terminateSession(session.id, 'Terminated by user');
      showToast('Session terminated successfully', 'success');
      await loadSessions();
    } catch (error) {
      showToast('Failed to terminate session', 'error');
      console.error('Error terminating session:', error);
    } finally {
      setTerminatingSessionId(null);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  }, [loadSessions, showToast]);

  const handleTerminateAll = useCallback(async () => {
    if (!user) return;

    try {
      setTerminatingSessionId('all');
      const currentSessionToken = localStorage.getItem('sessionToken');
      let currentSessionId: string | undefined;
      
      if (currentSessionToken) {
        const currentSession = await SessionService.getSessionByToken(currentSessionToken);
        if (currentSession) {
          currentSessionId = currentSession.id;
        }
      }

      const count = await SessionService.terminateAllUserSessions(user.id, currentSessionId);
      showToast(`Terminated ${count} session(s)`, 'success');
      await loadSessions();
    } catch (error) {
      showToast('Failed to terminate all sessions', 'error');
      console.error('Error terminating all sessions:', error);
    } finally {
      setTerminatingSessionId(null);
      setTerminateAllDialogOpen(false);
    }
  }, [user, loadSessions, showToast]);

  const formatTime = useCallback((date: Date | string) => {
    return formatDateTime(date, 'MMM DD, YYYY HH:mm') + ' (Beirut)';
  }, []);

  const getTimeRemaining = useCallback((expiresAt: Date | string, currentTime?: Date) => {
    // Parse the date if it's a string
    const expiresDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    
    // Convert UTC date from database to Beirut timezone
    const now = currentTime ? moment.tz(currentTime, TIMEZONE) : moment.tz(TIMEZONE);
    const expires = moment.utc(expiresDate).tz(TIMEZONE);
    const diff = expires.diff(now, 'minutes');
    
    if (diff < 0) return 'Expired';
    if (diff < 60) return `${diff} min`;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }, []);

  const getDeviceInfo = useCallback((session: SessionInfo) => {
    if (session.deviceInfo) {
      const platform = session.deviceInfo.platform || 'Unknown';
      return `${platform} (${session.deviceInfo.arch || 'Unknown'})`;
    }
    return session.userAgent || 'Unknown';
  }, []);

  const tableContainerSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: '18px',
    fontWeight: 600,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    mb: 2,
  }), []);

  const activeSessions = useMemo(() => sessions.filter(s => s.isActive), [sessions]);
  const inactiveSessions = useMemo(() => sessions.filter(s => !s.isActive), [sessions]);

  // Update time remaining every minute for active sessions
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    if (activeSessions.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [activeSessions.length]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography sx={titleTypographySx}>Session Management</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadSessions}
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            Refresh
          </Button>
          {activeSessions.length > 1 && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => setTerminateAllDialogOpen(true)}
              sx={{ textTransform: 'none', borderRadius: 0 }}
            >
              Terminate All Other Sessions
            </Button>
          )}
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 0 }}>
        <Typography variant="body2" fontWeight={600} mb={0.5}>
          About Sessions:
        </Typography>
        <Typography variant="body2" component="div">
          • Sessions automatically expire after the configured timeout period
          <br />
          • You can terminate individual sessions or all other sessions
          <br />
          • Terminating all other sessions will log you out from other devices
          <br />
          • Your current session will remain active when terminating all other sessions
        </Typography>
      </Alert>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <Box mb={3}>
          <Typography variant="h6" sx={{ mb: 1, fontSize: '16px', fontWeight: 600 }}>
            Active Sessions ({activeSessions.length})
          </Typography>
          <TableContainer component={Paper} sx={tableContainerSx}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Last Activity</TableCell>
                  <TableCell>Expires At</TableCell>
                  <TableCell>Expires In</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activeSessions.map((session) => {
                  const isCurrentSession = session.token === localStorage.getItem('sessionToken');
                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <ComputerIcon fontSize="small" />
                          <Box>
                            <Typography variant="body2" fontWeight={isCurrentSession ? 600 : 400}>
                              {getDeviceInfo(session)}
                              {isCurrentSession && (
                                <Chip label="Current" size="small" color="primary" sx={{ ml: 1 }} />
                              )}
                            </Typography>
                            {session.userAgent && (
                              <Typography variant="caption" color="textSecondary">
                                {session.userAgent.substring(0, 50)}...
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{session.ipAddress || 'N/A'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatTime(session.lastActivity)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatTime(session.expiresAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          color={
                            moment.utc(session.expiresAt).tz(TIMEZONE).isBefore(moment.tz(currentTime, TIMEZONE)) 
                              ? 'error' 
                              : 'textPrimary'
                          }
                          fontWeight={500}
                        >
                          {getTimeRemaining(session.expiresAt, currentTime)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<CheckCircleIcon fontSize="small" />}
                          label="Active"
                          size="small"
                          color="success"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {!isCurrentSession && (
                          <Tooltip title="Terminate Session">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSessionToDelete(session);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={terminatingSessionId === session.id}
                              color="error"
                            >
                              {terminatingSessionId === session.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DeleteIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Inactive Sessions */}
      {inactiveSessions.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 1, fontSize: '16px', fontWeight: 600 }}>
            Inactive Sessions ({inactiveSessions.length})
          </Typography>
          <TableContainer component={Paper} sx={tableContainerSx}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Last Activity</TableCell>
                  <TableCell>Terminated At</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inactiveSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <ComputerIcon fontSize="small" />
                        <Typography variant="body2">{getDeviceInfo(session)}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{session.ipAddress || 'N/A'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatTime(session.lastActivity)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {session.terminatedAt ? formatTime(session.terminatedAt) : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<CancelIcon fontSize="small" />}
                        label="Inactive"
                        size="small"
                        color="default"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {sessions.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          <Typography variant="body2">No sessions found.</Typography>
        </Alert>
      )}

      {/* Terminate Session Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSessionToDelete(null);
        }}
        PaperProps={{
          sx: {
            borderRadius: 0,
            border: '2px solid #c0c0c0',
          },
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#1a237e', color: '#ffffff', fontSize: '14px' }}>
          Terminate Session
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography>
            Are you sure you want to terminate this session? The user will be logged out from this device.
          </Typography>
          {sessionToDelete && (
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                <strong>Device:</strong> {getDeviceInfo(sessionToDelete)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>IP Address:</strong> {sessionToDelete.ipAddress || 'N/A'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Last Activity:</strong> {formatTime(sessionToDelete.lastActivity)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setSessionToDelete(null);
            }}
            variant="outlined"
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => sessionToDelete && handleTerminateSession(sessionToDelete)}
            variant="contained"
            color="error"
            disabled={!sessionToDelete || terminatingSessionId === sessionToDelete.id}
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            Terminate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Terminate All Sessions Dialog */}
      <Dialog
        open={terminateAllDialogOpen}
        onClose={() => setTerminateAllDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 0,
            border: '2px solid #c0c0c0',
          },
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#1a237e', color: '#ffffff', fontSize: '14px' }}>
          Terminate All Other Sessions
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography>
            Are you sure you want to terminate all other active sessions? This will log you out from all other devices.
            Your current session will remain active.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 0 }}>
            <Typography variant="body2">
              This action will terminate {activeSessions.length - 1} other active session(s).
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
          <Button
            onClick={() => setTerminateAllDialogOpen(false)}
            variant="outlined"
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTerminateAll}
            variant="contained"
            color="error"
            disabled={terminatingSessionId === 'all'}
            sx={{ textTransform: 'none', borderRadius: 0 }}
          >
            {terminatingSessionId === 'all' ? 'Terminating...' : 'Terminate All'}
          </Button>
        </DialogActions>
      </Dialog>

      <Toast toast={toast} onClose={hideToast} />
    </Box>
  );
}

