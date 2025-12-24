import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Button,
  TextField,
  Typography,
  Divider,
  Alert,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  InventoryService,
  InventoryItem,
  AdjustStockInput,
} from '../../services/inventory.service';
import MainLayout from '../../components/layout/MainLayout';
import { ROUTES } from '../../utils/constants';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';

const AdjustStock: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();

  const [inventoryItem, setInventoryItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustmentType, setAdjustmentType] = useState<'adjustment' | 'transfer' | 'damage' | 'expiry' | 'purchase' | ''>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [processing, setProcessing] = useState(false);

  // Initial values for change detection
  const [initialAdjustmentType] = useState<'adjustment' | 'transfer' | 'damage' | 'expiry' | 'purchase' | ''>('');
  const [initialQuantity] = useState<string>('1');
  const [initialReason] = useState<string>('');
  const [initialExpiryDate] = useState<Date | null>(null);

  // Track if select dropdown is open
  const adjustmentTypeSelectOpenRef = useRef(false);
  const [adjustmentTypeSelectOpen, setAdjustmentTypeSelectOpen] = useState(false);
  const adjustmentTypeSelectWasOpenedRef = useRef(false);

  // Handle adjustment type change - reset quantity to appropriate default
  const handleAdjustmentTypeChange = useCallback((newType: 'adjustment' | 'transfer' | 'damage' | 'expiry' | 'purchase' | '') => {
    setAdjustmentType(newType);
    // Reset quantity to 1 when changing types (only if a type is selected)
    if (newType) {
      setQuantity('1');
      // Clear expiry date if switching to a type that doesn't support it
      if (newType !== 'purchase' && newType !== 'adjustment') {
        setExpiryDate(null);
      }
    }
    // Set flag to move to next field after dropdown closes
    adjustmentTypeSelectWasOpenedRef.current = true;
  }, []);

  const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // For purchase, damage, and expiry, only allow positive values
    if (adjustmentType === 'purchase' || adjustmentType === 'damage' || adjustmentType === 'expiry') {
      const num = parseFloat(value);
      if (value === '' || (!isNaN(num) && num >= 0)) {
        setQuantity(value);
      }
    } else {
      setQuantity(value);
    }
  }, [adjustmentType]);

  const handleExpiryDateChange = useCallback((newValue: Date | null) => {
    setExpiryDate(newValue);
  }, []);

  const handleReasonChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setReason(e.target.value);
  }, []);

  const handleNavigateBack = useCallback(() => {
    navigate(ROUTES.INVENTORY);
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate(ROUTES.INVENTORY);
  }, [navigate]);

  // Keyboard navigation handlers
  const handleQuantityKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Check if expiry date field should be shown
      const qty = parseFloat(quantity);
      const shouldShowExpiry = (adjustmentType === 'purchase' || adjustmentType === 'adjustment') && 
                                !isNaN(qty) && qty > 0;
      
      if (shouldShowExpiry) {
        const expiryInput = document.getElementById('adjust-stock-expiry');
        expiryInput?.focus();
      } else {
        const reasonInput = document.getElementById('adjust-stock-reason');
        reasonInput?.focus();
      }
    }
  }, [quantity, adjustmentType]);

  const handleExpiryDateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const reasonInput = document.getElementById('adjust-stock-reason');
      reasonInput?.focus();
    }
  }, []);

  // Handlers for select
  const handleAdjustmentTypeSelectOpen = useCallback(() => {
    adjustmentTypeSelectOpenRef.current = true;
    setAdjustmentTypeSelectOpen(true);
    adjustmentTypeSelectWasOpenedRef.current = true;
  }, []);

  const handleAdjustmentTypeSelectClose = useCallback(() => {
    const wasOpened = adjustmentTypeSelectWasOpenedRef.current;
    adjustmentTypeSelectOpenRef.current = false;
    setAdjustmentTypeSelectOpen(false);
    adjustmentTypeSelectWasOpenedRef.current = false;
    
    // Always move to quantity field if select was opened by user
    if (wasOpened) {
      setTimeout(() => {
        const quantityInput = document.getElementById('adjust-stock-quantity');
        quantityInput?.focus();
      }, 0);
    }
  }, []);

  const handleAdjustmentTypeMenuItemClick = useCallback((event?: React.MouseEvent) => {
    // Handle click on menu item - always close select and move forward
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (adjustmentTypeSelectWasOpenedRef.current || adjustmentTypeSelectOpenRef.current) {
      adjustmentTypeSelectWasOpenedRef.current = false;
      adjustmentTypeSelectOpenRef.current = false;
      setAdjustmentTypeSelectOpen(false);
      setTimeout(() => {
        const quantityInput = document.getElementById('adjust-stock-quantity');
        quantityInput?.focus();
      }, 150);
    }
  }, []);

  const loadInventoryItem = useCallback(async () => {
    if (!productId || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const result = await InventoryService.getByProductId(parseInt(productId, 10), user.id);
      if (result.success && result.inventory) {
        setInventoryItem(result.inventory);
      } else {
        showToast(result.error || 'Failed to load inventory item', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, user?.id, showToast]);

  useEffect(() => {
    loadInventoryItem();
  }, [loadInventoryItem]);

  const handleAdjust = useCallback(async () => {
    if (!inventoryItem || !user?.id) return;

    // Validate adjustment type is selected
    if (!adjustmentType) {
      showToast('Please select an adjustment type', 'error');
      return;
    }

    // Type guard: at this point adjustmentType is guaranteed to be non-empty
    const selectedType = adjustmentType as 'adjustment' | 'transfer' | 'damage' | 'expiry' | 'purchase';

    let quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum === 0) {
      showToast('Please enter a valid quantity', 'error');
      return;
    }

    // Check if values have changed from initial/default values
    const quantityChanged = quantity !== initialQuantity || parseFloat(quantity) !== parseFloat(initialQuantity);
    const typeChanged = adjustmentType !== initialAdjustmentType;
    const reasonChanged = reason !== initialReason;
    
    // Compare dates properly - check if expiry date has changed
    const datesEqual = expiryDate === initialExpiryDate || 
      (expiryDate && initialExpiryDate && expiryDate.getTime() === initialExpiryDate.getTime()) ||
      (!expiryDate && !initialExpiryDate);
    const expiryDateChanged = !datesEqual;

    if (!quantityChanged && !typeChanged && !reasonChanged && !expiryDateChanged) {
      showToast('No changes made', 'info');
      return;
    }

    // Apply type-specific quantity logic
    // For damage and expiry, the input is positive but we need to send negative
    if (selectedType === 'damage' || selectedType === 'expiry') {
      quantityNum = -Math.abs(quantityNum); // Ensure it's negative
    }
    // For purchase, ensure it's positive
    else if (selectedType === 'purchase') {
      quantityNum = Math.abs(quantityNum); // Ensure it's positive
    }
    // For adjustment and transfer, allow both positive and negative

    setProcessing(true);

    try {
      const input: AdjustStockInput = {
        productId: inventoryItem.productId,
        quantity: quantityNum,
        type: selectedType,
        reason: reason || undefined,
        userId: user.id,
        expiryDate: expiryDate,
      };

      const result = await InventoryService.adjustStock(input, user.id);
      if (result.success) {
        showToast('Stock adjusted successfully', 'success');
        // Navigate back to inventory list after a short delay
        setTimeout(() => {
          navigate(ROUTES.INVENTORY);
        }, 1000);
      } else {
        showToast(result.error || 'Failed to adjust stock', 'error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      showToast(errorMessage, 'error');
    } finally {
      setProcessing(false);
    }
  }, [inventoryItem, user?.id, quantity, adjustmentType, reason, expiryDate, initialQuantity, initialAdjustmentType, initialReason, initialExpiryDate, showToast, navigate]);

  const handleReasonKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // For multiline, Shift+Enter creates new line, Enter triggers adjust
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Trigger the adjust function
      handleAdjust();
    }
  }, [handleAdjust]);

  // Memoize sx prop objects to avoid recreation on every render
  const loadingBoxSx = useMemo(() => ({
    p: 3,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    backgroundColor: '#f5f5f5',
  }), []);

  const containerBoxSx = useMemo(() => ({
    p: 3,
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  }), []);

  const headerBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    mb: 3,
  }), []);

  const backIconButtonSx = useMemo(() => ({
    mr: 2,
    color: '#1a237e',
    '&:hover': {
      backgroundColor: '#e3f2fd',
    },
  }), []);

  const titleTypographySx = useMemo(() => ({
    fontSize: { xs: '20px', sm: '24px', md: '28px' },
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  // Calculate current quantity - handle null inventoryItem
  const currentQuantity = inventoryItem?.quantity ?? 0;
  
  // Calculate new quantity for display based on type
  const getDisplayQuantity = useCallback(() => {
    if (!inventoryItem) return 0;
    if (!quantity || quantity.trim() === '') {
      return currentQuantity;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty === 0) {
      return currentQuantity;
    }
    if (adjustmentType === 'damage' || adjustmentType === 'expiry') {
      return currentQuantity - Math.abs(qty); // Subtract for damage/expiry
    } else if (adjustmentType === 'purchase') {
      return currentQuantity + Math.abs(qty); // Add for purchase
    } else {
      return currentQuantity + qty; // Can be positive or negative for adjustment/transfer
    }
  }, [quantity, currentQuantity, adjustmentType, inventoryItem]);
  
  const newQuantity = useMemo(() => getDisplayQuantity(), [getDisplayQuantity]);
  
  // Get label and helper text based on type
  const getQuantityLabel = useCallback(() => {
    if (!adjustmentType) return 'Quantity';
    switch (adjustmentType) {
      case 'purchase':
        return 'Quantity to Add';
      case 'damage':
      case 'expiry':
        return 'Quantity to Remove';
      case 'adjustment':
        return 'Quantity Adjustment';
      case 'transfer':
        return 'Transfer Quantity';
      default:
        return 'Quantity';
    }
  }, [adjustmentType]);
  
  const getQuantityHelperText = useCallback(() => {
    if (!inventoryItem) return 'Enter quantity';
    
    // If no adjustment type selected, prompt to select one first
    if (!adjustmentType) {
      return 'Please select an adjustment type first';
    }
    
    // Get the instruction text based on adjustment type
    let instructionText = '';
    switch (adjustmentType) {
      case 'purchase':
        instructionText = 'Enter the quantity of stock being added';
        break;
      case 'damage':
      case 'expiry':
        instructionText = 'Enter the quantity of stock being removed';
        break;
      case 'adjustment':
        instructionText = 'Enter positive number to add, negative to subtract (for corrections/mistakes)';
        break;
      case 'transfer':
        instructionText = 'Enter positive for incoming, negative for outgoing';
        break;
      default:
        instructionText = 'Enter quantity';
    }
    
    // If quantity is empty or invalid, just show instruction
    if (!quantity || quantity.trim() === '') {
      return instructionText;
    }
    
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty === 0) {
      return instructionText;
    }
    
    // If quantity is valid, show both instruction and new quantity
    const displayQty = getDisplayQuantity();
    if (isNaN(displayQty) || displayQty === null || displayQty === undefined) {
      return `${instructionText} • Enter a valid quantity`;
    }
    
    return `${instructionText} • New quantity will be: ${displayQty.toFixed(2)} ${inventoryItem.product.unit}`;
  }, [quantity, adjustmentType, getDisplayQuantity, inventoryItem]);

  const quantityLabel = useMemo(() => getQuantityLabel(), [getQuantityLabel]);
  const quantityHelperText = useMemo(() => getQuantityHelperText(), [getQuantityHelperText]);

  // Memoize sx prop objects to avoid recreation on every render
  const productCardSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const cardTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const dividerSx = useMemo(() => ({
    my: 2,
    borderColor: '#e0e0e0',
  }), []);

  const labelTypographySx = useMemo(() => ({
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
    '& strong': {
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const productNameTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const codeTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const currentStockTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a237e',
  }), []);

  const reorderLevelTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const formPaperSx = useMemo(() => ({
    p: 3,
    borderRadius: 0,
    border: '1px solid #c0c0c0',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  }), []);

  const formTitleTypographySx = useMemo(() => ({
    fontSize: '16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const inputLabelSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const selectSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#c0c0c0',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1a237e',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1a237e',
    },
  }), []);

  const menuItemSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  const textFieldSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '& fieldset': {
        borderColor: '#c0c0c0',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
        borderWidth: '1px',
      },
    },
    '& .MuiInputLabel-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiFormHelperText-root': {
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const textFieldMultilineSx = useMemo(() => ({
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#ffffff',
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '& fieldset': {
        borderColor: '#c0c0c0',
        borderWidth: '1px',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
        borderWidth: '1px',
      },
    },
    '& .MuiInputLabel-root': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    '& .MuiInputBase-input::placeholder': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const warningAlertSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #ff9800',
    borderLeft: '4px solid #ff9800',
    backgroundColor: '#fff3e0',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '& .MuiAlert-icon': {
      color: '#f57c00',
    },
    '& .MuiAlert-message': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const infoAlertSx = useMemo(() => ({
    borderRadius: 0,
    border: '1px solid #2196f3',
    borderLeft: '4px solid #2196f3',
    backgroundColor: '#e3f2fd',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    '& .MuiAlert-icon': {
      color: '#1976d2',
    },
    '& .MuiAlert-message': {
      fontSize: '13px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
  }), []);

  const buttonsBoxSx = useMemo(() => ({
    display: 'flex',
    gap: 2,
    justifyContent: 'flex-end',
    mt: 2,
  }), []);

  const cancelButtonSx = useMemo(() => ({
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
    '&:disabled': {
      borderColor: '#e0e0e0',
      color: '#9e9e9e',
    },
  }), []);

  const submitButtonSx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textTransform: 'none',
    borderRadius: 0,
    backgroundColor: '#1a237e',
    padding: '6px 16px',
    '&:hover': {
      backgroundColor: '#283593',
    },
    '&:disabled': {
      backgroundColor: '#e0e0e0',
      color: '#9e9e9e',
    },
  }), []);

  // Early returns after all hooks are defined
  if (loading) {
    return (
      <MainLayout>
        <Box sx={loadingBoxSx}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (!inventoryItem) {
    return (
      <MainLayout>
        <Box sx={containerBoxSx}>
          <Box sx={headerBoxSx}>
            <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
              <ArrowBack sx={{ fontSize: '20px' }} />
            </IconButton>
            <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
              Adjust Stock
            </Typography>
          </Box>
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box sx={containerBoxSx}>
        <Box sx={headerBoxSx}>
          <IconButton onClick={handleNavigateBack} sx={backIconButtonSx}>
            <ArrowBack sx={{ fontSize: '20px' }} />
          </IconButton>
          <Typography variant="h4" fontWeight="bold" sx={titleTypographySx}>
            Adjust Stock
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Product Info Card */}
          <Grid item xs={12} md={4}>
            <Card sx={productCardSx}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={cardTitleTypographySx}>
                  Product Information
                </Typography>
                <Divider sx={dividerSx} />
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={labelTypographySx}>
                    <strong>Name:</strong>
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" sx={productNameTypographySx}>
                    {inventoryItem.product.name}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={labelTypographySx}>
                    <strong>Code:</strong>
                  </Typography>
                  <Typography variant="body1" sx={codeTypographySx}>
                    {inventoryItem.product.code}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={labelTypographySx}>
                    <strong>Current Stock:</strong>
                  </Typography>
                  <Typography variant="body1" fontWeight="bold" sx={currentStockTypographySx}>
                    {currentQuantity.toFixed(2)} {inventoryItem.product.unit}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom sx={labelTypographySx}>
                    <strong>Reorder Level:</strong>
                  </Typography>
                  <Typography variant="body1" sx={reorderLevelTypographySx}>
                    {inventoryItem.reorderLevel.toFixed(2)} {inventoryItem.product.unit}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Adjustment Form */}
          <Grid item xs={12} md={8}>
            <Paper sx={formPaperSx}>
              <Typography variant="h6" fontWeight="bold" gutterBottom sx={formTitleTypographySx}>
                Stock Adjustment
              </Typography>
              <Divider sx={dividerSx} />

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={inputLabelSx}>Adjustment Type</InputLabel>
                    <Select
                      id="adjust-stock-type"
                      value={adjustmentType}
                      label="Adjustment Type *"
                      onChange={(e: SelectChangeEvent) => handleAdjustmentTypeChange(e.target.value as 'adjustment' | 'transfer' | 'damage' | 'expiry' | 'purchase' | '')}
                      open={adjustmentTypeSelectOpen}
                      onOpen={handleAdjustmentTypeSelectOpen}
                      onClose={handleAdjustmentTypeSelectClose}
                      disabled={processing}
                      tabIndex={1}
                      required
                      error={!adjustmentType}
                      sx={selectSx}
                    >
                      <MenuItem value="" disabled sx={menuItemSx}>
                        <em>Select adjustment type...</em>
                      </MenuItem>
                      <MenuItem value="adjustment" onClick={(e) => handleAdjustmentTypeMenuItemClick(e)} sx={menuItemSx}>Stock Adjustment (Add/Subtract for corrections)</MenuItem>
                      <MenuItem value="purchase" onClick={(e) => handleAdjustmentTypeMenuItemClick(e)} sx={menuItemSx}>Purchase/Receiving</MenuItem>
                      <MenuItem value="damage" onClick={(e) => handleAdjustmentTypeMenuItemClick(e)} sx={menuItemSx}>Damage/Loss</MenuItem>
                      <MenuItem value="expiry" onClick={(e) => handleAdjustmentTypeMenuItemClick(e)} sx={menuItemSx}>Expiry</MenuItem>
                      <MenuItem value="transfer" onClick={(e) => handleAdjustmentTypeMenuItemClick(e)} sx={menuItemSx}>Transfer</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="adjust-stock-quantity"
                    label={quantityLabel}
                    type="number"
                    value={quantity}
                    onChange={handleQuantityChange}
                    onKeyDown={handleQuantityKeyDown}
                    helperText={quantityHelperText}
                    inputProps={{ 
                      step: 0.01,
                      min: (adjustmentType === 'purchase' || adjustmentType === 'damage' || adjustmentType === 'expiry') ? 0 : undefined
                    }}
                    disabled={processing || !adjustmentType}
                    tabIndex={2}
                    autoFocus={!!adjustmentType}
                    sx={textFieldSx}
                  />
                </Grid>

                {adjustmentType === 'purchase' && quantity && !isNaN(parseFloat(quantity)) && parseFloat(quantity) > 0 && (
                  <Grid item xs={12}>
                    <DatePicker
                      label="Expiry Date (optional)"
                      value={expiryDate}
                      onChange={handleExpiryDateChange}
                      slotProps={{
                        textField: {
                          id: 'adjust-stock-expiry',
                          fullWidth: true,
                          onKeyDown: handleExpiryDateKeyDown,
                          helperText: 'Set expiry date for this stock batch',
                          disabled: processing,
                          tabIndex: 3,
                          sx: textFieldSx,
                        },
                      }}
                    />
                  </Grid>
                )}
                
                {adjustmentType === 'adjustment' && quantity && !isNaN(parseFloat(quantity)) && parseFloat(quantity) > 0 && (
                  <Grid item xs={12}>
                    <DatePicker
                      label="Expiry Date (optional)"
                      value={expiryDate}
                      onChange={handleExpiryDateChange}
                      slotProps={{
                        textField: {
                          id: 'adjust-stock-expiry',
                          fullWidth: true,
                          onKeyDown: handleExpiryDateKeyDown,
                          helperText: 'Set expiry date for this stock batch (only for additions)',
                          disabled: processing,
                          tabIndex: 3,
                          sx: textFieldSx,
                        },
                      }}
                    />
                  </Grid>
                )}

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="adjust-stock-reason"
                    label="Reason (optional)"
                    multiline
                    rows={3}
                    value={reason}
                    onChange={handleReasonChange}
                    onKeyDown={handleReasonKeyDown}
                    placeholder="Enter reason for this stock adjustment..."
                    disabled={processing}
                    tabIndex={4}
                    sx={textFieldMultilineSx}
                  />
                </Grid>

                {/* Warning if stock goes negative */}
                {quantity && !isNaN(parseFloat(quantity)) && parseFloat(quantity) !== 0 && !isNaN(newQuantity) && newQuantity < 0 && (
                  <Grid item xs={12}>
                    <Alert severity="warning" sx={warningAlertSx}>
                      Warning: This adjustment will result in negative stock ({newQuantity.toFixed(2)} {inventoryItem.product.unit})
                    </Alert>
                  </Grid>
                )}

                {/* Warning if stock goes below reorder level */}
                {quantity && !isNaN(parseFloat(quantity)) && parseFloat(quantity) !== 0 && !isNaN(newQuantity) && newQuantity > 0 && newQuantity <= inventoryItem.reorderLevel && (
                  <Grid item xs={12}>
                    <Alert severity="info" sx={infoAlertSx}>
                      Note: Stock will be at or below reorder level after this adjustment
                    </Alert>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Box sx={buttonsBoxSx}>
                    <Button
                      onClick={handleCancel}
                      disabled={processing}
                      variant="outlined"
                      tabIndex={5}
                      sx={cancelButtonSx}
                    >
                      Cancel
                    </Button>
                    <Button
                      id="adjust-stock-submit"
                      onClick={handleAdjust}
                      variant="contained"
                      disabled={processing || !adjustmentType || !quantity || parseFloat(quantity) === 0}
                      tabIndex={6}
                      sx={submitButtonSx}
                    >
                      {processing ? 'Processing...' : 'Adjust Stock'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      <Toast toast={toast} onClose={hideToast} />
    </MainLayout>
  );
};

export default AdjustStock;

