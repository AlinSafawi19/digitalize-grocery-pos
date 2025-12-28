import { logger } from '../../utils/logger';
import { databaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

export interface LabelLayout {
  // Layout configuration
  orientation?: 'portrait' | 'landscape';
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  
  // Elements configuration
  elements: Array<{
    type: 'barcode' | 'text' | 'product_name' | 'product_code' | 'price' | 'image';
    position: {
      x: number; // Percentage or pixels
      y: number;
      width?: number;
      height?: number;
    };
    style?: {
      fontSize?: number;
      fontWeight?: 'normal' | 'bold';
      textAlign?: 'left' | 'center' | 'right';
      color?: string;
    };
    content?: string; // For static text
    field?: string; // For dynamic fields (product_name, product_code, price, etc.)
    barcodeOptions?: {
      format?: string;
      width?: number;
      height?: number;
      displayValue?: boolean;
    };
  }>;
}

export interface CreateBarcodeLabelTemplateInput {
  name: string;
  description?: string;
  width: number; // Inches
  height: number; // Inches
  template: LabelLayout;
  isDefault?: boolean;
  isActive?: boolean;
  createdBy: number;
}

export interface UpdateBarcodeLabelTemplateInput {
  name?: string;
  description?: string;
  width?: number;
  height?: number;
  template?: LabelLayout;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface BarcodeLabelTemplate {
  id: number;
  name: string;
  description: string | null;
  width: number;
  height: number;
  template: string; // JSON string
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number;
  creator?: {
    id: number;
    username: string;
  } | null;
}

export interface PrintLabelOptions {
  templateId: number;
  productIds: number[];
  quantity?: number; // Number of labels per product (default: 1)
}

/**
 * Barcode Label Service
 * Handles barcode label template management and printing
 */
export class BarcodeLabelService {
  /**
   * Create a new barcode label template
   */
  static async createTemplate(input: CreateBarcodeLabelTemplateInput): Promise<BarcodeLabelTemplate> {
    try {
      const prisma = databaseService.getClient();
      
      // If this is set as default, unset other defaults
      if (input.isDefault) {
        await prisma.barcodeLabelTemplate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      
      const template = await prisma.barcodeLabelTemplate.create({
        data: {
          name: input.name,
          description: input.description || null,
          width: input.width,
          height: input.height,
          template: JSON.stringify(input.template),
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
          createdBy: input.createdBy,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      logger.info(`Barcode label template created: ${template.name} (ID: ${template.id})`);
      return this.mapToTemplate(template);
    } catch (error) {
      logger.error('Error creating barcode label template', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(id: number): Promise<BarcodeLabelTemplate | null> {
    try {
      const prisma = databaseService.getClient();
      
      const template = await prisma.barcodeLabelTemplate.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return template ? this.mapToTemplate(template) : null;
    } catch (error) {
      logger.error(`Error getting barcode label template ${id}`, error);
      throw error;
    }
  }

  /**
   * Get all templates
   */
  static async getTemplates(options?: {
    isActive?: boolean;
    isDefault?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    templates: BarcodeLabelTemplate[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    try {
      const prisma = databaseService.getClient();
      const page = options?.page || 1;
      const pageSize = options?.pageSize || 50;

      const where: Prisma.BarcodeLabelTemplateWhereInput = {};
      
      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }
      
      if (options?.isDefault !== undefined) {
        where.isDefault = options.isDefault;
      }

      const [templates, total] = await Promise.all([
        prisma.barcodeLabelTemplate.findMany({
          where,
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.barcodeLabelTemplate.count({ where }),
      ]);

      return {
        templates: templates.map(t => this.mapToTemplate(t)),
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      logger.error('Error getting barcode label templates', error);
      throw error;
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(
    id: number,
    input: UpdateBarcodeLabelTemplateInput
  ): Promise<BarcodeLabelTemplate> {
    try {
      const prisma = databaseService.getClient();
      
      // If setting as default, unset other defaults
      if (input.isDefault) {
        await prisma.barcodeLabelTemplate.updateMany({
          where: {
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }
      
      const updateData: Prisma.BarcodeLabelTemplateUpdateInput = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.width !== undefined) updateData.width = input.width;
      if (input.height !== undefined) updateData.height = input.height;
      if (input.template !== undefined) updateData.template = JSON.stringify(input.template);
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const template = await prisma.barcodeLabelTemplate.update({
        where: { id },
        data: updateData,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      logger.info(`Barcode label template updated: ${template.name} (ID: ${template.id})`);
      return this.mapToTemplate(template);
    } catch (error) {
      logger.error(`Error updating barcode label template ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(id: number): Promise<void> {
    try {
      const prisma = databaseService.getClient();
      
      await prisma.barcodeLabelTemplate.delete({
        where: { id },
      });

      logger.info(`Barcode label template deleted: ID ${id}`);
    } catch (error) {
      logger.error(`Error deleting barcode label template ${id}`, error);
      throw error;
    }
  }

  /**
   * Set default template
   */
  static async setDefaultTemplate(id: number): Promise<BarcodeLabelTemplate> {
    try {
      const prisma = databaseService.getClient();
      
      // Unset all other defaults
      await prisma.barcodeLabelTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      
      // Set this one as default
      const template = await prisma.barcodeLabelTemplate.update({
        where: { id },
        data: { isDefault: true },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      logger.info(`Default barcode label template set: ${template.name} (ID: ${template.id})`);
      return this.mapToTemplate(template);
    } catch (error) {
      logger.error(`Error setting default barcode label template ${id}`, error);
      throw error;
    }
  }

  /**
   * Get default template
   */
  static async getDefaultTemplate(): Promise<BarcodeLabelTemplate | null> {
    try {
      const prisma = databaseService.getClient();
      
      const template = await prisma.barcodeLabelTemplate.findFirst({
        where: {
          isDefault: true,
          isActive: true,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return template ? this.mapToTemplate(template) : null;
    } catch (error) {
      logger.error('Error getting default barcode label template', error);
      throw error;
    }
  }

  /**
   * Generate label HTML for a product
   */
  static async generateLabelHTML(
    templateId: number,
    productId: number
  ): Promise<string> {
    try {
      const prisma = databaseService.getClient();
      
      // Get template
      const template = await prisma.barcodeLabelTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template || !template.isActive) {
        throw new Error('Template not found or inactive');
      }

      // Get product
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: true,
          inventory: true,
          images: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const layout = JSON.parse(template.template) as LabelLayout;
      
      // Generate HTML for the label
      const html = this.renderLabelHTML(layout, template, product);
      
      return html;
    } catch (error) {
      logger.error('Error generating label HTML', error);
      throw error;
    }
  }

  /**
   * Render label HTML from layout
   */
  private static renderLabelHTML(
    layout: LabelLayout,
    template: { width: number; height: number },
    product: {
      id: number;
      name: string;
      code: string | null;
      barcode: string | null;
      price: number;
      currency: string;
      images: Array<{ filePath: string }>;
    }
  ): string {
    const widthPx = template.width * 96; // Convert inches to pixels (96 DPI)
    const heightPx = template.height * 96;
    
    const padding = layout.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    
    let elementsHTML = '';
    
    for (const element of layout.elements || []) {
      let elementHTML = '';
      const style = `position: absolute; left: ${element.position.x}%; top: ${element.position.y}%;`;
      const widthStyle = element.position.width ? `width: ${element.position.width}%;` : '';
      const heightStyle = element.position.height ? `height: ${element.position.height}%;` : '';
      
      const elementStyle = element.style || {};
      const fontSize = elementStyle.fontSize || 12;
      const fontWeight = elementStyle.fontWeight || 'normal';
      const textAlign = elementStyle.textAlign || 'left';
      const color = elementStyle.color || '#000000';
      
      switch (element.type) {
        case 'barcode':
          if (product.barcode) {
            elementHTML = `
              <div style="${style} ${widthStyle} ${heightStyle}">
                <svg id="barcode-${product.id}" style="width: 100%; height: 100%;"></svg>
                <script>
                  if (typeof JsBarcode !== 'undefined') {
                    JsBarcode("#barcode-${product.id}", "${product.barcode}", {
                      format: "${element.barcodeOptions?.format || 'CODE128'}",
                      width: ${element.barcodeOptions?.width || 2},
                      height: ${element.barcodeOptions?.height || 50},
                      displayValue: ${element.barcodeOptions?.displayValue !== false}
                    });
                  }
                </script>
              </div>
            `;
          }
          break;
          
        case 'text':
          elementHTML = `
            <div style="${style} ${widthStyle} font-size: ${fontSize}px; font-weight: ${fontWeight}; text-align: ${textAlign}; color: ${color};">
              ${element.content || ''}
            </div>
          `;
          break;
          
        case 'product_name':
          elementHTML = `
            <div style="${style} ${widthStyle} font-size: ${fontSize}px; font-weight: ${fontWeight}; text-align: ${textAlign}; color: ${color};">
              ${product.name}
            </div>
          `;
          break;
          
        case 'product_code':
          elementHTML = `
            <div style="${style} ${widthStyle} font-size: ${fontSize}px; font-weight: ${fontWeight}; text-align: ${textAlign}; color: ${color};">
              ${product.code || 'N/A'}
            </div>
          `;
          break;
          
        case 'price':
          elementHTML = `
            <div style="${style} ${widthStyle} font-size: ${fontSize}px; font-weight: ${fontWeight}; text-align: ${textAlign}; color: ${color};">
              ${product.currency} ${product.price.toFixed(2)}
            </div>
          `;
          break;
          
        case 'image':
          if (product.images.length > 0) {
            // Note: In Electron, we'll need to convert file path to a data URL or use a custom protocol
            elementHTML = `
              <div style="${style} ${widthStyle} ${heightStyle}">
                <img src="file://${product.images[0].filePath}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
            `;
          }
          break;
      }
      
      elementsHTML += elementHTML;
    }
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Barcode Label</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @media print {
              @page {
                size: ${template.width}in ${template.height}in;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              margin: 0;
              padding: ${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px;
              width: ${widthPx}px;
              height: ${heightPx}px;
              position: relative;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${elementsHTML}
        </body>
      </html>
    `;
  }

  /**
   * Map Prisma model to BarcodeLabelTemplate interface
   */
  private static mapToTemplate(template: {
    id: number;
    name: string;
    description: string | null;
    width: number;
    height: number;
    template: string;
    isDefault: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy: number;
    creator?: { id: number; username: string } | null;
  }): BarcodeLabelTemplate {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      width: template.width,
      height: template.height,
      template: template.template,
      isDefault: template.isDefault,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      createdBy: template.createdBy,
      creator: template.creator || null,
    };
  }
}

