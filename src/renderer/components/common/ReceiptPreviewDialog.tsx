import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import { ReceiptTemplateData } from '../../services/receipt-template.service';

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
  // Generate a simple preview text based on template data
  const generatePreview = (): string => {
    let preview = '';

    // Header
    if (templateData.header) {
      if (templateData.header.storeName !== undefined) {
        preview += (templateData.header.storeName || 'Store Name') + '\n';
      }
      if (templateData.header.address !== undefined) {
        preview += (templateData.header.address || 'Store Address') + '\n';
      }
      if (templateData.header.phone !== undefined) {
        preview += (templateData.header.phone || 'Store Phone') + '\n';
      }
      if (templateData.header.customText) {
        preview += templateData.header.customText + '\n';
      }
      preview += '\n\n';
    }

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
        preview += '-'.repeat(40) + '\n';
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
      if (templateData.footer.thankYouMessage) {
        preview += templateData.footer.thankYouMessage + '\n';
      }
      if (templateData.footer.showCashier !== false) {
        preview += 'You have been assisted by Cashier Name\n';
      }
      if (templateData.footer.showPoweredBy !== false) {
        preview += 'Powered by DigitalizePOS\n';
        preview += 'www.digitalizepos.com\n';
      }
      if (templateData.footer.customText) {
        preview += templateData.footer.customText + '\n';
      }
    }

    return preview;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Receipt Preview</DialogTitle>
      <DialogContent>
        <Paper
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            maxHeight: '500px',
            overflow: 'auto',
          }}
        >
          {generatePreview()}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReceiptPreviewDialog;
