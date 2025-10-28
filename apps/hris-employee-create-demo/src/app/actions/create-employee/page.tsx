'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Form, Input, Button, Select, DatePicker, Switch, message, Typography, Space, Divider, Row, Col, Radio, Spin } from 'antd';
import { UserAddOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Integration, FieldDefinition, EmployeeFormData } from '@/types';
import Navigation from '@/components/Navigation';
import { makeAuthenticatedRequest, getCurrentUserFromStorage } from '@/lib/auth-client';

const { Title, Text } = Typography;
const { Option } = Select;

export default function CreateEmployeePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formMode, setFormMode] = useState<'unified' | 'custom'>('unified');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const integrationId = searchParams.get('integration');

  useEffect(() => {
    // Check authentication status first
    const currentUser = getCurrentUserFromStorage();
    
    if (!currentUser) {
      message.warning('Please log in to access this page');
      router.push('/login');
      return;
    }
    
    setIsAuthenticated(true);
    
    if (integrationId) {
      fetchIntegrationDetails();
    }
  }, [integrationId, router]);

  const fetchIntegrationDetails = async () => {
    setSchemaLoading(true);
    try {
      const response = await makeAuthenticatedRequest(`/api/integrations/${integrationId}`);
      const data = await response.json();
      
      if (data.success) {
        setIntegration(data.integration);
        await fetchFormFields(data.integration);
      }
    } catch (error) {
      console.error('Failed to fetch integration details:', error);
    } finally {
      setSchemaLoading(false);
    }
  };

  const fetchFormFields = async (integration: Integration, mode?: 'unified' | 'custom') => {
    const currentMode = mode || formMode;
    setSchemaLoading(true);
    try {
      const response = await makeAuthenticatedRequest(`/api/employee/fields?provider=${integration.provider_key}&mode=${currentMode}`);
      const data = await response.json();
      
      if (data.success) {
        setFields(data.fields);
      }
    } catch (error) {
      console.error('Failed to fetch form fields:', error);
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleModeChange = async (mode: 'unified' | 'custom') => {
    setFormMode(mode);
    if (integration) {
      await fetchFormFields(integration, mode);
    }
  };

  const onFinish = async (values: EmployeeFormData) => {
    if (!integration) return;

    setLoading(true);
    // Clear any previous messages
    setSuccessMessage(null);
    setErrorMessage(null);
    
    // Transform datetime values to proper format
    const transformedValues = { ...values };
    fields.forEach(field => {
      if ((field.type === 'datetime' || field.type === 'datetime-string') && transformedValues[field.name]) {
        const dateValue = transformedValues[field.name];
        if (dateValue && typeof dateValue === 'object' && dateValue.format) {
          // Ant Design DatePicker moment object
          transformedValues[field.name] = dateValue.format('YYYY-MM-DDTHH:mm:ssZ');
        } else if (dateValue && typeof dateValue === 'string') {
          // Already a string, ensure it's in the right format
          try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              transformedValues[field.name] = date.toISOString();
            }
          } catch (error) {
            console.warn(`Invalid date format for field ${field.name}:`, dateValue);
          }
        }
      }
    });
    
    try {
      const response = await makeAuthenticatedRequest('/api/employee/create', {
        method: 'POST',
        body: JSON.stringify({
          integration_id: integration.id,
          provider_key: integration.provider_key,
          form_data: transformedValues,
          mode: formMode
        }),
      });

      const data = await response.json();

      if (data.success) {
        const firstName = values.first_name || 'Unknown';
        const lastName = values.last_name || 'Unknown';
        const successMsg = `Employee created successfully! Welcome ${firstName} ${lastName}! 🎉`;
        
        // Show both toast message and persistent message
        message.success({
          content: successMsg,
          duration: 5, // Show for 5 seconds
        });
        
        // Set persistent success message
        setSuccessMessage(successMsg);
        
        // Clear success message after 10 seconds
        setTimeout(() => setSuccessMessage(null), 10000);
        
        form.resetFields();
      } else {
        let errorMsg = 'Failed to create employee';
        try {
          errorMsg = 'API Errors: ' + data.message.provider_errors.map((error: { raw: { error: string }}) => error.raw.error).join(',\n')
        } catch (error) {
          errorMsg = data.message.errors.map((error: string) => error).join(',\n')
        }
        message.error(errorMsg);
        setErrorMessage(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'An error occurred while creating employee';
      message.error(errorMsg);
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: FieldDefinition) => {
    const isRequired = field.required || ['first_name', 'last_name', 'personal_email'].includes(field.name);
    
    if (field.type === 'datetime' || field.type === 'datetime-string') {
      return (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.displayName}
          rules={isRequired ? [{ required: true, message: 'This field is required' }] : []}
        >
          <DatePicker 
            style={{ width: '100%' }} 
            showTime={field.type === 'datetime-string'}
            format={field.type === 'datetime-string' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'}
          />
        </Form.Item>
      );
    }

    if (field.type === 'enum' && field.value_map) {
      const options = field.value_map.matcher?.map(item => ({
        value: item.value,
        label: item.source_value
      })) || [];

      return (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.displayName}
          rules={isRequired ? [{ required: true, message: 'This field is required' }] : []}
        >
          <Select placeholder={`Select ${field.displayName}`}>
            {options.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
      );
    }

    if (field.type === 'phone_number') {
      return (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.displayName}
          rules={isRequired ? [{ required: true, message: 'This field is required' }] : []}
        >
          <Input placeholder={`Enter ${field.displayName}`} />
        </Form.Item>
      );
    }

    // Default text input
    return (
      <Form.Item
        key={field.name}
        name={field.name}
        label={field.displayName}
        rules={isRequired ? [{ required: true, message: 'This field is required' }] : []}
      >
        <Input placeholder={`Enter ${field.displayName}`} />
      </Form.Item>
    );
  };

  const requiredFields = fields.filter(field => 
    field.required || ['first_name', 'last_name', 'personal_email'].includes(field.name)
  );
  const optionalFields = fields.filter(field => 
    !field.required && !['first_name', 'last_name', 'personal_email'].includes(field.name) && !field.isCustom
  );
  const customFields = fields.filter(field => field.isCustom);

  if (!integration) {
    return (
      <div>
        <Navigation 
          showBackButton={true}
          breadcrumbItems={[
            { title: 'Actions', href: '/actions' },
            { title: 'Create Employee' }
          ]}
        />
        
        <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                <Text>Loading form schema...</Text>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading state while checking authentication
  if (!isAuthenticated) {
    return (
      <div>
        <Navigation 
          showBackButton={true}
          breadcrumbItems={[
            { title: 'Actions', href: '/actions' },
            { title: 'Create Employee' }
          ]}
        />
        <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                <Text>Checking authentication...</Text>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation 
        showBackButton={true}
        breadcrumbItems={[
          { title: 'Actions', href: '/actions' },
          { title: 'Create Employee' }
        ]}
      />
      
      <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        <div className="page-header">
          <Space>
            <div>
              <Title level={2}>Create Employee</Title>
              <Text type="secondary">
                Creating employee in {integration.provider_name}
              </Text>
            </div>
          </Space>
        </div>

        {/* Success Message */}
        {successMessage && (
          <Card style={{ marginTop: '16px', backgroundColor: '#f6ffed', border: '1px solid #00af66' }}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <Text style={{ color: '#00af66', fontSize: '16px', fontWeight: 'bold' }}>
                ✅ {successMessage}
              </Text>
            </div>
          </Card>
        )}

        {/* Error Message */}
        {errorMessage && (
          <Card style={{ marginTop: '16px', backgroundColor: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <Text style={{ color: '#ff4d4f', fontSize: '16px', fontWeight: 'bold' }}>
                ❌ {errorMessage}
              </Text>
              <div style={{ marginTop: '8px' }}>
                <Button 
                  type="text" 
                  size="small" 
                  onClick={() => setErrorMessage(null)}
                  style={{ color: '#ff4d4f' }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </Card>
        )}

      <Spin spinning={schemaLoading} tip="Loading form schema...">
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>
              <UserAddOutlined /> Employee Information
            </Title>
            <Text type="secondary">
              Fill in the employee details below. Required fields are marked with a red asterisk.
            </Text>
          </div>

          {/* Mode Toggle - Only show for SAP SuccessFactors */}
          {integration.provider_key === 'sapsuccessfactors' && (
            <div>
              <Text strong>Form Mode:</Text>
              <Radio.Group 
                value={formMode} 
                onChange={(e) => handleModeChange(e.target.value)}
                style={{ marginLeft: '16px' }}
              >
                <Radio.Button value="unified">Unified</Radio.Button>
                <Radio.Button value="custom">Custom</Radio.Button>
              </Radio.Group>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formMode === 'unified' 
                    ? 'Using StackOne metadata API fields' 
                    : 'Using StackOne proxy to SAP SuccessFactors metadata endpoints'
                  }
                </Text>
              </div>
            </div>
          )}

          <Divider />

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            size="large"
          >
            <div className="form-section">
              <div className="form-section-title">Required Fields</div>
              <Row gutter={[16, 16]}>
                {requiredFields.map(field => (
                  <Col xs={24} sm={12} key={field.name}>
                    {renderField(field)}
                  </Col>
                ))}
              </Row>
            </div>

            {optionalFields.length > 0 && (
              <div className="form-section">
                <div className="optional-fields-toggle">
                  <Switch
                    checked={showOptionalFields}
                    onChange={setShowOptionalFields}
                  />
                  <Text style={{ marginLeft: '8px' }}>
                    Show optional fields ({optionalFields.length})
                  </Text>
                </div>

                {showOptionalFields && (
                  <Row gutter={[16, 16]}>
                    {optionalFields.map(field => (
                      <Col xs={24} sm={12} key={field.name}>
                        {renderField(field)}
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            )}

            {customFields.length > 0 && (
              <div className="form-section" style={{ marginTop: '24px' }}>
                <Divider />
                <Title level={5} style={{ color: '#1890ff', marginBottom: '16px' }}>
                  Custom Fields ({customFields.length})
                </Title>
                <Text type="secondary" style={{ marginBottom: '16px', display: 'block' }}>
                  Additional fields specific to your organization
                </Text>
                <Row gutter={[16, 16]}>
                  {customFields.map(field => (
                    <Col xs={24} sm={12} key={field.name}>
                      {renderField(field)}
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <Space>
                <Button onClick={() => form.resetFields()}>
                  Reset
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<UserAddOutlined />}
                >
                  Create Employee
                </Button>
              </Space>
            </div>
          </Form>
        </Space>
      </Card>
      </Spin>
      </div>
    </div>
  );
}
