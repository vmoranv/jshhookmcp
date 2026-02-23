export interface CodeLocation {
  file: string;
  line: number;
  column?: number;
}

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
