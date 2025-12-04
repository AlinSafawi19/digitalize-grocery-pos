import { createTheme } from '@mui/material/styles';

// Professional and serious color palette for POS system
// Colors aligned with DigitalizePOS branding (deep navy blues)
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1a237e', // Deep indigo - matches logo, professional and trustworthy
      light: '#534bae', // Lighter indigo for hover states
      dark: '#000051', // Very dark indigo for pressed states
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#37474f', // Dark blue-gray - professional accent
      light: '#62727b', // Lighter blue-gray
      dark: '#263238', // Very dark blue-gray
      contrastText: '#ffffff',
    },
    error: {
      main: '#c62828', // Deep red - professional error color
      light: '#ef5350',
      dark: '#b71c1c',
    },
    warning: {
      main: '#f57c00', // Deep orange - professional warning
      light: '#ff9800',
      dark: '#e65100',
    },
    success: {
      main: '#2e7d32', // Deep green - professional success
      light: '#4caf50',
      dark: '#1b5e20',
    },
    info: {
      main: '#1565c0', // Deep blue - professional info
      light: '#42a5f5',
      dark: '#0d47a1',
    },
    background: {
      default: '#fafafa', // Very light gray - clean and professional
      paper: '#ffffff', // Pure white for cards and surfaces
    },
    text: {
      primary: '#212121', // Almost black - high contrast for readability
      secondary: '#616161', // Medium gray for secondary text
    },
    divider: '#e0e0e0', // Light gray divider
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 0, // Excel-like: no rounded corners
  },
  spacing: 4, // Reduced spacing unit (default is 8)
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 0, // Sharp corners
          fontWeight: 500,
          padding: '4px 12px', // Minimal padding
          margin: 0,
          boxShadow: 'none',
          border: '1px solid #d0d0d0',
          '&:hover': {
            boxShadow: 'none',
            borderColor: '#1a237e',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          border: '1px solid #d0d0d0',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          boxShadow: 'none', // No shadows
          border: '1px solid #e0e0e0',
          padding: 0, // Minimal padding
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '8px 12px', // Minimal padding
          '&:last-child': {
            paddingBottom: '8px',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none', // No shadows
          backgroundColor: '#1a237e',
          borderBottom: '1px solid #000051',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '48px !important', // Compact toolbar
          padding: '0 8px !important', // Minimal padding
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 0, // Sharp corners
          boxShadow: 'none', // No shadows
          border: '1px solid #e0e0e0',
        },
        elevation0: {
          boxShadow: 'none',
        },
        elevation1: {
          boxShadow: 'none',
        },
        elevation2: {
          boxShadow: 'none',
        },
        elevation3: {
          boxShadow: 'none',
        },
        elevation4: {
          boxShadow: 'none',
        },
        elevation5: {
          boxShadow: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          margin: 0,
          '& .MuiOutlinedInput-root': {
            borderRadius: 0, // Sharp corners
            '& fieldset': {
              borderColor: '#d0d0d0',
            },
            '&:hover fieldset': {
              borderColor: '#1a237e',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#1a237e',
              borderWidth: '1px',
            },
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 0, // Sharp corners
          margin: 0,
          padding: '2px 8px',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          padding: '8px !important', // Minimal padding
        },
      },
    },
    MuiGrid: {
      styleOverrides: {
        root: {
          margin: 0,
        },
        container: {
          margin: 0,
          width: '100%',
        },
        item: {
          padding: '4px !important', // Minimal padding
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          boxShadow: 'none',
          border: '1px solid',
          margin: '4px 0',
          padding: '8px 12px',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0, // Sharp corners
          boxShadow: 'none',
          border: '1px solid #e0e0e0',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 0, // Sharp corners
          padding: '4px 12px',
          minHeight: '32px',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: 'collapse',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '4px 8px',
          border: '1px solid #e0e0e0',
          borderTop: 'none',
        },
        head: {
          backgroundColor: '#f5f5f5',
          fontWeight: 600,
          borderBottom: '2px solid #1a237e',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#f9f9f9',
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          padding: '4px',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: '4px',
        },
      },
    },
  },
});

