import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
} from '@mui/material';
import { Backspace, Clear } from '@mui/icons-material';

const QuickCalculator: React.FC = () => {
  const [display, setDisplay] = useState<string>('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [operationDisplay, setOperationDisplay] = useState<string>('');

  // Refs to access current state values in callbacks
  const displayRef = useRef(display);
  const previousValueRef = useRef(previousValue);
  const operationRef = useRef(operation);
  const waitingForNewValueRef = useRef(waitingForNewValue);

  // Keep refs in sync with state
  useEffect(() => {
    displayRef.current = display;
    previousValueRef.current = previousValue;
    operationRef.current = operation;
    waitingForNewValueRef.current = waitingForNewValue;
  }, [display, previousValue, operation, waitingForNewValue]);

  const inputNumber = useCallback((num: string) => {
    if (waitingForNewValueRef.current) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay((prevDisplay) => (prevDisplay === '0' ? num : prevDisplay + num));
    }
  }, []);

  const inputDecimal = useCallback(() => {
    if (waitingForNewValueRef.current) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else {
      setDisplay((prevDisplay) => {
        if (prevDisplay.indexOf('.') === -1) {
          return prevDisplay + '.';
        }
        return prevDisplay;
      });
    }
  }, []);

  const performOperation = useCallback((nextOperation: string) => {
    const inputValue = parseFloat(displayRef.current);
    const currentPreviousValue = previousValueRef.current;
    const currentOperation = operationRef.current;

    if (currentPreviousValue === null) {
      setPreviousValue(inputValue);
      setOperationDisplay(`${formatNumber(String(inputValue))} ${getOperationSymbol(nextOperation)}`);
    } else if (currentOperation) {
      const currentValue = currentPreviousValue || 0;
      const newValue = calculate(currentValue, inputValue, currentOperation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
      if (nextOperation !== '=') {
        setOperationDisplay(`${formatNumber(String(newValue))} ${getOperationSymbol(nextOperation)}`);
      } else {
        setOperationDisplay('');
      }
    }

    setWaitingForNewValue(true);
    setOperation(nextOperation);
  }, []);

  const getOperationSymbol = (op: string): string => {
    switch (op) {
      case '+': return '+';
      case '-': return '−';
      case '*': return '×';
      case '/': return '÷';
      case '=': return '=';
      default: return op;
    }
  };

  const formatNumber = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    // Format with thousand separators
    return num.toLocaleString('en-US', {
      maximumFractionDigits: 10,
      useGrouping: true,
    });
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = useCallback(() => {
    const inputValue = parseFloat(displayRef.current);
    const currentPreviousValue = previousValueRef.current;
    const currentOperation = operationRef.current;

    if (currentPreviousValue !== null && currentOperation) {
      const newValue = calculate(currentPreviousValue, inputValue, currentOperation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
      setOperationDisplay('');
    }
  }, []);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
    setOperationDisplay('');
  }, []);

  const handleBackspace = useCallback(() => {
    setDisplay((prevDisplay) => {
      if (prevDisplay.length > 1) {
        return prevDisplay.slice(0, -1);
      } else {
        return '0';
      }
    });
  }, []);

  // Ref to track if calculator should handle keyboard events
  const calculatorRef = useRef<HTMLDivElement>(null);

  // Keyboard support with proper dependency management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard events if user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle number keys (main keyboard and numpad)
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        inputNumber(e.key);
        return;
      }

      // Handle numpad number keys
      if (e.code.startsWith('Numpad') && e.code.includes('Digit')) {
        const num = e.code.replace('NumpadDigit', '');
        if (num >= '0' && num <= '9') {
          e.preventDefault();
          inputNumber(num);
        }
        return;
      }

      // Handle decimal point
      if (e.key === '.' || e.key === ',' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        inputDecimal();
        return;
      }

      // Handle operators
      if (e.key === '+' || e.code === 'NumpadAdd') {
        e.preventDefault();
        performOperation('+');
        return;
      }

      if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        performOperation('-');
        return;
      }

      if (e.key === '*' || e.code === 'NumpadMultiply') {
        e.preventDefault();
        performOperation('*');
        return;
      }

      if (e.key === '/' || e.code === 'NumpadDivide') {
        e.preventDefault();
        performOperation('/');
        return;
      }

      // Handle equals/Enter
      if (e.key === 'Enter' || e.key === '=' || e.code === 'NumpadEnter') {
        e.preventDefault();
        handleEquals();
        return;
      }

      // Handle Escape (Clear)
      if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
        return;
      }

      // Handle Backspace
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputNumber, inputDecimal, performOperation, handleEquals, handleClear, handleBackspace]);

  const buttonSx = {
    minWidth: 0,
    fontSize: '20px',
    fontWeight: 600,
    height: '64px',
    minHeight: '64px',
    borderRadius: 0,
    textTransform: 'none',
    boxShadow: 'none',
    border: '1px solid',
    borderColor: 'divider',
    transition: 'all 0.15s ease-in-out',
    '&:active': {
      transform: 'scale(0.95)',
    },
  };

  const numberButtonSx = {
    ...buttonSx,
    bgcolor: 'background.paper',
    color: 'text.primary',
    borderColor: 'divider',
    '&:hover': {
      bgcolor: 'grey.50',
      borderColor: 'primary.main',
      boxShadow: 'none',
    },
  };

  const operatorButtonSx = {
    ...buttonSx,
    bgcolor: 'secondary.main',
    color: 'secondary.contrastText',
    borderColor: 'secondary.main',
    '&:hover': {
      bgcolor: 'secondary.dark',
      borderColor: 'secondary.dark',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    },
  };

  const equalsButtonSx = {
    ...buttonSx,
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    borderColor: 'primary.main',
    '&:hover': {
      bgcolor: 'primary.dark',
      borderColor: 'primary.dark',
      boxShadow: '0 2px 8px rgba(26, 35, 126, 0.3)',
    },
  };

  const actionButtonSx = {
    ...buttonSx,
    bgcolor: 'secondary.main',
    color: 'secondary.contrastText',
    borderColor: 'secondary.main',
    fontSize: '16px',
    '&:hover': {
      bgcolor: 'secondary.dark',
      borderColor: 'secondary.dark',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    },
  };

  return (
    <Box 
      ref={calculatorRef}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
      tabIndex={0}
    >
      {/* Display Area */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderRadius: 0,
          border: '1px solid',
          borderColor: 'divider',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        {operationDisplay && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontFamily: 'monospace',
              mb: 1,
              textAlign: 'right',
              fontSize: '14px',
            }}
          >
            {operationDisplay}
          </Typography>
        )}
        <Typography
          variant="h3"
          fontWeight={300}
          sx={{
            wordBreak: 'break-all',
            fontFamily: 'monospace',
            textAlign: 'right',
            lineHeight: 1.2,
            fontSize: { xs: '2rem', sm: '2.5rem' },
          }}
        >
          {formatNumber(display)}
        </Typography>
      </Paper>

      <Grid container spacing={1.5}>
        {/* Row 1: Clear and Backspace */}
        <Grid item xs={6}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleClear}
            startIcon={<Clear sx={{ fontSize: 24 }} />}
            sx={actionButtonSx}
          >
            Clear
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleBackspace}
            startIcon={<Backspace sx={{ fontSize: 24 }} />}
            sx={operatorButtonSx}
          >
            Backspace
          </Button>
        </Grid>

        {/* Row 2: 7, 8, 9, ÷ */}
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('7')} 
            sx={numberButtonSx}
          >
            7
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('8')} 
            sx={numberButtonSx}
          >
            8
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('9')} 
            sx={numberButtonSx}
          >
            9
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => performOperation('/')}
            sx={operatorButtonSx}
          >
            ÷
          </Button>
        </Grid>

        {/* Row 3: 4, 5, 6, × */}
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('4')} 
            sx={numberButtonSx}
          >
            4
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('5')} 
            sx={numberButtonSx}
          >
            5
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('6')} 
            sx={numberButtonSx}
          >
            6
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => performOperation('*')}
            sx={operatorButtonSx}
          >
            ×
          </Button>
        </Grid>

        {/* Row 4: 1, 2, 3, − */}
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('1')} 
            sx={numberButtonSx}
          >
            1
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('2')} 
            sx={numberButtonSx}
          >
            2
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('3')} 
            sx={numberButtonSx}
          >
            3
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => performOperation('-')}
            sx={operatorButtonSx}
          >
            −
          </Button>
        </Grid>

        {/* Row 5: 0, ., =, + */}
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={() => inputNumber('0')} 
            sx={numberButtonSx}
          >
            0
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={inputDecimal} 
            sx={numberButtonSx}
          >
            .
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleEquals}
            sx={equalsButtonSx}
          >
            =
          </Button>
        </Grid>
        <Grid item xs={3}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => performOperation('+')}
            sx={operatorButtonSx}
          >
            +
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QuickCalculator;

