/**
 * Test file for SAP SuccessFactors transformation
 * This demonstrates how the transformation works
 */

import { transformSAPMetadata } from './transformation';

// Mock SAP SuccessFactors metadata response
const mockSAPResponse = {
  status: 200,
  data: {
    d: {
      keyProperties: {
        results: [
          {
            name: 'userId',
            type: { name: 'string', path: 'string' },
            required: true,
            maxLength: 100
          }
        ]
      },
      properties: {
        results: [
          {
            name: 'firstName',
            type: { name: 'string', path: 'string' },
            required: false,
            maxLength: 128
          },
          {
            name: 'lastName',
            type: { name: 'string', path: 'string' },
            required: false,
            maxLength: 128
          },
          {
            name: 'email',
            type: { name: 'string', path: 'string' },
            required: false,
            maxLength: 255
          },
          {
            name: 'gender',
            type: { name: 'string', path: 'string' },
            required: false
          },
          {
            name: 'maritalStatus',
            type: { name: 'string', path: 'string' },
            required: false
          },
          {
            name: 'employmentType',
            type: { name: 'string', path: 'string' },
            required: false
          }
        ]
      }
    }
  }
};

// Test the transformation
console.log('Testing SAP SuccessFactors transformation...');
try {
  const result = transformSAPMetadata(mockSAPResponse);
  console.log('Transformation successful!');
  console.log('Provider:', result.provider);
  console.log('Provider Name:', result.provider_name);
  console.log('Category:', result.category);
  console.log('Fields:', result.models.employees.create.input.default_fields);
} catch (error) {
  console.error('Transformation failed:', error);
}
