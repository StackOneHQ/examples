export interface User {
  id: string;
  username: string;
  password: string;
  created_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider_key: string;
  provider_name: string;
  account_id: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Log {
  id: string;
  user_id: string;
  integration_id?: string;
  operation: string;
  status: 'success' | 'error';
  request_data?: string;
  response_data?: string;
  error_message?: string;
  created_at: string;
}

export interface Provider {
  provider: string;
  name: string;
  logo_url: string;
}

export interface FieldDefinition {
  name: string;
  displayName: string;
  type: string;
  required?: boolean;
  value_map?: {
    type: string;
    matcher?: Array<{ source_value: string; value: string }>;
    value?: string;
  };
  isCustom?: boolean;
  customFieldId?: string;
  description?: string;
}

export interface EmployeeFormData {
  [key: string]: any;
}

export interface CreateEmployeeRequest {
  first_name: string;
  last_name: string;
  personal_email: string;
  [key: string]: any;
}
