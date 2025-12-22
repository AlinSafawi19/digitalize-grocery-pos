import { useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Container,
} from '@mui/material';
import { Error as ErrorIcon, Logout, ChatBubble as MessageCircle } from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { logout } from '../../store/slices/auth.slice';
import { ROUTES } from '../../utils/constants';

export default function LicenseExpiredPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = useCallback(async () => {
    if (user?.id) {
      await dispatch(logout(user.id));
      navigate(ROUTES.LOGIN);
    }
  }, [user?.id, dispatch, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            textAlign: 'center',
          }}
        >
          <ErrorIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 2,
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom color="error">
            License Expired
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Your license has expired. Please contact the administrator to renew your subscription.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Only the main administrator can manage license renewal. Please reach out to them for assistance.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 4 }}>
            <MessageCircle sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography
              variant="body2"
              component="a"
              href="https://wa.me/96181943475"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              +96181943475
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Logout />}
            onClick={handleLogout}
            size="large"
          >
            Logout
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

