// Shared API response types used across all services and components.

export interface ApiPagination {
  page: number;
  count: number;
  total: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  status: string;
  success?: boolean;
  data: T;
  message?: string;
  status_message?: string;
  pagination?: ApiPagination;
  metadata?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}
