export type AdminUser = {
  id: string;
  email: string;
  name?: string;
  role?: string | null;
  emailVerified: boolean;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminSession = {
  id: string;
  userId: string;
  impersonatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

export type CreateUserData = {
  email: string;
  password: string;
  name: string;
  role?: "user" | "admin" | ("user" | "admin")[];
  data?: Record<string, any>;
};

export type ListUsersQuery = {
  searchValue?: string;
  searchField?: "email" | "name";
  searchOperator?: "contains" | "starts_with" | "ends_with";
  limit?: string | number;
  offset?: string | number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filterField?: string;
  filterValue?: string | number | boolean;
  filterOperator?: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
};

export type ListUsersResponse = {
  users: AdminUser[];
  total: number;
  limit?: number;
  offset?: number;
};

export type UserPermissions = {
  [resource: string]: string[];
};

export type AdminRole = {
  name: string;
  permissions: UserPermissions;
};

// Helper for pagination calculations
export type PaginationInfo = {
  totalPages: number;
  currentPage: number;
  nextOffset: number;
  prevOffset: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function calculatePagination(
  total: number,
  limit: number,
  offset: number
): PaginationInfo {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const nextOffset = Math.min(offset + limit, total - 1);
  const prevOffset = Math.max(0, offset - limit);

  return {
    totalPages,
    currentPage,
    nextOffset: offset + limit < total ? nextOffset : offset,
    prevOffset,
    hasNext: offset + limit < total,
    hasPrev: offset > 0,
  };
}

// Admin action types for better type safety
export type AdminActionHandlers = {
  onCreateUser: (data: CreateUserData) => Promise<void>;
  onEditUser: (userId: string, updates: Partial<AdminUser>) => Promise<void>;
  onSetRole: (userId: string, role: string | string[]) => Promise<void>;
  onSetPassword: (userId: string, newPassword: string) => Promise<void>;
  onBanUser: (
    userId: string,
    banReason?: string,
    banExpiresIn?: number
  ) => Promise<void>;
  onUnbanUser: (userId: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onRevokeSession: (sessionToken: string) => Promise<void>;
  onRevokeAllSessions: (userId: string) => Promise<void>;
  onImpersonateUser: (userId: string) => Promise<void>;
  onStopImpersonating: () => Promise<void>;
};
