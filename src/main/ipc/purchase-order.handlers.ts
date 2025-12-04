import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  PurchaseOrderService,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ReceiveGoodsInput,
  PurchaseOrderListOptions,
  CreatePurchaseInvoiceInput,
  UpdatePurchaseInvoiceInput,
} from '../services/purchase-order/purchase-order.service';

/**
 * Register purchase order management IPC handlers
 */
export function registerPurchaseOrderHandlers(): void {
  logger.info('Registering purchase order management IPC handlers...');

  /**
   * Get purchase order by ID handler
   * IPC: purchaseOrder:getById
   */
  ipcMain.handle(
    'purchaseOrder:getById',
    async (_event, id: number) => {
      try {
        const purchaseOrder = await PurchaseOrderService.getById(id);
        if (!purchaseOrder) {
          return {
            success: false,
            error: 'Purchase order not found',
          };
        }

        return { success: true, purchaseOrder };
      } catch (error) {
        logger.error('Error in purchaseOrder:getById handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get purchase orders list handler
   * IPC: purchaseOrder:getList
   */
  ipcMain.handle(
    'purchaseOrder:getList',
    async (_event, options: PurchaseOrderListOptions, requestedById: number) => {
      try {
        const result = await PurchaseOrderService.getList(options, requestedById);
        return result;
      } catch (error) {
        logger.error('Error in purchaseOrder:getList handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create purchase order handler
   * IPC: purchaseOrder:create
   */
  ipcMain.handle(
    'purchaseOrder:create',
    async (_event, input: CreatePurchaseOrderInput, requestedById: number) => {
      try {
        const purchaseOrder = await PurchaseOrderService.create(input, requestedById);
        return { success: true, purchaseOrder };
      } catch (error) {
        logger.error('Error in purchaseOrder:create handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update purchase order handler
   * IPC: purchaseOrder:update
   */
  ipcMain.handle(
    'purchaseOrder:update',
    async (_event, id: number, input: UpdatePurchaseOrderInput, requestedById: number) => {
      try {
        const purchaseOrder = await PurchaseOrderService.update(id, input, requestedById);
        return { success: true, purchaseOrder };
      } catch (error) {
        logger.error('Error in purchaseOrder:update handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Receive goods handler
   * IPC: purchaseOrder:receiveGoods
   */
  ipcMain.handle(
    'purchaseOrder:receiveGoods',
    async (_event, id: number, input: ReceiveGoodsInput, requestedById: number) => {
      try {
        const purchaseOrder = await PurchaseOrderService.receiveGoods(id, input, requestedById);
        return { success: true, purchaseOrder };
      } catch (error) {
        logger.error('Error in purchaseOrder:receiveGoods handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get purchase order items handler
   * IPC: purchaseOrder:getItems
   */
  ipcMain.handle(
    'purchaseOrder:getItems',
    async (_event, purchaseOrderId: number) => {
      try {
        const items = await PurchaseOrderService.getItems(purchaseOrderId);
        return { success: true, items };
      } catch (error) {
        logger.error('Error in purchaseOrder:getItems handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Create purchase invoice handler
   * IPC: purchaseOrder:createInvoice
   */
  ipcMain.handle(
    'purchaseOrder:createInvoice',
    async (_event, input: CreatePurchaseInvoiceInput, requestedById: number) => {
      try {
        const invoice = await PurchaseOrderService.createInvoice(input, requestedById);
        return { success: true, invoice };
      } catch (error) {
        logger.error('Error in purchaseOrder:createInvoice handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Update purchase invoice handler
   * IPC: purchaseOrder:updateInvoice
   */
  ipcMain.handle(
    'purchaseOrder:updateInvoice',
    async (_event, id: number, input: UpdatePurchaseInvoiceInput, requestedById: number) => {
      try {
        const invoice = await PurchaseOrderService.updateInvoice(id, input, requestedById);
        return { success: true, invoice };
      } catch (error) {
        logger.error('Error in purchaseOrder:updateInvoice handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );

  /**
   * Get purchase invoices handler
   * IPC: purchaseOrder:getInvoices
   */
  ipcMain.handle(
    'purchaseOrder:getInvoices',
    async (_event, purchaseOrderId: number) => {
      try {
        const invoices = await PurchaseOrderService.getInvoices(purchaseOrderId);
        return { success: true, invoices };
      } catch (error) {
        logger.error('Error in purchaseOrder:getInvoices handler', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        };
      }
    }
  );
}

