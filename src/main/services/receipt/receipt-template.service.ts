import { ReceiptTemplate, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TransactionWithRelations } from '../transaction/transaction.service';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

export interface ReceiptTemplateData {
  header?: {
    storeName?: string;
    address?: string;
    phone?: string;
    logo?: string;
    customText?: string;
  };
  items?: {
    showHeaders?: boolean;
    showSeparator?: boolean;
    columns?: {
      description?: boolean;
      quantity?: boolean;
      unitPrice?: boolean;
      total?: boolean;
    };
  };
  totals?: {
    showSubtotal?: boolean;
    showDiscount?: boolean;
    showTax?: boolean;
    showTotalUSD?: boolean;
    showTotalLBP?: boolean;
  };
  footer?: {
    thankYouMessage?: string;
    showCashier?: boolean;
    showPoweredBy?: boolean;
    customText?: string;
  };
  layout?: {
    paperWidth?: number;
    fontSize?: number;
    lineSpacing?: number;
  };
}

export interface CreateReceiptTemplateInput {
  name: string;
  description?: string;
  template: ReceiptTemplateData;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateReceiptTemplateInput {
  name?: string;
  description?: string;
  template?: ReceiptTemplateData;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ReceiptTemplateListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

/**
 * Receipt Template Service
 * Handles receipt template management and rendering
 */
export class ReceiptTemplateService {
  /**
   * Get template by ID
   */
  static async getById(id: number): Promise<ReceiptTemplate | null> {
    try {
      const prisma = databaseService.getClient();
      const template = await prisma.receiptTemplate.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
          updater: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
      return template;
    } catch (error) {
      logger.error('Error getting receipt template by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get default template
   */
  static async getDefault(): Promise<ReceiptTemplate | null> {
    try {
      const prisma = databaseService.getClient();
      const template = await prisma.receiptTemplate.findFirst({
        where: {
          isDefault: true,
          isActive: true,
        },
      });
      return template;
    } catch (error) {
      logger.error('Error getting default receipt template', { error });
      throw error;
    }
  }

  /**
   * Get templates list with pagination and filtering
   */
  static async getList(options: ReceiptTemplateListOptions = {}): Promise<{
    templates: ReceiptTemplate[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const prisma = databaseService.getClient();
      const {
        page = 1,
        pageSize = 20,
        search,
        isActive,
      } = options;

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.ReceiptTemplateWhereInput = {};
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
        ];
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Get templates and total count
      const [templates, total] = await Promise.all([
        prisma.receiptTemplate.findMany({
          where,
          orderBy: [
            { isDefault: 'desc' },
            { name: 'asc' },
          ],
          skip,
          take: pageSize,
        }),
        prisma.receiptTemplate.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        templates,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting receipt templates list', { options, error });
      throw error;
    }
  }

  /**
   * Get all active templates
   */
  static async getActiveTemplates(): Promise<ReceiptTemplate[]> {
    try {
      const prisma = databaseService.getClient();
      const templates = await prisma.receiptTemplate.findMany({
        where: { isActive: true },
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' },
        ],
      });
      return templates;
    } catch (error) {
      logger.error('Error getting active receipt templates', { error });
      throw error;
    }
  }

  /**
   * Create template
   */
  static async create(input: CreateReceiptTemplateInput, userId: number): Promise<ReceiptTemplate> {
    try {
      const prisma = databaseService.getClient();

      // Validate required fields
      if (!input.name || input.name.trim() === '') {
        throw new Error('Template name is required');
      }

      // If setting as default, unset other default templates
      if (input.isDefault) {
        await prisma.receiptTemplate.updateMany({
          where: {
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Create template
      const template = await prisma.receiptTemplate.create({
        data: {
          name: input.name,
          description: input.description || null,
          template: JSON.stringify(input.template),
          isDefault: input.isDefault || false,
          isActive: input.isActive !== undefined ? input.isActive : true,
          createdBy: userId,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'create',
        entity: 'receipt_template',
        entityId: template.id,
        details: JSON.stringify({ name: template.name }),
      });

      logger.info('Receipt template created successfully', { id: template.id, name: template.name });
      return template;
    } catch (error) {
      logger.error('Error creating receipt template', { input, error });
      throw error;
    }
  }

  /**
   * Update template
   */
  static async update(
    id: number,
    input: UpdateReceiptTemplateInput,
    userId: number
  ): Promise<ReceiptTemplate> {
    try {
      const prisma = databaseService.getClient();

      // Check if template exists
      const existing = await prisma.receiptTemplate.findUnique({ where: { id } });
      if (!existing) {
        throw new Error(`Template with ID ${id} not found`);
      }

      // Validate required fields if they're being updated
      if (input.name !== undefined) {
        if (!input.name || input.name.trim() === '') {
          throw new Error('Template name is required');
        }
      }

      // If setting as default, unset other default templates
      if (input.isDefault === true) {
        await prisma.receiptTemplate.updateMany({
          where: {
            isDefault: true,
            id: { not: id },
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Update template
      const template = await prisma.receiptTemplate.update({
        where: { id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.template && { template: JSON.stringify(input.template) }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          updatedBy: userId,
        },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'receipt_template',
        entityId: template.id,
        details: JSON.stringify({ name: template.name }),
      });

      logger.info('Receipt template updated successfully', { id: template.id, name: template.name });
      return template;
    } catch (error) {
      logger.error('Error updating receipt template', { id, input, error });
      throw error;
    }
  }

  /**
   * Delete template
   */
  static async delete(id: number, userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      // Check if template exists
      const template = await prisma.receiptTemplate.findUnique({
        where: { id },
      });
      if (!template) {
        throw new Error(`Template with ID ${id} not found`);
      }

      // Don't allow deleting default template
      if (template.isDefault) {
        throw new Error('Cannot delete default template. Please set another template as default first.');
      }

      // Delete template
      await prisma.receiptTemplate.delete({
        where: { id },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'delete',
        entity: 'receipt_template',
        entityId: id,
        details: JSON.stringify({ name: template.name }),
      });

      logger.info('Receipt template deleted successfully', { id, name: template.name });
    } catch (error) {
      logger.error('Error deleting receipt template', { id, error });
      throw error;
    }
  }

  /**
   * Set template as default
   */
  static async setDefault(id: number, userId: number): Promise<ReceiptTemplate> {
    try {
      const prisma = databaseService.getClient();

      // Get template to find supplier
      const template = await prisma.receiptTemplate.findUnique({
        where: { id },
      });
      if (!template) {
        throw new Error(`Template with ID ${id} not found`);
      }

      // Unset other default templates
      await prisma.receiptTemplate.updateMany({
        where: {
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });

      // Set this template as default
      const updated = await prisma.receiptTemplate.update({
        where: { id },
        data: { isDefault: true },
      });

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'receipt_template',
        entityId: id,
        details: JSON.stringify({ action: 'set_default', name: updated.name }),
      });

      logger.info('Receipt template set as default', { id, name: updated.name });
      return updated;
    } catch (error) {
      logger.error('Error setting template as default', { id, error });
      throw error;
    }
  }

  /**
   * Render receipt using template
   */
  static async renderReceipt(
    templateId: number | null,
    storeInfo: { name: string; address: string; phone: string; logo?: string },
    transaction: TransactionWithRelations,
    exchangeRate: number,
    vatRate: number,
    paperWidth: number = 80
  ): Promise<string> {
    try {
      const prisma = databaseService.getClient();
      
      // Get template (or default if not specified)
      let template: ReceiptTemplate | null = null;
      if (templateId) {
        template = await prisma.receiptTemplate.findUnique({
          where: { id: templateId, isActive: true },
        });
      }
      
      if (!template) {
        template = await prisma.receiptTemplate.findFirst({
          where: { isDefault: true, isActive: true },
        });
      }

      // If no template found, use default hardcoded format
      if (!template) {
        return this.renderDefaultReceipt(storeInfo, transaction, exchangeRate, vatRate, paperWidth);
      }

      // Parse template data
      const templateData: ReceiptTemplateData = JSON.parse(template.template);
      
      // Render receipt using template
      return this.renderWithTemplate(templateData, storeInfo, transaction, exchangeRate, vatRate, paperWidth);
    } catch (error) {
      logger.error('Error rendering receipt with template', { templateId, error });
      // Fallback to default format on error
      return this.renderDefaultReceipt(storeInfo, transaction, exchangeRate, vatRate, paperWidth);
    }
  }

  /**
   * Render receipt using template data
   */
  private static renderWithTemplate(
    templateData: ReceiptTemplateData,
    storeInfo: { name: string; address: string; phone: string; logo?: string },
    transaction: TransactionWithRelations,
    exchangeRate: number,
    vatRate: number,
    paperWidth: number
  ): string {
    let receipt = '';
    const date = moment.utc(transaction.createdAt).tz(TIMEZONE).format('MMM DD, YYYY HH:mm:ss');

    // Header section
    if (templateData.header) {
      const header = templateData.header;
      if (header.storeName !== undefined && header.storeName !== null) {
        receipt += header.storeName || storeInfo.name || 'DigitalizePOS';
        receipt += '\n';
      }
      if (header.address !== undefined && header.address !== null) {
        receipt += header.address || storeInfo.address || '';
        if (header.address || storeInfo.address) receipt += '\n';
      }
      if (header.phone !== undefined && header.phone !== null) {
        receipt += header.phone || storeInfo.phone || '';
        if (header.phone || storeInfo.phone) receipt += '\n';
      }
      if (header.customText) {
        receipt += header.customText + '\n';
      }
      receipt += '\n\n\n';
    }

    // Transaction info
    receipt += `Receipt #${transaction.transactionNumber}\n`;
    receipt += `${date}\n`;
    receipt += '\n\n\n';

    // Items section
    if (templateData.items) {
      const items = templateData.items;
      const showHeaders = items.showHeaders !== false;
      const showSeparator = items.showSeparator !== false;
      const columns = items.columns || {};

      if (showHeaders && (columns.description !== false || columns.quantity !== false || columns.unitPrice !== false || columns.total !== false)) {
        const headers: string[] = [];
        if (columns.description !== false) headers.push('Description');
        if (columns.quantity !== false) headers.push('Qty');
        if (columns.unitPrice !== false) headers.push('Price');
        if (columns.total !== false) headers.push('Total');
        receipt += headers.join(' ') + '\n';
      }

      if (showSeparator) {
        receipt += '-'.repeat(40) + '\n';
      }

      transaction.items.forEach((item) => {
        const product = item.product;
        const qty = item.quantity;
        const description = product?.name || '';
        const unitPrice = item.unitPrice;
        const total = item.total;

        const isReturned = total < 0;
        const unitPriceFormatted = isReturned 
          ? `($${Math.abs(unitPrice).toFixed(2)})`
          : `$${unitPrice.toFixed(2)}`;
        const totalFormatted = isReturned 
          ? `($${Math.abs(total).toFixed(2)})`
          : `$${total.toFixed(2)}`;
        const qtyFormatted = isReturned
          ? (Math.abs(qty) % 1 === 0 ? Math.abs(qty).toString() : Math.abs(qty).toFixed(2))
          : (qty % 1 === 0 ? qty.toString() : qty.toFixed(2));

        const row: string[] = [];
        if (columns.description !== false) row.push(description);
        if (columns.quantity !== false) row.push(qtyFormatted);
        if (columns.unitPrice !== false) row.push(unitPriceFormatted);
        if (columns.total !== false) row.push(totalFormatted);
        receipt += row.join(' ') + '\n';
      });
      receipt += '\n\n\n';
    }

    // Totals section
    if (templateData.totals) {
      const totals = templateData.totals;
      const subtotal = transaction.items.reduce((sum, item) => sum + item.total, 0);
      const discount = transaction.discount || 0;
      const tax = vatRate > 0 ? subtotal * (vatRate / 100) : 0;
      const total = transaction.total;

      if (totals.showSubtotal !== false) {
        receipt += `Subtotal: $${subtotal.toFixed(2)}\n`;
      }
      if (totals.showDiscount !== false && discount > 0) {
        receipt += `Discount: $${discount.toFixed(2)}\n`;
      }
      if (totals.showTax !== false && tax > 0) {
        receipt += `Tax: $${tax.toFixed(2)}\n`;
      }
      if (totals.showTotalUSD !== false) {
        receipt += `Total USD: $${total.toFixed(2)}\n`;
      }
      if (totals.showTotalLBP !== false) {
        const totalLBP = Math.round(total * exchangeRate);
        receipt += `Total LBP: ${totalLBP.toLocaleString()} LBP\n`;
      }
      receipt += '\n';
    }

    // Footer section
    if (templateData.footer) {
      const footer = templateData.footer;
      if (footer.thankYouMessage) {
        receipt += footer.thankYouMessage + '\n';
      }
      if (footer.showCashier !== false && transaction.cashier?.username) {
        receipt += `You have been assisted by ${transaction.cashier.username}\n`;
      }
      if (footer.showPoweredBy !== false) {
        receipt += 'Powered by DigitalizePOS\n';
        receipt += 'www.digitalizepos.com\n';
      }
      if (footer.customText) {
        receipt += footer.customText + '\n';
      }
    }

    return receipt;
  }

  /**
   * Render default receipt (fallback)
   */
  private static renderDefaultReceipt(
    storeInfo: { name: string; address: string; phone: string; logo?: string },
    transaction: TransactionWithRelations,
    exchangeRate: number,
    vatRate: number,
    paperWidth: number
  ): string {
    // Use the existing hardcoded format as fallback
    // This would call the existing generateReceiptContent method
    // For now, return a simple format
    const date = moment.utc(transaction.createdAt).tz(TIMEZONE).format('MMM DD, YYYY HH:mm:ss');
    let receipt = `${storeInfo.name || 'DigitalizePOS'}\n`;
    if (storeInfo.address) receipt += `${storeInfo.address}\n`;
    if (storeInfo.phone) receipt += `${storeInfo.phone}\n`;
    receipt += '\n\n\n';
    receipt += `Receipt #${transaction.transactionNumber}\n`;
    receipt += `${date}\n\n\n`;
    
    transaction.items.forEach((item) => {
      receipt += `${item.product?.name || ''} x${item.quantity} = $${item.total.toFixed(2)}\n`;
    });
    
    receipt += `\nTotal: $${transaction.total.toFixed(2)}\n`;
    receipt += `Total LBP: ${Math.round(transaction.total * exchangeRate).toLocaleString()} LBP\n`;
    receipt += '\nThank you for your purchase!\n';
    
    return receipt;
  }
}

