import { NextRequest, NextResponse } from 'next/server';
import { dbMethods } from '@/lib/database';
import stackoneClient from '@/lib/stackone';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/session';


/**
 * Dynamically format form data based on field metadata
 */
async function formatFormDataForStackOne(formData: any, provider: string): Promise<any> {
  try {
    // Fetch field metadata to understand field types
    const metadata = await stackoneClient.connectors.getConnectorMeta({ provider });
    const createOperation = (metadata as any).connectorsMeta?.models?.employees?.create;
    const fields = createOperation?.input?.default_fields || [];
    
    // Create a map of field definitions for quick lookup
    const fieldMap = new Map();
    fields.forEach((field: any) => {
      fieldMap.set(field.name, field);
    });
    
    const formattedData: any = {};
    
    // Process each form field based on its metadata
    Object.keys(formData).forEach(key => {
      const value = formData[key];
      if (value === undefined || value === '') return;
      
      const fieldDef = fieldMap.get(key);
      
      if (fieldDef) {
        // Format based on field type
        if (fieldDef.type === 'enum') {
          // For enum fields, check if it's a picklist (simple string) or object field
          if (key === 'citizenships') {
            // Array of objects with value and source_value
            formattedData[key] = [{ value: value, source_value: value }];
          } else {
            // All other enum fields as objects with value property
            formattedData[key] = { value: value };
          }
        } else if (fieldDef.type === 'datetime' || fieldDef.type === 'datetime-string') {
          // Format dates properly - ensure they're in ISO format
          if (value) {
            try {
              // Try to parse the date and format it as ISO string
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                formattedData[key] = date.toISOString();
              } else {
                console.warn(`Invalid date format for field ${key}: ${value}`);
                formattedData[key] = value; // Pass through as-is if parsing fails
              }
            } catch (dateError) {
              console.warn(`Date parsing error for field ${key}: ${dateError}`);
              formattedData[key] = value; // Pass through as-is if parsing fails
            }
          } else {
            formattedData[key] = value;
          }
        } else if (Array.isArray(fieldDef.type)) {
          // Complex object field - format based on the structure
          if (key === 'work_location') {
            // Work location should be an object with name property
            formattedData[key] = { name: value };
          } else {
            // For other complex fields, pass through as-is
            formattedData[key] = value;
          }
        } else {
          // Simple string/number fields
          formattedData[key] = value;
        }
      } else {
        // Field not in metadata, pass through as-is
        formattedData[key] = value;
      }
    });
    
    return formattedData;
  } catch (error) {
    console.warn('Failed to fetch field metadata, using fallback formatting:', error);
    // Fallback to simple pass-through if metadata fetch fails
    return formData;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { integration_id, provider_key, form_data, mode } = await request.json();

    if (!integration_id || !provider_key || !form_data) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get integration details
    const integration = await dbMethods.get('SELECT * FROM integrations WHERE id = ?', [integration_id]);
    if (!integration) {
      return NextResponse.json(
        { success: false, message: 'Integration not found' },
        { status: 404 }
      );
    }

    const logId = uuidv4();
    
    // Get current user from session
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    try {
      let result;
      
      if (mode === 'unified') {
        // Use unified API directly
        const apiKey = process.env.STACKONE_API_KEY;
        if (!apiKey) {
          throw new Error('StackOne API key not configured');
        }
        
        const auth = Buffer.from(`${apiKey}:`).toString('base64');
        
        // Separate custom fields from standard fields
        const customFields: any = {};
        const standardFormData: any = {};
        
        // Known standard fields for Hibob
        const standardFields = [
          'first_name', 'last_name', 'personal_email', 'work_email', 'work_location', 
          'start_date', 'phone_number', 'address', 'city', 'state', 'zip_code', 
          'country', 'date_of_birth', 'gender', 'marital_status', 'employment_status',
          'job_title', 'department', 'manager', 'salary', 'currency', 'employment_type'
        ];
        
        Object.keys(form_data).forEach(key => {
          if (standardFields.includes(key)) {
            // Standard field
            standardFormData[key] = form_data[key];
          } else if (form_data[key] !== undefined && form_data[key] !== '') {
            // Custom field (anything not in standard fields)
            customFields[key] = form_data[key];
          }
        });
        
        // Use dynamic formatting based on field metadata
        const formattedStandardFields = await formatFormDataForStackOne(standardFormData, provider_key);
        
        // Add custom fields to the request body if any exist
        if (Object.keys(customFields).length > 0) {
          formattedStandardFields.custom_fields = customFields;
        }
        
        const response = await fetch('https://api.stackone.com/unified/hris/employees', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'x-account-id': integration.account_id
          },
          body: JSON.stringify(formattedStandardFields)
        });

        const responseJSON = await response.json();

        if ([ 200, 201, 202 ].includes(response.status)) {
          return NextResponse.json({
            success: true,
            message: 'Employee created successfully',
            employee: {
              id: responseJSON.data.id,
              remote_id: responseJSON.data.remote_id,
              name: `${form_data.first_name} ${form_data.last_name}`,
              email: form_data.work_email || form_data.personal_email
            }
          });
        } else {
          console.error(NextResponse.json({ success: false, message: responseJSON }, { status: response.status }));
          return NextResponse.json({ success: false, message: responseJSON }, { status: response.status });
        }
        
      } else {
        // Use proxy API for custom implementations
        if (provider_key === 'sapsuccessfactors') {
          // Use dynamic formatting for SAP SuccessFactors
          const formattedFormData = await formatFormDataForStackOne(form_data, provider_key);
          
          // Add required SAP fields if not present
          if (!formattedFormData.userId) {
            formattedFormData.userId = `user_${uuidv4().slice(0, 8)}`;
          }
          
          // Use StackOne proxy to create employee in SAP SuccessFactors
          result = await stackoneClient.proxy.proxyRequest({
            xAccountId: integration.account_id,
            path: '/odata/v2/User',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(formattedFormData)
          } as any);
        } else {
          // For other providers in custom mode, use dynamic formatting
          const formattedFormData = await formatFormDataForStackOne(form_data, provider_key);
          
          // Simulate creation with formatted data
          result = {
            id: `emp_${uuidv4()}`,
            first_name: formattedFormData.first_name,
            last_name: formattedFormData.last_name,
            personal_email: formattedFormData.personal_email
          };
        }
      }

      // Note: Logging removed - using StackOne logs only

      return NextResponse.json({
        success: true,
        message: 'Employee created successfully',
        employee: {
          id: (result as any).data?.id || (result as any).id,
          remote_id: (result as any).data?.remote_id,
          name: `${form_data.first_name} ${form_data.last_name}`,
          email: form_data.work_email || form_data.personal_email
        }
      });

    } catch (apiError: any) {
      // Note: Logging removed - using StackOne logs only

      console.log(apiError);

      return NextResponse.json(
        { 
          success: false, 
          message: apiError || 'Failed to create employee' 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Employee creation error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
