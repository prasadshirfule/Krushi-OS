export type ActionResult<T = any> = 
  | { success: true; data: T }
  | { success: false; error: string };
