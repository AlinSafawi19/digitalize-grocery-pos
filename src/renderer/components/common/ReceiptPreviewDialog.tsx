import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Box,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ReceiptTemplateData } from '../../services/receipt-template.service';
import { SettingsService, StoreInfo } from '../../services/settings.service';

interface ReceiptPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  templateData: ReceiptTemplateData;
}

const ReceiptPreviewDialog: React.FC<ReceiptPreviewDialogProps> = ({
  open,
  onClose,
  templateData,
}) => {
  // Get logged-in user from Redux store
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const cashierUsername = currentUser?.username || 'Cashier Name';
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  
  // Fetch store info when dialog opens
  useEffect(() => {
    if (open && currentUser?.id) {
      SettingsService.getStoreInfo(currentUser.id).then((result) => {
        if (result.success && result.storeInfo) {
          setStoreInfo(result.storeInfo);
        }
      });
    }
  }, [open, currentUser?.id]);
  
  // Get paper width from template (default to 80mm)
  const paperWidthMm = templateData.printing?.paperWidth || 80;
  
  // Convert mm to pixels for display (1mm ≈ 3.779527559 pixels at 96 DPI)
  // Using a scale factor of 3.78 for reasonable preview size
  const paperWidthPx = paperWidthMm * 3.78;
  
  // Generate a simple preview text based on template data
  const generatePreview = (): string => {
    let preview = '';

    // Header - always use store information settings
    preview += (storeInfo?.name || 'Store Name') + '\n';
    if (storeInfo?.address) {
      preview += storeInfo.address + '\n';
    }
    if (storeInfo?.phone) {
      preview += storeInfo.phone + '\n';
    }
    preview += '\n\n';

    // Transaction info
    preview += 'Receipt #TXN-001\n';
    preview += 'Jan 01, 2024 12:00:00\n';
    preview += '\n\n';

    // Items
    if (templateData.items) {
      const showHeaders = templateData.items.showHeaders !== false;
      const columns = templateData.items.columns || {};

      if (showHeaders) {
        const headers: string[] = [];
        if (columns.description !== false) headers.push('Description');
        if (columns.quantity !== false) headers.push('Qty');
        if (columns.unitPrice !== false) headers.push('Price');
        if (columns.total !== false) headers.push('Total');
        preview += headers.join(' | ') + '\n';
      }

      if (templateData.items.showSeparator !== false) {
        preview += '-'.repeat(37) + '\n';
      }

      // Sample items
      preview += 'Sample Product 1 | 2 | $10.00 | $20.00\n';
      preview += 'Sample Product 2 | 1 | $15.00 | $15.00\n';
      preview += '\n\n';
    }

    // Totals
    if (templateData.totals) {
      if (templateData.totals.showSubtotal !== false) {
        preview += 'Subtotal: $35.00\n';
      }
      if (templateData.totals.showDiscount !== false) {
        preview += 'Discount: $0.00\n';
      }
      if (templateData.totals.showTax !== false) {
        preview += 'Tax: $0.00\n';
      }
      if (templateData.totals.showTotalUSD !== false) {
        preview += 'Total USD: $35.00\n';
      }
      if (templateData.totals.showTotalLBP !== false) {
        preview += 'Total LBP: 525,000 LBP\n';
      }
      preview += '\n';
    }

    // Footer
    if (templateData.footer) {
      preview += '\n'; // Add space before footer
      if (templateData.footer.thankYouMessage) {
        preview += templateData.footer.thankYouMessage + '\n';
        preview += '\n'; // Add space after
      }
      if (templateData.footer.showCashier !== false) {
        preview += `You have been assisted by ${cashierUsername}\n`;
        preview += '\n'; // Add space after
      }
      // Always show Powered By
      preview += 'Powered by DigitalizePOS\n';
      preview += '\n'; // Add space after
      preview += 'www.digitalizepos.com\n';
      if (templateData.footer.customText) {
        preview += '\n'; // Add space before custom text
        preview += templateData.footer.customText + '\n';
      }
    }

    return preview;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Receipt Preview</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <Paper
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              maxHeight: '500px',
              overflow: 'auto',
              width: `${paperWidthPx}px`,
              minWidth: '200px',
              maxWidth: '100%',
            }}
          >
          {generatePreview().split('\n').map((line, index) => {
            const isTotalUSD = line.trim().startsWith('Total USD:');
            const isTotalLBP = line.trim().startsWith('Total LBP:');
            const trimmedLine = line.trim();
            
            // Check if this is a header line (store name, address, phone)
            const isStoreNameLine = storeInfo?.name && trimmedLine === storeInfo.name;
            const isStoreAddressLine = storeInfo?.address && trimmedLine === storeInfo.address;
            const isStorePhoneLine = storeInfo?.phone && trimmedLine === storeInfo.phone;
            const isHeaderLine = isStoreNameLine || isStoreAddressLine || isStorePhoneLine;
            
            // Check if this is a footer line
            const isFooterLine = 
              (templateData.footer?.thankYouMessage && trimmedLine === templateData.footer.thankYouMessage) ||
              trimmedLine.startsWith('You have been assisted by') ||
              trimmedLine === 'Powered by DigitalizePOS' ||
              trimmedLine === 'www.digitalizepos.com' ||
              (templateData.footer?.customText && trimmedLine === templateData.footer.customText);
            
            if (isTotalUSD || isTotalLBP) {
              return (
                <Box
                  key={index}
                  component="div"
                  sx={{
                    fontSize: '12px', // Reduced from 16px to match printed receipt
                    fontWeight: 'bold',
                    lineHeight: 1.2,
                  }}
                >
                  {line}
                </Box>
              );
            }
            
            if (isHeaderLine) {
              return (
                <Box
                  key={index}
                  component="div"
                  sx={{
                    textAlign: 'center',
                    lineHeight: 1.5,
                    fontSize: isStoreNameLine ? '14px' : '12px',
                  }}
                >
                  {line}
                </Box>
              );
            }
            
            if (isFooterLine) {
              return (
                <Box
                  key={index}
                  component="div"
                  sx={{
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  {line}
                </Box>
              );
            }
            
            return <React.Fragment key={index}>{line}{'\n'}</React.Fragment>;
          })}
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReceiptPreviewDialog;
