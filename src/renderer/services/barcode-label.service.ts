/**
 * Barcode Label Service (Frontend)
 * Handles barcode label template operations via IPC
 */

export interface LabelLayout {
  orientation?: 'portrait' | 'landscape';
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  elements: Array<{
    type: 'barcode' | 'text' | 'product_name' | 'product_code' | 'price' | 'image';
    position: {
      x: number;
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
    content?: string;
    field?: string;
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
  width: number;
  height: number;
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

export class BarcodeLabelService {
  /**
   * Create template
   */
  static async createTemplate(input: CreateBarcodeLabelTemplateInput): Promise<{
    success: boolean;
    data?: BarcodeLabelTemplate;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:createTemplate',
        input
      ) as {
        success: boolean;
        data?: BarcodeLabelTemplate;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error creating barcode label template', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
      };
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(id: number): Promise<{
    success: boolean;
    data?: BarcodeLabelTemplate;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:getTemplateById',
        id
      ) as {
        success: boolean;
        data?: BarcodeLabelTemplate;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting barcode label template', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get template',
      };
    }
  }

  /**
   * Get templates
   */
  static async getTemplates(options?: {
    isActive?: boolean;
    isDefault?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    success: boolean;
    data?: BarcodeLabelTemplate[];
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:getTemplates',
        options
      ) as {
        success: boolean;
        data?: BarcodeLabelTemplate[];
        pagination?: {
          total: number;
          page: number;
          pageSize: number;
          totalPages: number;
        };
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting barcode label templates', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get templates',
      };
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(
    id: number,
    input: UpdateBarcodeLabelTemplateInput
  ): Promise<{
    success: boolean;
    data?: BarcodeLabelTemplate;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:updateTemplate',
        id,
        input
      ) as {
        success: boolean;
        data?: BarcodeLabelTemplate;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error updating barcode label template', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      };
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(id: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:deleteTemplate',
        id
      ) as {
        success: boolean;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error deleting barcode label template', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template',
      };
    }
  }

  /**
   * Set default template
   */
  static async setDefaultTemplate(id: number): Promise<{
    success: boolean;
    data?: BarcodeLabelTemplate;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:setDefaultTemplate',
        id
      ) as {
        success: boolean;
        data?: BarcodeLabelTemplate;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error setting default barcode label template', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set default template',
      };
    }
  }

  /**
   * Get default template
   */
  static async getDefaultTemplate(): Promise<{
    success: boolean;
    data?: BarcodeLabelTemplate;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:getDefaultTemplate'
      ) as {
        success: boolean;
        data?: BarcodeLabelTemplate;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error getting default barcode label template', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get default template',
      };
    }
  }

  /**
   * Generate label HTML
   */
  static async generateLabelHTML(
    templateId: number,
    productId: number
  ): Promise<{
    success: boolean;
    data?: string;
    error?: string;
  }> {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'barcodeLabel:generateLabelHTML',
        templateId,
        productId
      ) as {
        success: boolean;
        data?: string;
        error?: string;
      };
      return result;
    } catch (error) {
      console.error('Error generating label HTML', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate label HTML',
      };
    }
  }

  /**
   * Parse template from JSON string
   */
  static parseTemplate(template: string): LabelLayout {
    try {
      return JSON.parse(template) as LabelLayout;
    } catch {
      return {
        elements: [],
      };
    }
  }

  /**
   * Get default template data
   */
  static getDefaultTemplateData(): LabelLayout {
    return {
      orientation: 'portrait',
      padding: {
        top: 5,
        right: 5,
        bottom: 5,
        left: 5,
      },
      elements: [
        {
          type: 'barcode',
          position: { x: 10, y: 10, width: 80, height: 30 },
          barcodeOptions: {
            format: 'CODE128',
            width: 2,
            height: 50,
            displayValue: true,
          },
        },
        {
          type: 'product_name',
          position: { x: 10, y: 45, width: 80 },
          style: {
            fontSize: 12,
            fontWeight: 'bold',
            textAlign: 'center',
          },
        },
        {
          type: 'price',
          position: { x: 10, y: 60, width: 80 },
          style: {
            fontSize: 14,
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#000000',
          },
        },
      ],
    };
  }
}

