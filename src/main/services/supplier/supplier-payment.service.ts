import { SupplierPayment, PurchaseInvoice, Supplier, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { AuditLogService } from '../audit/audit-log.service';
import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

export interface SupplierPaymentWithRelations extends SupplierPayment {
  supplier: Supplier;
  purchaseInvoice?: PurchaseInvoice | null;
}

export interface CreateSupplierPaymentInput {
  supplierId: number;
  purchaseInvoiceId?: number | null;
  amount: number;
  currency?: string;
  paymentDate: Date;
  paymentMethod: 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'other';
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface UpdateSupplierPaymentInput {
  purchaseInvoiceId?: number | null;
  amount?: number;
  currency?: string;
  paymentDate?: Date;
  paymentMethod?: 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'other';
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface SupplierPaymentListOptions {
  page?: number;
  pageSize?: number;
  supplierId?: number;
  purchaseInvoiceId?: number;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'paymentDate' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface SupplierBalanceSummary {
  supplierId: number;
  supplierName: string;
  totalInvoices: number;
  totalInvoiceAmount: number;
  totalPayments: number;
  outstandingBalance: number;
  overdueAmount: number;
  overdueInvoices: number;
}

export interface PaymentReminder {
  supplierId: number;
  supplierName: string;
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  dueDate: Date;
  daysOverdue: number;
  outstandingAmount: number;
}

/**
 * Supplier Payment Service
 * Handles supplier payment tracking and balance calculations
 */
export class SupplierPaymentService {
  /**
   * Create a new supplier payment
   */
  static async createPayment(
    input: CreateSupplierPaymentInput,
    recordedById: number
  ): Promise<SupplierPaymentWithRelations> {
    try {
      const prisma = databaseService.getClient();

      // Validate supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new Error(`Supplier with ID ${input.supplierId} not found`);
      }

      // If payment is linked to an invoice, validate it exists and belongs to the supplier
      if (input.purchaseInvoiceId) {
        const invoice = await prisma.purchaseInvoice.findUnique({
          where: { id: input.purchaseInvoiceId },
          include: { purchaseOrder: true },
        });
        if (!invoice) {
          throw new Error(`Purchase invoice with ID ${input.purchaseInvoiceId} not found`);
        }
        if (invoice.purchaseOrder.supplierId !== input.supplierId) {
          throw new Error('Purchase invoice does not belong to the specified supplier');
        }
      }

      // Create payment
      const payment = await prisma.supplierPayment.create({
        data: {
          supplierId: input.supplierId,
          purchaseInvoiceId: input.purchaseInvoiceId || null,
          amount: input.amount,
          currency: input.currency || 'USD',
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber || null,
          notes: input.notes || null,
          recordedById,
        },
        include: {
          supplier: true,
          purchaseInvoice: {
            include: {
              purchaseOrder: true,
            },
          },
        },
      });

      // Update invoice status if payment is linked to an invoice
      if (input.purchaseInvoiceId) {
        await this.updateInvoiceStatus(input.purchaseInvoiceId);
      }

      // Log audit
      await AuditLogService.log({
        userId: recordedById,
        action: 'create',
        entity: 'supplier_payment',
        entityId: payment.id,
        details: JSON.stringify({
          supplierId: input.supplierId,
          amount: input.amount,
          currency: input.currency || 'USD',
          paymentMethod: input.paymentMethod,
        }),
      });

      logger.info('Supplier payment created', {
        paymentId: payment.id,
        supplierId: input.supplierId,
        amount: input.amount,
      });

      return payment;
    } catch (error) {
      logger.error('Error creating supplier payment', { input, error });
      throw error;
    }
  }

  /**
   * Update invoice status based on payments
   */
  private static async updateInvoiceStatus(invoiceId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      const invoice = await prisma.purchaseInvoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) {
        return;
      }

      // Calculate total payments for this invoice
      const payments = await prisma.supplierPayment.findMany({
        where: { purchaseInvoiceId: invoiceId },
      });
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      let status = invoice.status;
      let paidDate = invoice.paidDate;

      if (totalPaid >= invoice.amount) {
        status = 'paid';
        if (!paidDate) {
          paidDate = new Date();
        }
      } else if (totalPaid > 0) {
        status = 'partial';
      } else {
        status = 'pending';
      }

      // Check if overdue
      if (status !== 'paid' && invoice.dueDate) {
        const now = moment.tz(TIMEZONE);
        const dueDate = moment.tz(invoice.dueDate, TIMEZONE);
        if (now.isAfter(dueDate)) {
          status = 'overdue';
        }
      }

      await prisma.purchaseInvoice.update({
        where: { id: invoiceId },
        data: {
          status,
          paidDate,
        },
      });
    } catch (error) {
      logger.error('Error updating invoice status', { invoiceId, error });
      // Don't throw - this is a background update
    }
  }

  /**
   * Get payment by ID
   */
  static async getById(id: number): Promise<SupplierPaymentWithRelations | null> {
    try {
      const prisma = databaseService.getClient();
      const payment = await prisma.supplierPayment.findUnique({
        where: { id },
        include: {
          supplier: true,
          purchaseInvoice: {
            include: {
              purchaseOrder: true,
            },
          },
        },
      });
      return payment;
    } catch (error) {
      logger.error('Error getting supplier payment by ID', { id, error });
      throw error;
    }
  }

  /**
   * Get payments list with filtering
   */
  static async getList(
    options: SupplierPaymentListOptions = {}
  ): Promise<{
    payments: SupplierPaymentWithRelations[];
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
        supplierId,
        purchaseInvoiceId,
        startDate,
        endDate,
        sortBy = 'paymentDate',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * pageSize;

      // Build where clause
      const where: Prisma.SupplierPaymentWhereInput = {};
      if (supplierId) {
        where.supplierId = supplierId;
      }
      if (purchaseInvoiceId) {
        where.purchaseInvoiceId = purchaseInvoiceId;
      }
      if (startDate || endDate) {
        where.paymentDate = {};
        if (startDate) {
          where.paymentDate.gte = startDate;
        }
        if (endDate) {
          where.paymentDate.lte = endDate;
        }
      }

      // Build orderBy
      const orderBy: Prisma.SupplierPaymentOrderByWithRelationInput = {};
      if (sortBy === 'paymentDate') {
        orderBy.paymentDate = sortOrder;
      } else if (sortBy === 'amount') {
        orderBy.amount = sortOrder;
      } else if (sortBy === 'createdAt') {
        orderBy.createdAt = sortOrder;
      }

      // Get payments and total count
      const [payments, total] = await Promise.all([
        prisma.supplierPayment.findMany({
          where,
          include: {
            supplier: true,
            purchaseInvoice: {
              include: {
                purchaseOrder: true,
              },
            },
          },
          orderBy,
          skip,
          take: pageSize,
        }),
        prisma.supplierPayment.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        payments,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting supplier payments list', { options, error });
      throw error;
    }
  }

  /**
   * Update payment
   */
  static async updatePayment(
    id: number,
    input: UpdateSupplierPaymentInput,
    userId: number
  ): Promise<SupplierPaymentWithRelations> {
    try {
      const prisma = databaseService.getClient();

      const payment = await prisma.supplierPayment.findUnique({
        where: { id },
      });
      if (!payment) {
        throw new Error(`Payment with ID ${id} not found`);
      }

      // If invoice is being changed, validate it
      if (input.purchaseInvoiceId !== undefined && input.purchaseInvoiceId !== payment.purchaseInvoiceId) {
        if (input.purchaseInvoiceId) {
          const invoice = await prisma.purchaseInvoice.findUnique({
            where: { id: input.purchaseInvoiceId },
            include: { purchaseOrder: true },
          });
          if (!invoice) {
            throw new Error(`Purchase invoice with ID ${input.purchaseInvoiceId} not found`);
          }
          if (invoice.purchaseOrder.supplierId !== payment.supplierId) {
            throw new Error('Purchase invoice does not belong to the supplier');
          }
        }
      }

      const updated = await prisma.supplierPayment.update({
        where: { id },
        data: {
          purchaseInvoiceId: input.purchaseInvoiceId !== undefined ? input.purchaseInvoiceId : undefined,
          amount: input.amount,
          currency: input.currency,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber !== undefined ? input.referenceNumber : undefined,
          notes: input.notes !== undefined ? input.notes : undefined,
        },
        include: {
          supplier: true,
          purchaseInvoice: {
            include: {
              purchaseOrder: true,
            },
          },
        },
      });

      // Update invoice status if payment is linked to an invoice
      if (updated.purchaseInvoiceId) {
        await this.updateInvoiceStatus(updated.purchaseInvoiceId);
      }
      // Also update old invoice if it changed
      if (payment.purchaseInvoiceId && payment.purchaseInvoiceId !== updated.purchaseInvoiceId) {
        await this.updateInvoiceStatus(payment.purchaseInvoiceId);
      }

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'update',
        entity: 'supplier_payment',
        entityId: id,
        details: JSON.stringify({ changes: input }),
      });

      return updated;
    } catch (error) {
      logger.error('Error updating supplier payment', { id, input, error });
      throw error;
    }
  }

  /**
   * Delete payment
   */
  static async deletePayment(id: number, userId: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();

      const payment = await prisma.supplierPayment.findUnique({
        where: { id },
      });
      if (!payment) {
        throw new Error(`Payment with ID ${id} not found`);
      }

      const invoiceId = payment.purchaseInvoiceId;

      await prisma.supplierPayment.delete({
        where: { id },
      });

      // Update invoice status if payment was linked to an invoice
      if (invoiceId) {
        await this.updateInvoiceStatus(invoiceId);
      }

      // Log audit
      await AuditLogService.log({
        userId,
        action: 'delete',
        entity: 'supplier_payment',
        entityId: id,
        details: JSON.stringify({
          supplierId: payment.supplierId,
          amount: payment.amount,
        }),
      });

      logger.info('Supplier payment deleted', { paymentId: id });
    } catch (error) {
      logger.error('Error deleting supplier payment', { id, error });
      throw error;
    }
  }

  /**
   * Get supplier balance summary
   */
  static async getSupplierBalance(supplierId: number): Promise<SupplierBalanceSummary> {
    try {
      const prisma = databaseService.getClient();

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier) {
        throw new Error(`Supplier with ID ${supplierId} not found`);
      }

      // Get all invoices for this supplier
      const invoices = await prisma.purchaseInvoice.findMany({
        where: {
          purchaseOrder: {
            supplierId,
          },
        },
        include: {
          purchaseOrder: true,
        },
      });

      // Get all payments for this supplier
      const payments = await prisma.supplierPayment.findMany({
        where: { supplierId },
      });

      // Calculate totals
      const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
      const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
      const outstandingBalance = totalInvoiceAmount - totalPayments;

      // Calculate overdue amounts
      const now = moment.tz(TIMEZONE);
      let overdueAmount = 0;
      let overdueInvoices = 0;

      for (const invoice of invoices) {
        if (invoice.dueDate && invoice.status !== 'paid') {
          const dueDate = moment.tz(invoice.dueDate, TIMEZONE);
          if (now.isAfter(dueDate)) {
            // Calculate outstanding amount for this invoice
            const invoicePayments = payments.filter(
              (p) => p.purchaseInvoiceId === invoice.id
            );
            const invoicePaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
            const invoiceOutstanding = invoice.amount - invoicePaid;
            overdueAmount += invoiceOutstanding;
            overdueInvoices++;
          }
        }
      }

      return {
        supplierId,
        supplierName: supplier.name,
        totalInvoices: invoices.length,
        totalInvoiceAmount,
        totalPayments,
        outstandingBalance,
        overdueAmount,
        overdueInvoices,
      };
    } catch (error) {
      logger.error('Error getting supplier balance', { supplierId, error });
      throw error;
    }
  }

  /**
   * Get all suppliers with balance summaries
   */
  static async getAllSupplierBalances(): Promise<SupplierBalanceSummary[]> {
    try {
      const prisma = databaseService.getClient();

      const suppliers = await prisma.supplier.findMany({
        orderBy: { name: 'asc' },
      });

      const balances = await Promise.all(
        suppliers.map((supplier) => this.getSupplierBalance(supplier.id))
      );

      return balances;
    } catch (error) {
      logger.error('Error getting all supplier balances', { error });
      throw error;
    }
  }

  /**
   * Get payment reminders (overdue invoices)
   */
  static async getPaymentReminders(daysOverdue?: number): Promise<PaymentReminder[]> {
    try {
      const prisma = databaseService.getClient();
      const now = moment.tz(TIMEZONE);

      // Get all invoices with due dates
      const invoices = await prisma.purchaseInvoice.findMany({
        where: {
          dueDate: { not: null },
          status: { not: 'paid' },
        },
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
            },
          },
          payments: true,
        },
      });

      const reminders: PaymentReminder[] = [];

      for (const invoice of invoices) {
        if (!invoice.dueDate) continue;

        const dueDate = moment.tz(invoice.dueDate, TIMEZONE);
        const days = now.diff(dueDate, 'days');

        // Filter by days overdue if specified
        if (daysOverdue !== undefined && days < daysOverdue) {
          continue;
        }

        if (now.isAfter(dueDate)) {
          // Calculate outstanding amount
          const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
          const outstandingAmount = invoice.amount - totalPaid;

          if (outstandingAmount > 0) {
            reminders.push({
              supplierId: invoice.purchaseOrder.supplierId,
              supplierName: invoice.purchaseOrder.supplier.name,
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              daysOverdue: days,
              outstandingAmount,
            });
          }
        }
      }

      // Sort by days overdue (most overdue first)
      reminders.sort((a, b) => b.daysOverdue - a.daysOverdue);

      return reminders;
    } catch (error) {
      logger.error('Error getting payment reminders', { error });
      throw error;
    }
  }

  /**
   * Get payments for a specific invoice
   */
  static async getInvoicePayments(invoiceId: number): Promise<SupplierPaymentWithRelations[]> {
    try {
      const prisma = databaseService.getClient();
      const payments = await prisma.supplierPayment.findMany({
        where: { purchaseInvoiceId: invoiceId },
        include: {
          supplier: true,
          purchaseInvoice: {
            include: {
              purchaseOrder: true,
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
      });
      return payments;
    } catch (error) {
      logger.error('Error getting invoice payments', { invoiceId, error });
      throw error;
    }
  }
}

