import { useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Container,
} from '@mui/material';
import { Block as BlockIcon, Home, ChatBubble as MessageCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';

export default function AccessDeniedPage() {
  const navigate = useNavigate();

  const handleGoHome = useCallback(() => {
    navigate(ROUTES.DASHBOARD);
  }, [navigate]);

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
          <BlockIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 2,
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You do not have permission to access this page.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Only the main administrator can access this feature. Please contact your administrator if you need access.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 4 }}>
            <MessageCircle sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography
              variant="body2"
              component="a"
              href="https://wa.me/96171882088"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              +96171882088
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Home />}
            onClick={handleGoHome}
            size="large"
          >
            Go to Dashboard
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

