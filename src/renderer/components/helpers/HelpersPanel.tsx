import React, { useState, useEffect } from 'react';
import {
  Box,
  Fab,
  Drawer,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Typography,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  HelpOutline,
  Close,
  CurrencyExchange,
  Calculate,
  QrCodeScanner,
} from '@mui/icons-material';
import CurrencyConverter from './CurrencyConverter';
import QuickCalculator from './QuickCalculator';
import BarcodeLookup from './BarcodeLookup';
import { usePermission } from '../../hooks/usePermission';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`helper-tabpanel-${index}`}
      aria-labelledby={`helper-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>{children}</Box>}
    </div>
  );
}

const HelpersPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const hasBarcodePermission = usePermission('products.view');

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Reset active tab if user doesn't have permission and is on barcode tab
  useEffect(() => {
    if (!hasBarcodePermission && activeTab === 2) {
      setActiveTab(0);
    }
  }, [hasBarcodePermission, activeTab]);

  return (
    <>
      {/* Floating Action Button */}
      <Slide direction="up" in={!open} mountOnEnter unmountOnExit>
        <Fab
          color="primary"
          aria-label="helpers"
          onClick={handleToggle}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1300,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            '&:hover': {
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
            },
          }}
        >
          <HelpOutline />
        </Fab>
      </Slide>

      {/* Helper Panel Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 480,
            maxWidth: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            Quick Helpers
          </Typography>
          <IconButton
            onClick={handleClose}
            sx={{
              color: 'primary.contrastText',
              padding: '8px',
              width: '48px',
              height: '48px',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
              '& .MuiSvgIcon-root': {
                fontSize: '28px',
              },
            }}
          >
            <Close />
          </IconButton>
        </Paper>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': {
                minWidth: 100,
                textTransform: 'none',
                fontSize: '16px',
                minHeight: '56px',
              },
            }}
          >
            <Tab
              icon={<CurrencyExchange sx={{ fontSize: 28 }} />}
              iconPosition="start"
              label="Currency"
            />
            <Tab
              icon={<Calculate sx={{ fontSize: 28 }} />}
              iconPosition="start"
              label="Calculator"
            />
            {hasBarcodePermission && (
              <Tab
                icon={<QrCodeScanner sx={{ fontSize: 28 }} />}
                iconPosition="start"
                label="Barcode"
              />
            )}
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <TabPanel value={activeTab} index={0}>
              <CurrencyConverter />
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              <QuickCalculator />
            </TabPanel>
            {hasBarcodePermission && (
              <TabPanel value={activeTab} index={2}>
                <BarcodeLookup />
              </TabPanel>
            )}
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default HelpersPanel;

