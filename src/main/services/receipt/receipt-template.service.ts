import { ReceiptTemplate, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TransactionWithRelations } from '../transaction/transaction.service';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

export interface ReceiptTemplateData {
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
  printing?: {
    paperWidth?: number;
    printerName?: string;
    autoPrint?: boolean;
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
   * Get default template data matching current receipt format
   */
  static getDefaultTemplateData(): ReceiptTemplateData {
    return {
      items: {
        showHeaders: true,
        showSeparator: true,
        columns: {
          description: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
      totals: {
        showSubtotal: true,
        showDiscount: true,
        showTax: true,
        showTotalUSD: true,
        showTotalLBP: true,
      },
      footer: {
        thankYouMessage: 'Thank you for your purchase! We hope to see you again soon!',
        showCashier: true,
        showPoweredBy: true,
        customText: '',
      },
      printing: {
        paperWidth: 80,
        printerName: '',
        autoPrint: true,
      },
    };
  }

  /**
   * Ensure default template exists in database
   * Creates it if it doesn't exist
   */
  static async ensureDefaultTemplate(userId: number = 1): Promise<ReceiptTemplate> {
    try {
      const prisma = databaseService.getClient();
      const DEFAULT_TEMPLATE_NAME = 'Default Receipt Template';
      
      // First, check for duplicates with the same name and clean them up
      const duplicates = await prisma.receiptTemplate.findMany({
        where: {
          name: DEFAULT_TEMPLATE_NAME,
        },
        orderBy: {
          createdAt: 'asc', // Keep the oldest one
        },
      });

      // If there are duplicates, keep only the first one and delete the rest
      if (duplicates.length > 1) {
        logger.warn('Found duplicate default templates, cleaning up', { count: duplicates.length });
        const templateToKeep = duplicates[0];
        const idsToDelete = duplicates.slice(1).map(t => t.id);
        
        // Delete duplicates
        await prisma.receiptTemplate.deleteMany({
          where: {
            id: { in: idsToDelete },
          },
        });
        
        // Ensure the kept template is default and active
        let defaultTemplate: ReceiptTemplate;
        if (!templateToKeep.isDefault || !templateToKeep.isActive) {
          // Unset ALL defaults first, then set this one
          await prisma.receiptTemplate.updateMany({
            where: {
              isDefault: true,
            },
            data: {
              isDefault: false,
            },
          });
          
          defaultTemplate = await prisma.receiptTemplate.update({
            where: { id: templateToKeep.id },
            data: {
              isDefault: true,
              isActive: true,
            },
          });
        } else {
          defaultTemplate = templateToKeep;
        }
        
        logger.info('Duplicate default templates cleaned up', { 
          kept: defaultTemplate.id, 
          deleted: idsToDelete.length 
        });
        return defaultTemplate;
      }
      
      // Check if a template with the exact name exists (single one)
      let defaultTemplate = duplicates.length === 1 ? duplicates[0] : await prisma.receiptTemplate.findFirst({
        where: {
          name: DEFAULT_TEMPLATE_NAME,
        },
      });

      if (defaultTemplate) {
        // Template exists - only update if it's not already default and active
        // Don't force it to be default if user has set a different template as default
        let needsUpdate = false;
        const updateData: { isDefault?: boolean; isActive?: boolean; template?: string } = {};
        
        // Only set as default if NO other template is currently default
        // This prevents overriding user's choice
        const existingDefault = await prisma.receiptTemplate.findFirst({
          where: { isDefault: true },
        });
        
        // Only make this default if there's no other default template
        if (!existingDefault && (!defaultTemplate.isDefault || !defaultTemplate.isActive)) {
          needsUpdate = true;
          updateData.isDefault = true;
          updateData.isActive = true;
        } else if (!defaultTemplate.isActive) {
          // Only update isActive if it's not active, but don't change isDefault
          needsUpdate = true;
          updateData.isActive = true;
        }
        
        // Check if template data has autoPrint field, if not, add it
        try {
          const templateData: ReceiptTemplateData = JSON.parse(defaultTemplate.template);
          if (templateData.printing?.autoPrint === undefined) {
            needsUpdate = true;
            templateData.printing = templateData.printing || {};
            templateData.printing.autoPrint = true; // Default to true
            updateData.template = JSON.stringify(templateData);
            logger.info('Adding autoPrint field to existing default template', { id: defaultTemplate.id });
          }
        } catch (error) {
          logger.warn('Failed to parse template data for autoPrint migration', { id: defaultTemplate.id, error });
        }
        
        if (needsUpdate) {
          // Unset ALL default templates first (if making this default)
          if (updateData.isDefault) {
            await prisma.receiptTemplate.updateMany({
              where: {
                isDefault: true,
              },
              data: {
                isDefault: false,
              },
            });
          }
          
          // Update this template
          defaultTemplate = await prisma.receiptTemplate.update({
            where: { id: defaultTemplate.id },
            data: updateData,
          });
          logger.info('Default receipt template updated', { id: defaultTemplate.id, updates: Object.keys(updateData) });
        } else {
          logger.info('Default receipt template already exists and is properly configured', { id: defaultTemplate.id, name: defaultTemplate.name });
        }
        return defaultTemplate;
      }

      // Check if any default template exists (in case name is different)
      const existingDefault = await prisma.receiptTemplate.findFirst({
        where: {
          isDefault: true,
        },
      });

      if (existingDefault) {
        // Check if template data has autoPrint field, if not, add it
        try {
          const templateData: ReceiptTemplateData = JSON.parse(existingDefault.template);
          if (templateData.printing?.autoPrint === undefined) {
            templateData.printing = templateData.printing || {};
            templateData.printing.autoPrint = true; // Default to true
            await prisma.receiptTemplate.update({
              where: { id: existingDefault.id },
              data: {
                template: JSON.stringify(templateData),
              },
            });
            logger.info('Added autoPrint field to existing default template', { id: existingDefault.id });
          }
        } catch (error) {
          logger.warn('Failed to parse template data for autoPrint migration', { id: existingDefault.id, error });
        }
        logger.info('Default template exists with different name, using existing', { id: existingDefault.id, name: existingDefault.name });
        return existingDefault;
      }

      // No default template exists - create one
      // Double-check to prevent race conditions (another call might have created it)
      const doubleCheck = await prisma.receiptTemplate.findFirst({
        where: {
          name: DEFAULT_TEMPLATE_NAME,
        },
      });

      if (doubleCheck) {
        // Another call created it - ensure it's default and return it
        if (!doubleCheck.isDefault) {
          // Unset ALL defaults first, then set this one
          await prisma.receiptTemplate.updateMany({
            where: {
              isDefault: true,
            },
            data: {
              isDefault: false,
            },
          });
          defaultTemplate = await prisma.receiptTemplate.update({
            where: { id: doubleCheck.id },
            data: { isDefault: true },
          });
        } else {
          defaultTemplate = doubleCheck;
        }
        logger.info('Default receipt template found after double-check (race condition prevented)', { id: defaultTemplate.id });
        return defaultTemplate;
      }

      const templateData = this.getDefaultTemplateData();
      
      // Unset any other default templates (shouldn't be any, but just in case)
      await prisma.receiptTemplate.updateMany({
        where: {
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      // Try to create - catch unique constraint violation if it was created by another call
      try {
        defaultTemplate = await prisma.receiptTemplate.create({
          data: {
            name: DEFAULT_TEMPLATE_NAME,
            description: 'Default template matching the current receipt format',
            template: JSON.stringify(templateData),
            isDefault: true,
            isActive: true,
            createdBy: userId,
          },
        });

        logger.info('Default receipt template created', { id: defaultTemplate.id, name: defaultTemplate.name });
        return defaultTemplate;
      } catch (error: any) {
        // If creation failed (e.g., duplicate key), try to find the existing one
        if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
          logger.warn('Default template creation failed due to duplicate, fetching existing', { error: error.message });
          const existing = await prisma.receiptTemplate.findFirst({
            where: {
              name: DEFAULT_TEMPLATE_NAME,
            },
          });
          if (existing) {
            // Ensure it's marked as default
            if (!existing.isDefault) {
              // Unset ALL defaults first, then set this one
              await prisma.receiptTemplate.updateMany({
                where: {
                  isDefault: true,
                },
                data: {
                  isDefault: false,
                },
              });
              defaultTemplate = await prisma.receiptTemplate.update({
                where: { id: existing.id },
                data: { isDefault: true },
              });
            } else {
              defaultTemplate = existing;
            }
            logger.info('Default receipt template found after creation conflict', { id: defaultTemplate.id });
            return defaultTemplate;
          }
        }
        throw error;
      }
    } catch (error) {
      logger.error('Error ensuring default receipt template', { error });
      throw error;
    }
  }

  /**
   * Get default template
   */
  static async getDefault(): Promise<ReceiptTemplate | null> {
    try {
      const prisma = databaseService.getClient();
      let template = await prisma.receiptTemplate.findFirst({
        where: {
          isDefault: true,
          isActive: true,
        },
      });

      // If no default template exists, create one
      if (!template) {
        template = await this.ensureDefaultTemplate(1);
      }

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
      // Ensure default template exists
      await this.ensureDefaultTemplate(1);
      
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
      // Ensure default template exists
      await this.ensureDefaultTemplate(1);
      
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

      // Check if this will be the only template
      const existingTemplatesCount = await prisma.receiptTemplate.count();
      const willBeOnlyTemplate = existingTemplatesCount === 0;

      // If this will be the only template, automatically set as default
      const shouldBeDefault = willBeOnlyTemplate || input.isDefault;

      // If setting as default, unset all other defaults first in a transaction
      if (shouldBeDefault) {
        await prisma.$transaction(async (tx) => {
          await tx.receiptTemplate.updateMany({
            where: {
              isDefault: true,
            },
            data: {
              isDefault: false,
              updatedAt: new Date(),
            },
          });
        });
        logger.info('Unset all existing defaults before creating new default template');
      }

      // Create the new template
      const template = await prisma.receiptTemplate.create({
        data: {
          name: input.name,
          description: input.description || null,
          template: JSON.stringify(input.template),
          isDefault: shouldBeDefault,
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

      // Check total templates count
      const totalTemplatesCount = await prisma.receiptTemplate.count();

      // Prevent unsetting default if this is the only template
      if (input.isDefault === false && existing.isDefault && totalTemplatesCount === 1) {
        throw new Error('Cannot unset default template. This is the only template and must remain as default.');
      }

      // If setting as default, unset all other defaults first in a transaction
      if (input.isDefault === true) {
        await prisma.$transaction(async (tx) => {
          // First, unset ALL templates that are currently default
          const unsetResult = await tx.receiptTemplate.updateMany({
            where: {
              isDefault: true,
            },
            data: {
              isDefault: false,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          });
          logger.info('Unset all defaults before updating template', {
            templateId: id,
            unsetCount: unsetResult.count,
          });
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

      const totalTemplatesCount = await prisma.receiptTemplate.count();
      
      // If this is a default template and there are other templates
      if (template.isDefault && totalTemplatesCount > 1) {
        // Check if there are other templates with the same name (duplicates)
        const duplicateTemplates = await prisma.receiptTemplate.findMany({
          where: {
            name: template.name,
            id: { not: id },
          },
        });

        // If there are duplicates with the same name, allow deletion and set one as default
        if (duplicateTemplates.length > 0) {
          // Set the first duplicate as default before deleting
          await prisma.receiptTemplate.update({
            where: { id: duplicateTemplates[0].id },
            data: { isDefault: true },
          });
          logger.info('Set duplicate template as default before deletion', { 
            deletedId: id, 
            newDefaultId: duplicateTemplates[0].id 
          });
        } else {
          // No duplicates - find another template to set as default
          const otherTemplate = await prisma.receiptTemplate.findFirst({
            where: {
              id: { not: id },
            },
          });
          
          if (otherTemplate) {
            await prisma.receiptTemplate.update({
              where: { id: otherTemplate.id },
              data: { isDefault: true },
            });
            logger.info('Set another template as default before deletion', { 
              deletedId: id, 
              newDefaultId: otherTemplate.id 
            });
          } else {
            throw new Error('Cannot delete default template. Please set another template as default first.');
          }
        }
      }

      // Delete template
      await prisma.receiptTemplate.delete({
        where: { id },
      });

      // If only one template remains after deletion, set it as default
      const remainingTemplatesCount = await prisma.receiptTemplate.count();
      if (remainingTemplatesCount === 1) {
        const remainingTemplate = await prisma.receiptTemplate.findFirst();
        if (remainingTemplate && !remainingTemplate.isDefault) {
          await prisma.receiptTemplate.update({
            where: { id: remainingTemplate.id },
            data: { isDefault: true },
          });
          logger.info('Automatically set remaining template as default', { id: remainingTemplate.id });
        }
      }

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

      // Get template to verify it exists
      const template = await prisma.receiptTemplate.findUnique({
        where: { id },
      });
      if (!template) {
        throw new Error(`Template with ID ${id} not found`);
      }

      // Check current default templates before update
      const currentDefaults = await prisma.receiptTemplate.findMany({
        where: { isDefault: true },
        select: { id: true, name: true },
      });
      logger.info('Current default templates before setDefault', {
        templateId: id,
        currentDefaults: currentDefaults.map(t => ({ id: t.id, name: t.name })),
      });

      // Use a transaction with explicit steps to ensure atomicity
      // First find all defaults, then update them individually
      const updated = await prisma.$transaction(async (tx) => {
        // Step 1: Find ALL templates that are currently default
        const defaultTemplates = await tx.receiptTemplate.findMany({
          where: {
            isDefault: true,
          },
          select: { id: true, name: true },
        });
        
        logger.info('Found default templates to unset', {
          templateId: id,
          defaultTemplates: defaultTemplates.map((t: { id: number; name: string }) => ({ id: t.id, name: t.name })),
        });

        // Step 2: Unset each default template individually
        for (const defaultTemplate of defaultTemplates) {
          await tx.receiptTemplate.update({
            where: { id: defaultTemplate.id },
            data: {
              isDefault: false,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          });
        }
        
        logger.info('Unset all default templates', {
          templateId: id,
          unsetCount: defaultTemplates.length,
        });

        // Step 3: Set the target template as default
        const result = await tx.receiptTemplate.update({
          where: { id },
          data: {
            isDefault: true,
            updatedBy: userId,
          },
        });

        logger.info('Set template as default', {
          templateId: id,
          templateName: result.name,
          isDefault: result.isDefault,
        });

        return result;
      }, {
        timeout: 10000, // 10 second timeout
      });

      // Verify the result - query directly from database to ensure it persisted
      // Wait a tiny bit to ensure transaction is fully committed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const verifyDefaults = await prisma.receiptTemplate.findMany({
        where: { isDefault: true },
        select: { id: true, name: true },
      });
      logger.info('Default templates after setDefault (verified)', {
        templateId: id,
        defaults: verifyDefaults.map(t => ({ id: t.id, name: t.name })),
      });

      if (verifyDefaults.length !== 1 || verifyDefaults[0].id !== id) {
        logger.error('Invalid state after setDefault - multiple defaults or wrong default', {
          templateId: id,
          defaults: verifyDefaults,
        });
        
        // Try to fix it - unset all and set the correct one
        logger.warn('Attempting to fix invalid default state', { templateId: id });
        await prisma.receiptTemplate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
        await prisma.receiptTemplate.update({
          where: { id },
          data: { isDefault: true, updatedBy: userId },
        });
        
        // Verify again
        const recheck = await prisma.receiptTemplate.findMany({
          where: { isDefault: true },
          select: { id: true, name: true },
        });
        
        if (recheck.length !== 1 || recheck[0].id !== id) {
          throw new Error('Failed to set template as default - could not fix invalid state');
        }
        
        logger.info('Fixed invalid default state', { templateId: id });
      }

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
    paperWidth: number = 80,
    cashierUsername?: string | null
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
        return this.renderDefaultReceipt(storeInfo, transaction, exchangeRate, vatRate, paperWidth, cashierUsername);
      }

      // Parse template data
      const templateData: ReceiptTemplateData = JSON.parse(template.template);
      
      // Render receipt using template
      return this.renderWithTemplate(templateData, storeInfo, transaction, exchangeRate, vatRate, paperWidth, cashierUsername);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _paperWidth: number,
    cashierUsername?: string | null
  ): string {
    let receipt = '';
    const date = moment.utc(transaction.createdAt).tz(TIMEZONE).format('MMM DD, YYYY HH:mm:ss');

    // Header section - always use store information settings
    receipt += storeInfo.name || 'DigitalizePOS';
    receipt += '\n';
    if (storeInfo.address) {
      receipt += storeInfo.address + '\n';
    }
    if (storeInfo.phone) {
      receipt += storeInfo.phone + '\n';
    }
    receipt += '\n\n\n';

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
        // Fix Arabic text word order for proper rendering
        const description = this.fixArabicTextOrder(product?.name || '');
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
      const subtotal = transaction.subtotal || transaction.items.reduce((sum, item) => sum + item.total, 0);
      const discount = transaction.discount || 0;
      // Use transaction's tax value instead of recalculating
      const tax = transaction.tax || 0;
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
      receipt += '\n'; // Add space before footer
      if (footer.thankYouMessage) {
        // Fix Arabic text order for thank you message
        const fixedThankYouMessage = this.fixArabicTextOrder(footer.thankYouMessage);
        receipt += fixedThankYouMessage + '\n';
        receipt += '\n'; // Add space after
      }
      if (footer.showCashier !== false && cashierUsername) {
        receipt += `You have been assisted by ${cashierUsername}\n`;
        receipt += '\n'; // Add space after
      }
      // Always show Powered By
      receipt += 'Powered by DigitalizePOS\n';
      receipt += '\n'; // Add space after
      receipt += 'www.digitalizepos.com\n';
      if (footer.customText) {
        receipt += '\n'; // Add space before custom text
        // Fix Arabic text order for custom footer text (handle multi-line)
        const customTextLines = footer.customText.split('\n');
        const fixedCustomTextLines = customTextLines.map(line => this.fixArabicTextOrder(line));
        receipt += fixedCustomTextLines.join('\n') + '\n';
      }
    } else {
      // Even if footer section doesn't exist, always show website
      receipt += '\n'; // Add space before footer
      receipt += 'Powered by DigitalizePOS\n';
      receipt += '\n'; // Add space after
      receipt += 'www.digitalizepos.com\n';
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _vatRate: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _paperWidth: number,
    cashierUsername?: string | null
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

  /**
   * Check if text contains Arabic characters
   */
  private static containsArabic(text: string): boolean {
    // Arabic Unicode range: U+0600 to U+06FF
    const arabicRegex = /[\u0600-\u06FF]/;
    return arabicRegex.test(text);
  }

  /**
   * Fix Arabic text word order for RTL rendering in LTR context
   * PDFKit renders text LTR, so when Arabic text like "قنينه مياه" is rendered,
   * it appears as "مياه قنينه" (words reversed). We reverse the word order
   * so it displays correctly as "قنينه مياه"
   */
  private static fixArabicTextOrder(text: string): string {
    // Only process if text contains Arabic
    if (!this.containsArabic(text)) {
      return text;
    }

    // Check if the line is primarily Arabic (more Arabic chars than Latin)
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
    const isPrimarilyArabic = arabicChars > 0 && arabicChars >= latinChars;

    // If primarily Arabic, reverse word order to correct the visual display
    if (isPrimarilyArabic) {
      // Simple approach: split by spaces, reverse words, rejoin
      // This handles the case where "قنينه مياه" is being displayed as "مياه قنينه"
      const words = text.split(/\s+/);
      // Reverse the word array
      words.reverse();
      // Rejoin with single spaces
      return words.join(' ');
    }

    // For mixed content, reverse only Arabic word segments
    // Split by whitespace while preserving spaces
    const tokens = text.split(/(\s+)/);
    const result: string[] = [];
    let arabicWords: string[] = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (/\s/.test(token)) {
        // This is whitespace - flush any accumulated Arabic words (reversed)
        if (arabicWords.length > 0) {
          result.push(...arabicWords.reverse());
          arabicWords = [];
        }
        result.push(token);
      } else if (this.containsArabic(token)) {
        // Arabic word - accumulate it
        arabicWords.push(token);
      } else {
        // Non-Arabic word - flush Arabic words first (reversed), then add this word
        if (arabicWords.length > 0) {
          result.push(...arabicWords.reverse());
          arabicWords = [];
        }
        result.push(token);
      }
    }
    
    // Flush any remaining Arabic words
    if (arabicWords.length > 0) {
      result.push(...arabicWords.reverse());
    }
    
    return result.join('');
  }
}

