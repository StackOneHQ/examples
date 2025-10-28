/**
 * Transformation function for SAP SuccessFactors metadata
 * Converts SAP SuccessFactors OData metadata response to StackOne unified format
 */

import stackoneClient from '@/lib/stackone';

interface SAPFieldDefinition {
  name: string;
  type: {
    name: string;
    path: string;
  };
  required: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  label?: {
    labels: {
      results: Array<{
        key: string;
        value: string;
      }>;
    };
  };
}

interface SAPMetadataResponse {
  status: number;
  data: {
    d: {
      keyProperties: {
        results: SAPFieldDefinition[];
      };
      properties: {
        results: SAPFieldDefinition[];
      };
    };
  };
}

interface StackOneFieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  value_map?: {
    type: string;
    matcher?: Array<{ source_value: string; value: string }>;
    value?: string;
  };
}

interface StackOneMetadata {
  provider: string;
  provider_name: string;
  category: string;
  models: {
    employees: {
      create: {
        input: {
          default_fields: StackOneFieldDefinition[];
          expand_fields: any[];
        };
        output: {
          default_fields: StackOneFieldDefinition[];
          expand_fields: any[];
        };
        api_path: string;
        operation_type: string;
      };
    };
  };
}

/**
 * Fetches SAP SuccessFactors metadata and transforms it to StackOne format
 */
