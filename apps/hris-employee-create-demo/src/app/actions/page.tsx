'use client';

import { useState, useEffect } from 'react';
import { Card, Button, message, Typography, Space, Divider, Image, Row, Col, Avatar } from 'antd';
import { UserAddOutlined, ApiOutlined } from '@ant-design/icons';
import { Integration, Provider } from '@/types';
import Navigation from '@/components/Navigation';

const { Title, Text } = Typography;

export default function ActionsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIntegrations();
    fetchProviderLogos();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations');
      const data = await response.json();
      if (data.success) {
        setIntegrations(data.integrations.filter((i: Integration) => i.status === 'active'));
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    }
  };

  const fetchProviderLogos = async () => {
    try {
      const response = await fetch('/meta.json');
      const meta = await response.json();
      setProviders(meta);
    } catch (error) {
      console.error('Failed to fetch provider meta:', error);
    }
  };

  const handleCreateEmployee = () => {
    if (!selectedIntegration) {
      message.warning('Please select an integration first');
      return;
    }
    
    // Navigate to employee creation form
    window.location.href = `/actions/create-employee?integration=${selectedIntegration}`;
  };

  const handleIntegrationSelect = (integrationId: string) => {
    setSelectedIntegration(integrationId);
  };

  return (
    <div>
      <Navigation 
        showBackButton={true}
        breadcrumbItems={[
          { title: 'Actions' }
        ]}
      />
      
      <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        <div className="page-header">
          <Title level={2}>Actions</Title>
          <Text type="secondary">
            Perform HRIS operations using connected integrations
          </Text>
        </div>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>
              <UserAddOutlined /> Create Employee
            </Title>
            <Text type="secondary">
              Create a new employee record in your connected HRIS system
            </Text>
          </div>

          <Divider />

              <div>
                <Text strong>Select Integration:</Text>
                <div style={{ marginTop: '16px' }}>
                  {integrations.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '40px', 
                      backgroundColor: '#fafafa',
                      borderRadius: '12px',
                      border: '1px solid #f0f0f0'
                    }}>
                      <ApiOutlined style={{ fontSize: '48px', marginBottom: '16px', color: '#707070' }} />
                      <div>
                        <Text style={{ color: '#707070', display: 'block', marginBottom: '8px' }}>
                          No active integrations found
                        </Text>
                        <Text type="secondary" style={{ fontSize: '14px' }}>
                          Please connect to an HRIS provider first
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <Row gutter={[16, 16]}>
                      {integrations.map(integration => {
                        const provider = providers.find(p => p.provider === integration.provider_key);
                        const isSelected = selectedIntegration === integration.id;
                        const hasSelection = selectedIntegration !== null;
                        
                        return (
                          <Col xs={24} sm={12} md={8} lg={6} key={integration.id}>
                            <Card
                              size="small"
                              style={{
                                borderRadius: '12px',
                                border: isSelected ? '2px solid #000000' : '1px solid #f0f0f0',
                                backgroundColor: isSelected ? '#ffffff' : '#ffffff',
                                opacity: hasSelection ? (isSelected ? 1 : 0.6) : 1,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.05)'
                              }}
                              styles={{ body: { padding: '16px' } }}
                              onMouseEnter={(e) => {
                                if (hasSelection && !isSelected) {
                                  e.currentTarget.style.opacity = '0.8';
                                  e.currentTarget.style.transform = 'scale(1.01)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (hasSelection && !isSelected) {
                                  e.currentTarget.style.opacity = '0.6';
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                                }
                              }}
                              onClick={() => handleIntegrationSelect(integration.id)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Avatar
                                  size={32}
                                  style={{ 
                                    backgroundColor: '#f0f9ff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    padding: '6px',
                                    lineHeight: '1'
                                  }}
                                >
                                  {provider?.logo_url ? (
                                    <Image
                                      src={provider.logo_url}
                                      alt={provider.name || integration.provider_name}
                                      width={18}
                                      height={18}
                                      style={{ 
                                        borderRadius: '2px',
                                        objectFit: 'contain',
                                        width: '100%',
                                        height: '100%',
                                        display: 'block'
                                      }}
                                    />
                                  ) : (
                                    <ApiOutlined style={{ fontSize: '14px', color: '#000000', lineHeight: '1' }} />
                                  )}
                                </Avatar>
                                <div style={{ flex: 1 }}>
                                  <Text strong style={{ color: '#202020', fontSize: '14px', display: 'block' }}>
                                    {provider?.name || integration.provider_name}
                                  </Text>
                                </div>
                                {isSelected && (
                                  <div style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: '#000000',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}>
                                    ✓
                                  </div>
                                )}
                              </div>
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  )}
                </div>
              </div>

          {integrations.length > 0 && (
            <div>
              <Button
                type="primary"
                size="large"
                icon={<UserAddOutlined />}
                onClick={handleCreateEmployee}
                disabled={!selectedIntegration}
                loading={loading}
                style={{ 
                  width: '100%',
                  backgroundColor: selectedIntegration ? '#000000' : '#d9d9d9',
                  borderColor: selectedIntegration ? '#000000' : '#d9d9d9',
                  color: selectedIntegration ? '#ffffff' : '#ffffff'
                }}
              >
                Create Employee
              </Button>
            </div>
          )}
        </Space>
      </Card>
      </div>
    </div>
  );
}
