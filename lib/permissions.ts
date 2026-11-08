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
  | 'audit.view'
  | 'subscriptions.view'
  | 'subscriptions.manage'
  | 'sms.view'
  | 'sms.manage'
  | 'documents.view'
  | 'documents.revoke';

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
  SUBSCRIPTIONS_VIEW: 'subscriptions.view',
  SUBSCRIPTIONS_MANAGE: 'subscriptions.manage',
  SMS_VIEW: 'sms.view',
  SMS_MANAGE: 'sms.manage',
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_REVOKE: 'documents.revoke',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SuperAdmin: ALL_PERMISSIONS,
  Admin: ALL_PERMISSIONS,
  Manager: [
    'products.view',
    'products.create',
    'products.edit',
    'sales.view',
    'sales.create',
    'sales.cancel',
    'sales.return',
    'inventory.view',
    'inventory.adjust',
    'purchases.view',
    'purchases.create',
    'customers.view',
    'customers.create',
    'customers.edit',
    'suppliers.view',
    'suppliers.create',
    'expenses.view',
    'expenses.create',
    'reports.view',
    'reports.export',
    'employees.view',
    'settings.view',
    'subscriptions.view',
    'sms.view',
    'documents.view',
  ],
  Cashier: [
    'sales.view',
    'sales.create',
    'customers.view',
    'customers.create',
    'products.view',
    'inventory.view',
    'documents.view',
  ],
  'Sales Staff': [
    'products.view',
    'customers.view',
    'customers.create',
    'sales.view',
    'documents.view',
  ],
  InventoryStaff: [
    'products.view',
    'products.create',
    'products.edit',
    'inventory.view',
    'inventory.adjust',
    'purchases.view',
    'purchases.create',
    'suppliers.view',
    'suppliers.create',
  ],
  Accountant: [
    'sales.view',
    'purchases.view',
    'expenses.view',
    'expenses.create',
    'reports.view',
    'reports.export',
    'audit.view',
    'customers.view',
    'suppliers.view',
    'subscriptions.view',
    'documents.view',
  ],
};

export function hasPermission(userRole: string, permission: Permission | string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole];
  if (!rolePermissions) return false;
  return rolePermissions.includes(permission as Permission);
}

export function requirePermission(userRole: string, permission: Permission | string): void {
  if (!hasPermission(userRole, permission)) {
    throw new Error(`Permission denied: User with role '${userRole}' lacks permission '${permission}'`);
  }
}
