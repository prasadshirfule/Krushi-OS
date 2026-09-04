'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { ProductFormData, CategoryFormData, BrandFormData } from '@/lib/validations';
import * as productsService from '@/services/products.service';
import { ActionResult } from './types';

export async function getProductsAction(params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.view');
    const result = await productsService.getProducts(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getProductAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.view');
    const result = await productsService.getProductById(userData.shop_id, id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createProductAction(formData: ProductFormData): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.create');
    const result = await productsService.createProduct(userData.shop_id, formData, userData.id);
    revalidatePath('/products');
    revalidatePath('/inventory');
    revalidatePath('/billing');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateProductAction(id: string, formData: Partial<ProductFormData>): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.edit');
    const result = await productsService.updateProduct(userData.shop_id, id, formData);
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.delete');
    const result = await productsService.deleteProduct(userData.shop_id, id);
    revalidatePath('/products');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function searchProductsAction(query: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.view');
    const result = await productsService.searchProducts(userData.shop_id, query);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getProductByBarcodeAction(barcode: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.view');
    const result = await productsService.getProductByBarcode(userData.shop_id, barcode);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getCategoriesAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.view');
    const result = await productsService.getCategories(userData.shop_id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createCategoryAction(data: { name: string, description?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.create');
    const result = await productsService.createCategory(userData.shop_id, data);
    revalidatePath('/categories');
    revalidatePath('/products');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateCategoryAction(id: string, data: { name: string, description?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.edit');
    const result = await productsService.updateCategory(userData.shop_id, id, data);
    revalidatePath('/categories');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getBrandsAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.view');
    const result = await productsService.getBrands(userData.shop_id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createBrandAction(data: { name: string, manufacturer?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('products.create');
    const result = await productsService.createBrand(userData.shop_id, data);
    revalidatePath('/categories');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