export async function fetchSAPSuccessFactorsMetadata(accountId: string = 'demo-account'): Promise<StackOneFieldDefinition[]> {
  try {
    // Use StackOne proxy to get SAP SuccessFactors metadata
    const sapMetadataResponse = await stackoneClient.proxy.proxyRequest({
      xAccountId: accountId,
      path: "Entity('User')?$format=JSON",
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    // Transform SAP metadata to StackOne format
    const transformedMetadata = transformSAPSuccessFactorsMetadata(sapMetadataResponse);
    return transformedMetadata.models.employees.create.input.default_fields || [];
  } catch (error) {
    console.error('SAP SuccessFactors metadata fetch error:', error);
    throw error;
  }
}

/**
 * Maps SAP SuccessFactors field types to StackOne unified types
 */
function mapSAPTypeToStackOne(sapType: string): string {
  const typeMapping: Record<string, string> = {
    'string': 'string',
    'int32': 'number',
    'int64': 'number',
    'decimal': 'number',
    'double': 'number',
    'float': 'number',
    'boolean': 'boolean',
    'datetime': 'datetime',
    'date': 'datetime',
    'time': 'datetime',
    'binary': 'string',
    'guid': 'string'
  };
  
  return typeMapping[sapType] || 'string';
}

/**
 * Maps SAP SuccessFactors field names to StackOne unified field names
 */
function mapSAPFieldNameToStackOne(sapFieldName: string): string {
  const fieldMapping: Record<string, string> = {
    'firstName': 'first_name',
    'lastName': 'last_name',
    'email': 'personal_email',
    'workEmail': 'work_email',
    'phoneNumber': 'personal_phone_number',
    'workPhoneNumber': 'work_phone_number',
    'jobTitle': 'job_title',
    'managerId': 'manager_id',
    'hireDate': 'hire_date',
    'startDate': 'start_date',
    'employmentType': 'employment_type',
    'employmentContractType': 'employment_contract_type',
    'employmentStatus': 'employment_status',
    'terminationDate': 'termination_date',
    'companyName': 'company_name',
    'department': 'department',
    'departmentId': 'department_id',
    'employeeNumber': 'employee_number',
    'dateOfBirth': 'date_of_birth',
    'maritalStatus': 'marital_status',
    'gender': 'gender',
    'ethnicity': 'ethnicity',
    'nationalIdentityNumbers': 'national_identity_numbers',
    'homeLocation': 'home_location',
    'workLocation': 'work_location'
  };
  
  return fieldMapping[sapFieldName] || sapFieldName;
}

/**
 * Creates value mapping for enum fields based on SAP SuccessFactors values
 */
function createValueMapping(sapFieldName: string): StackOneFieldDefinition['value_map'] | undefined {
  const enumMappings: Record<string, Array<{ source_value: string; value: string }>> = {
    'gender': [
      { source_value: 'M', value: 'male' },
      { source_value: 'F', value: 'female' },
      { source_value: 'U', value: 'other' }
    ],
    'maritalStatus': [
      { source_value: 'S', value: 'single' },
      { source_value: 'M', value: 'married' },
      { source_value: 'D', value: 'divorced' },
      { source_value: 'W', value: 'widowed' },
      { source_value: 'C', value: 'domestic_partnership' },
      { source_value: 'P', value: 'separated' },
      { source_value: 'Z', value: 'other' }
    ],
    'employmentType': [
      { source_value: 'F', value: 'permanent' },
      { source_value: 'P', value: 'permanent' },
      { source_value: 'Int', value: 'intern' },
      { source_value: 'Reg', value: 'permanent' },
      { source_value: 'Con', value: 'contractor' },
      { source_value: 'Tmp', value: 'temporary' }
    ],
    'employmentContractType': [
      { source_value: 'F', value: 'full_time' },
      { source_value: 'P', value: 'part_time' },
      { source_value: 'true', value: 'full_time' },
      { source_value: 'false', value: 'part_time' }
    ],
    'employmentStatus': [
      { source_value: 'A', value: 'active' },
      { source_value: 'T', value: 'terminated' }
    ]
  };
  
  const mapping = enumMappings[sapFieldName];
  if (mapping) {
    return {
      type: 'hashmap',
      matcher: mapping
    };
  }
  
  return undefined;
}

/**
 * Determines if a field should be required based on SAP SuccessFactors metadata and business rules
 */
function isFieldRequired(sapField: SAPFieldDefinition, mappedFieldName: string): boolean {
  // Always required fields
  const alwaysRequired = ['first_name', 'last_name', 'personal_email'];
  if (alwaysRequired.includes(mappedFieldName)) {
    return true;
  }
  
  // Check SAP required flag
  if (sapField.required) {
    return true;
  }
  
  return false;
}

/**
 * Transforms SAP SuccessFactors metadata to StackOne unified format
 */
export function transformSAPSuccessFactorsMetadata(sapResponse: SAPMetadataResponse): StackOneMetadata {
  const allFields = [
    ...(sapResponse.data.d.keyProperties?.results || []),
    ...(sapResponse.data.d.properties?.results || [])
  ];
  
  // Filter for relevant employee fields and transform them
  const employeeFields = allFields
    .filter(field => {
      // Include fields that are relevant for employee creation
      const relevantFields = [
        'firstName', 'lastName', 'email', 'workEmail', 'phoneNumber', 'workPhoneNumber',
        'jobTitle', 'managerId', 'hireDate', 'startDate', 'employmentType',
        'employmentContractType', 'employmentStatus', 'terminationDate',
        'companyName', 'department', 'departmentId', 'employeeNumber',
        'dateOfBirth', 'maritalStatus', 'gender', 'ethnicity', 'nationalIdentityNumbers',
        'homeLocation', 'workLocation'
      ];
      return relevantFields.includes(field.name);
    })
    .map(sapField => {
      const mappedFieldName = mapSAPFieldNameToStackOne(sapField.name);
      const mappedType = mapSAPTypeToStackOne(sapField.type.name);
      const isRequired = isFieldRequired(sapField, mappedFieldName);
      const valueMap = createValueMapping(sapField.name);
      
      const stackOneField: StackOneFieldDefinition = {
        name: mappedFieldName,
        type: mappedType,
        required: isRequired
      };
      
      if (valueMap) {
        stackOneField.value_map = valueMap;
      }
      
      return stackOneField;
    });
  
  // Sort fields: required first, then optional
  const requiredFields = employeeFields.filter(field => field.required);
  const optionalFields = employeeFields.filter(field => !field.required);
  
  const sortedFields = [...requiredFields, ...optionalFields];
  
  return {
    provider: 'sapsuccessfactors',
    provider_name: 'SAP SuccessFactors',
    category: 'hris',
    models: {
      employees: {
        create: {
          input: {
            default_fields: sortedFields,
            expand_fields: []
          },
          output: {
            default_fields: [
              {
                name: 'id',
                type: 'string'
              }
            ],
            expand_fields: []
          },
          api_path: '/unified/hris/employees/:id',
          operation_type: 'write'
        }
      }
    }
  };
}

/**
 * Main transformation function that can be used by the application
 */
export function transformSAPMetadata(sapMetadataResponse: any): StackOneMetadata {
  try {
    return transformSAPSuccessFactorsMetadata(sapMetadataResponse);
  } catch (error) {
    console.error('Error transforming SAP SuccessFactors metadata:', error);
    throw new Error('Failed to transform SAP SuccessFactors metadata');
  }
}
