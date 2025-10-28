import { NextRequest, NextResponse } from 'next/server';
import stackoneClient from '@/lib/stackone';
import { fetchSAPSuccessFactorsMetadata } from '@/lib/schema_transformations/sapsuccessfactors/transformation';
import { getCurrentUser, getUserAccountId } from '@/lib/session';

/**
 * Fetch custom field definitions from StackOne API
 */
async function fetchCustomFields(currentUser: any, provider: string): Promise<any[]> {
  let customFields: any[] = [];
  try {
    const apiKey = process.env.STACKONE_API_KEY;
    if (apiKey) {
      // Get user's account ID for the provider
      const accountId = await getUserAccountId(currentUser.id, provider);
      if (accountId) {
        const auth = Buffer.from(`${apiKey}:`).toString('base64');
        const customFieldsResponse = await fetch('https://api.stackone.com/unified/hris/custom_field_definitions/employees', {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'x-account-id': accountId
          }
        });
        
        console.log('Custom fields response status:', customFieldsResponse.status);
        if (customFieldsResponse.ok) {
          const customFieldsData = await customFieldsResponse.json();
          customFields = customFieldsData.data || [];
          console.log('Custom fields found:', customFields.length);
        } else {
          const errorText = await customFieldsResponse.text();
          console.log('Custom fields API error:', customFieldsResponse.status, errorText);
        }
      } else {
        console.log('No account ID found for provider:', provider);
      }
    } else {
      console.log('No StackOne API key configured');
    }
  } catch (customFieldsError) {
    console.warn('Failed to fetch custom field definitions:', customFieldsError);
  }
  
  return customFields;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const mode = searchParams.get('mode') || 'unified';

    if (!provider) {
      return NextResponse.json(
        { success: false, message: 'Provider is required' },
        { status: 400 }
      );
    }

    // Get current user from session
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if StackOne API key is configured
    if (!process.env.STACKONE_API_KEY) {
      console.error('StackOne API key not configured');
      return NextResponse.json(
        { success: false, message: 'StackOne API key not configured' },
        { status: 500 }
      );
    }

    // Get connector metadata from StackOne
           let metadata;
           try {
             // Use StackOne SDK
             metadata = await stackoneClient.connectors.getConnectorMeta({ provider });
             
           } catch (stackoneError: any) {
             console.error('StackOne SDK error:', stackoneError);
             return NextResponse.json(
               { 
                 success: false, 
                 message: `Failed to fetch connector metadata for ${provider}. Please check your StackOne API key and ensure the provider is supported.`,
                 error: stackoneError.message 
               },
               { status: 500 }
             );
           }

           if (mode === 'unified') {
             // Extract fields from SDK metadata (nested under connectorsMeta)
             const createOperation = (metadata as any).connectorsMeta?.models?.employees?.create;
             
             // Get fields from the SDK response
             const fields = createOperation?.input?.default_fields || [];

            // Fetch custom field definitions
            const customFields = await fetchCustomFields(currentUser, provider);
            
            // Only show custom fields if they exist from the API
            const customFieldsToShow = customFields.length > 0 ? customFields : [];

            // Combine default fields with custom fields
            const allFields = [
              ...fields.map((field: any) => {
                 let processedField = {
                   name: field.name,
                   displayName: field.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                   type: field.type,
                   required: field.required || false,
                   value_map: field.value_map,
                   isCustom: false
                 };

                 // Handle SAP SuccessFactors specific enum fields
                 if (provider === 'sapsuccessfactors' && field.type === 'enum') {
                   if (field.name === 'preferred_language') {
                     const languageOptions = [
                       'aar', 'afr', 'amh', 'ara', 'aym', 'aze', 'bel', 'bul', 'bis', 'ben', 'bos', 'byn', 'cat', 'cha', 'ces', 'dan', 'deu', 'div', 'dzo', 'ell', 'eng', 'spa', 'est', 'fas', 'fan', 'ful', 'fin', 'fij', 'fao', 'fra', 'gle', 'grn', 'guj', 'glv', 'heb', 'hin', 'hrv', 'hat', 'hun', 'hye', 'ind', 'isl', 'ita', 'jpn', 'kat', 'kon', 'kaz', 'kal', 'khm', 'kor', 'kur', 'kir', 'lat', 'ltz', 'lin', 'lao', 'lit', 'lub', 'lav', 'mlg', 'mah', 'mri', 'mkd', 'mon', 'mar', 'msa', 'mlt', 'mya', 'nob', 'nep', 'nld', 'nno', 'nor', 'nbl', 'nya', 'pan', 'pol', 'pus', 'por', 'que', 'rar', 'roh', 'rup', 'ron', 'rus', 'kin', 'sme', 'sag', 'sin', 'slk', 'slv', 'smo', 'sna', 'som', 'sqi', 'srp', 'ssw', 'swe', 'swa', 'tam', 'tel', 'tgk', 'tha', 'tir', 'tig', 'tuk', 'tsn', 'ton', 'tur', 'tso', 'ukr', 'urd', 'uzb', 'ven', 'vie', 'xho', 'zho', 'zul', 'unmapped_value'
                     ];
                     processedField.value_map = {
                       type: 'hashmap',
                       matcher: languageOptions.map(code => ({
                         source_value: code === 'unmapped_value' ? 'Custom Value' : code.toUpperCase(),
                         value: code
                       }))
                     };
                   } else if (field.name === 'citizenships') {
                     const citizenshipOptions = [
                       'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'HR', 'CU', 'CW', 'CY', 'CZ', 'CI', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MK', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'RO', 'RU', 'RW', 'RE', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SZ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW', 'unmapped_value'
                     ];
                     processedField.value_map = {
                       type: 'hashmap',
                       matcher: citizenshipOptions.map(code => ({
                         source_value: code === 'unmapped_value' ? 'Custom Value' : code,
                         value: code
                       }))
                     };
                   }
                 }

                 return processedField;
               }),
               ...customFieldsToShow.map((field: any) => ({
                 name: `custom_${field.id}`,
                 displayName: field.name,
                 type: field.type === 'Dropdown' ? 'enum' : 'string',
                 required: false,
                 value_map: field.type === 'Dropdown' && field.options ? {
                   type: 'hashmap',
                   matcher: field.options.map((option: any) => ({
                     source_value: option.value,
                     value: option.id
                   }))
                 } : undefined,
                 isCustom: true,
                 customFieldId: field.id,
                 description: field.description
               }))
             ];

      return NextResponse.json({
        success: true,
        fields: allFields
      });
    } else {
      // Custom mode - use provider-specific metadata and transformation
      if (provider === 'sapsuccessfactors') {
        try {
          // Get user's account ID for SAP SuccessFactors
          const accountId = await getUserAccountId(currentUser.id, 'sapsuccessfactors');
          if (!accountId) {
            return NextResponse.json(
              { success: false, message: 'No SAP SuccessFactors integration found for this user' },
              { status: 404 }
            );
          }

          // Use the SAP transformation function to fetch and transform metadata
          const fields = await fetchSAPSuccessFactorsMetadata(accountId);
          
          // Fetch custom field definitions
          const customFields = await fetchCustomFields(currentUser, provider);
          
          // Only show custom fields if they exist from the API
          const customFieldsToShow = customFields.length > 0 ? customFields : [];
          
          // Combine default fields with custom fields
          const allFields = [
            ...fields.map((field: any) => {
              let processedField = {
                name: field.name,
                displayName: field.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                type: field.type,
                required: field.required || false,
                value_map: field.value_map
              };

              // Handle SAP SuccessFactors specific enum fields
              if (field.type === 'enum') {
                if (field.name === 'preferred_language') {
                  const languageOptions = [
                    'aar', 'afr', 'amh', 'ara', 'aym', 'aze', 'bel', 'bul', 'bis', 'ben', 'bos', 'byn', 'cat', 'cha', 'ces', 'dan', 'deu', 'div', 'dzo', 'ell', 'eng', 'spa', 'est', 'fas', 'fan', 'ful', 'fin', 'fij', 'fao', 'fra', 'gle', 'grn', 'guj', 'glv', 'heb', 'hin', 'hrv', 'hat', 'hun', 'hye', 'ind', 'isl', 'ita', 'jpn', 'kat', 'kon', 'kaz', 'kal', 'khm', 'kor', 'kur', 'kir', 'lat', 'ltz', 'lin', 'lao', 'lit', 'lub', 'lav', 'mlg', 'mah', 'mri', 'mkd', 'mon', 'mar', 'msa', 'mlt', 'mya', 'nob', 'nep', 'nld', 'nno', 'nor', 'nbl', 'nya', 'pan', 'pol', 'pus', 'por', 'que', 'rar', 'roh', 'rup', 'ron', 'rus', 'kin', 'sme', 'sag', 'sin', 'slk', 'slv', 'smo', 'sna', 'som', 'sqi', 'srp', 'ssw', 'swe', 'swa', 'tam', 'tel', 'tgk', 'tha', 'tir', 'tig', 'tuk', 'tsn', 'ton', 'tur', 'tso', 'ukr', 'urd', 'uzb', 'ven', 'vie', 'xho', 'zho', 'zul', 'unmapped_value'
                  ];
                  processedField.value_map = {
                    type: 'hashmap',
                    matcher: languageOptions.map(code => ({
                      source_value: code === 'unmapped_value' ? 'Custom Value' : code.toUpperCase(),
                      value: code
                    }))
                  };
                } else if (field.name === 'citizenships') {
                  const citizenshipOptions = [
                    'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'HR', 'CU', 'CW', 'CY', 'CZ', 'CI', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MK', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'RO', 'RU', 'RW', 'RE', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SZ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW', 'unmapped_value'
                  ];
                  processedField.value_map = {
                    type: 'hashmap',
                    matcher: citizenshipOptions.map(code => ({
                      source_value: code === 'unmapped_value' ? 'Custom Value' : code,
                      value: code
                    }))
                  };
                }
              }

              return processedField;
            }),
            ...customFieldsToShow.map((field: any) => ({
              name: `custom_${field.id}`,
              displayName: field.name,
              type: field.type === 'Dropdown' ? 'enum' : 'string',
              required: false,
              value_map: field.type === 'Dropdown' && field.options ? {
                type: 'hashmap',
                matcher: field.options.map((option: any) => ({
                  source_value: option.value,
                  value: option.id
                }))
              } : undefined,
              isCustom: true,
              customFieldId: field.id,
              description: field.description
            }))
          ];

          return NextResponse.json({
            success: true,
            fields: allFields
          });
        } catch (sapError) {
          console.error('SAP SuccessFactors metadata fetch error:', sapError);
          // Fallback to unified fields if SAP metadata fails
          const createOperation = (metadata as any).connectorsMeta?.models?.employees?.create;
          const fields = createOperation?.input?.default_fields || [];
          
          // Fetch custom field definitions for fallback
          const customFields = await fetchCustomFields(currentUser, provider);
          const customFieldsToShow = customFields.length > 0 ? customFields : [];
          
          // Combine default fields with custom fields
          const allFields = [
            ...fields.map((field: any) => {
              let processedField = {
                name: field.name,
                displayName: field.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                type: field.type,
                required: field.required || false,
                value_map: field.value_map
              };

              // Handle SAP SuccessFactors specific enum fields
              if (field.type === 'enum') {
                if (field.name === 'preferred_language') {
                  const languageOptions = [
                    'aar', 'afr', 'amh', 'ara', 'aym', 'aze', 'bel', 'bul', 'bis', 'ben', 'bos', 'byn', 'cat', 'cha', 'ces', 'dan', 'deu', 'div', 'dzo', 'ell', 'eng', 'spa', 'est', 'fas', 'fan', 'ful', 'fin', 'fij', 'fao', 'fra', 'gle', 'grn', 'guj', 'glv', 'heb', 'hin', 'hrv', 'hat', 'hun', 'hye', 'ind', 'isl', 'ita', 'jpn', 'kat', 'kon', 'kaz', 'kal', 'khm', 'kor', 'kur', 'kir', 'lat', 'ltz', 'lin', 'lao', 'lit', 'lub', 'lav', 'mlg', 'mah', 'mri', 'mkd', 'mon', 'mar', 'msa', 'mlt', 'mya', 'nob', 'nep', 'nld', 'nno', 'nor', 'nbl', 'nya', 'pan', 'pol', 'pus', 'por', 'que', 'rar', 'roh', 'rup', 'ron', 'rus', 'kin', 'sme', 'sag', 'sin', 'slk', 'slv', 'smo', 'sna', 'som', 'sqi', 'srp', 'ssw', 'swe', 'swa', 'tam', 'tel', 'tgk', 'tha', 'tir', 'tig', 'tuk', 'tsn', 'ton', 'tur', 'tso', 'ukr', 'urd', 'uzb', 'ven', 'vie', 'xho', 'zho', 'zul', 'unmapped_value'
                  ];
                  processedField.value_map = {
                    type: 'hashmap',
                    matcher: languageOptions.map(code => ({
                      source_value: code === 'unmapped_value' ? 'Custom Value' : code.toUpperCase(),
                      value: code
                    }))
                  };
                } else if (field.name === 'citizenships') {
                  const citizenshipOptions = [
                    'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'HR', 'CU', 'CW', 'CY', 'CZ', 'CI', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MK', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'RO', 'RU', 'RW', 'RE', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SZ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW', 'unmapped_value'
                  ];
                  processedField.value_map = {
                    type: 'hashmap',
                    matcher: citizenshipOptions.map(code => ({
                      source_value: code === 'unmapped_value' ? 'Custom Value' : code,
                      value: code
                    }))
                  };
                }
              }

              return processedField;
            }),
            ...customFieldsToShow.map((field: any) => ({
              name: `custom_${field.id}`,
              displayName: field.name,
              type: field.type === 'Dropdown' ? 'enum' : 'string',
              required: false,
              value_map: field.type === 'Dropdown' && field.options ? {
                type: 'hashmap',
                matcher: field.options.map((option: any) => ({
                  source_value: option.value,
                  value: option.id
                }))
              } : undefined,
              isCustom: true,
              customFieldId: field.id,
              description: field.description
            }))
          ];

          return NextResponse.json({
            success: true,
            fields: allFields
          });
        }
      } else {
        // For other providers in custom mode, return unified fields as fallback
        const createOperation = (metadata as any).connectorsMeta?.models?.employees?.create;
        const fields = createOperation?.input?.default_fields || [];
        
        // Fetch custom field definitions
        const customFields = await fetchCustomFields(currentUser, provider);
        
        // Only show custom fields if they exist from the API
        const customFieldsToShow = customFields.length > 0 ? customFields : [];
        
        // Combine default fields with custom fields
        const allFields = [
          ...fields.map((field: any) => ({
            name: field.name,
            displayName: field.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            type: field.type,
            required: field.required || false
          })),
          ...customFieldsToShow.map((field: any) => ({
            name: `custom_${field.id}`,
            displayName: field.name,
            type: field.type === 'Dropdown' ? 'enum' : 'string',
            required: false,
            value_map: field.type === 'Dropdown' && field.options ? {
              type: 'hashmap',
              matcher: field.options.map((option: any) => ({
                source_value: option.value,
                value: option.id
              }))
            } : undefined,
            isCustom: true,
            customFieldId: field.id,
            description: field.description
          }))
        ];

        return NextResponse.json({
          success: true,
          fields: allFields
        });
      }
    }

  } catch (error) {
    console.error('Fields fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch form fields' },
      { status: 500 }
    );
  }
}
