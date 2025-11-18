export class ApiResponse<T = any> {
  success: boolean;
  data?: T;
  errors?: ErrorDetail[];
  message?: string;

  constructor(
    success: boolean,
    data?: T,
    errors?: ErrorDetail[],
    message?: string,
  ) {
    this.success = success;
    this.data = data;
    this.errors = errors;
    this.message = message;
  }

  static success<T>(data: T, message?: string): ApiResponse<T> {
    return new ApiResponse<T>(true, data, undefined, message);
  }

  static error(errors: ErrorDetail[], message?: string): ApiResponse {
    return new ApiResponse(false, undefined, errors, message);
  }
}

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}
