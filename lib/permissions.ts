export type Permission =
  | 'products.view'
  | 'products.create'
  | 'products.edit'
  | 'products.delete'
  | 'sales.view'
  | 'sales.create'
  | 'sales.cancel'
  | 'sales.return'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'purchases.view'
  | 'purchases.create'
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'suppliers.view'
  | 'suppliers.create'
  | 'expenses.view'
  | 'expenses.create'
  | 'reports.view'
  | 'reports.export'
  | 'employees.view'
  | 'employees.manage'
  | 'settings.view'
  | 'settings.edit'
  | 'audit.view';

export const PERMISSIONS: Record<string, Permission> = {
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  PRODUCTS_DELETE: 'products.delete',
  SALES_VIEW: 'sales.view',
  SALES_CREATE: 'sales.create',
  SALES_CANCEL: 'sales.cancel',
  SALES_RETURN: 'sales.return',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  PURCHASES_VIEW: 'purchases.view',
  PURCHASES_CREATE: 'purchases.create',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_CREATE: 'suppliers.create',
  EXPENSES_VIEW: 'expenses.view',
  EXPENSES_CREATE: 'expenses.create',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_MANAGE: 'employees.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  AUDIT_VIEW: 'audit.view',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Admin: ALL_PERMISSIONS,
  Manager: ALL_PERMISSIONS.filter(
    (p) => p !== 'employees.manage' && p !== 'settings.edit' && p !== 'audit.view'
  ),
  Cashier: [
    'sales.view',
    'sales.create',
    'customers.view',
    'customers.create',
    'products.view',
    'inventory.view',
  ],
  'Sales Staff': [
    'products.view',
    'customers.view',
    'customers.create',
    'sales.view',
  ],
};

export function hasPermission(userRole: string, permission: Permission | string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  return rolePermissions.includes(permission as Permission);
}

export function requirePermission(userRole: string, permission: Permission | string): void {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Permission denied: User with role ${userRole} lacks ${permission}`);
  }
}
