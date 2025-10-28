'use client';

import { useState, useEffect } from 'react';
import { Card, Button, message, Tag, Typography, Image, Modal } from 'antd';
import { CheckCircleOutlined, PlusOutlined, ApiOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Integration, Provider } from '@/types';
import { StackOneHub } from '@/components/StackOneHub';
import { Account } from '@stackone/react-hub/dist/entities/Account';
import Navigation from '@/components/Navigation';
import { makeAuthenticatedRequest } from '@/lib/auth-client';

const { Title, Text } = Typography;

const availableProviders: Provider[] = [
  { key: 'ukgpro', name: 'UKG Pro', category: 'hris' },
  { key: 'workday', name: 'Workday', category: 'hris' },
  { key: 'adpworkforcenow', name: 'ADP Workforce Now', category: 'hris' },
  { key: 'sapsuccessfactors', name: 'SAP SuccessFactors', category: 'hris' },
  { key: 'hibob', name: 'HiBob', category: 'hris' },
  { key: 'personio', name: 'Personio', category: 'hris' }
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [deletingIntegration, setDeletingIntegration] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
    fetchProviderLogos();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/integrations');
      const data = await response.json();
      if (data.success) {
        setIntegrations(data.integrations);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    }
  };

  const fetchProviderLogos = async () => {
    try {
      const response = await fetch('/meta.json');
      const logos = await response.json();
      
      // Map logos to providers
      const providersWithLogos = availableProviders.map(provider => {
        const logoData = logos.find((logo: any) => logo.provider === provider.key);
        return {
          ...provider,
          icon_url: logoData?.logo_url || null
        };
      });
      
      setProviders(providersWithLogos);
    } catch (error) {
      console.error('Failed to fetch provider logos:', error);
      // Fallback to static providers without logos
      setProviders(availableProviders);
    }
  };

  const handleConnect = async (provider: Provider) => {
    setConnectingProvider(provider.key);
    message.info({
      content: `🔗 Opening ${provider.name} connection...`,
      duration: 3,
      style: {
        marginTop: '20px',
      },
    });
  };

  const handleConnectSuccess = async (account: Account) => {
    try {
      // Save the integration to our database
      const response = await makeAuthenticatedRequest('/api/integrations/connect', {
        method: 'POST',
        body: JSON.stringify({
          provider_key: account.provider,
          provider_name: account.provider,
          stackone_account_id: account.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        message.success({
          content: `🎉 Successfully connected to ${account.provider}!`,
          duration: 4,
          style: {
            marginTop: '20px',
          },
        });
        fetchIntegrations();
      } else {
        message.error({
          content: `❌ Failed to save integration: ${data.message || 'Unknown error'}`,
          duration: 5,
          style: {
            marginTop: '20px',
          },
        });
      }
    } catch (error) {
      message.error({
        content: '❌ An error occurred while saving the integration. Please try again.',
        duration: 5,
        style: {
          marginTop: '20px',
        },
      });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleConnectError = (error: unknown) => {
    console.error('Connection error:', error);
    message.error({
      content: '❌ Connection failed. Please try again or contact support if the issue persists.',
      duration: 5,
      style: {
        marginTop: '20px',
      },
    });
    setConnectingProvider(null);
  };

  const handleConnectClose = () => {
    setConnectingProvider(null);
  };

  const getIntegration = (providerKey: string) => {
    return integrations.find(integration => integration.provider_key === providerKey);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#00af66';
      case 'inactive': return '#d9d9d9';
      case 'error': return '#ff4d4f';
      default: return '#d9d9d9';
    }
  };

  const handleEdit = (integration: Integration) => {
    // Launch StackOne Hub for reconnection/reconfiguration
    setConnectingProvider(integration.provider_key);
  };

  const handleDelete = async (integration: Integration) => {
    // Use a custom confirmation approach to avoid Ant Design compatibility warnings
    const confirmed = window.confirm(
      `Are you sure you want to delete the ${integration.provider_name} integration?\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      setDeletingIntegration(integration.id);
      const response = await makeAuthenticatedRequest(`/api/integrations/${integration.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        message.success(`Successfully deleted ${integration.provider_name} integration`);
        fetchIntegrations();
      } else {
        message.error(data.message || 'Failed to delete integration');
      }
    } catch (error) {
      message.error('An error occurred while deleting the integration');
    } finally {
      setDeletingIntegration(null);
    }
  };

  return (
    <div>
      <Navigation 
        showBackButton={true}
        breadcrumbItems={[
          { title: 'Integrations' }
        ]}
      />
      
      <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        <div className="page-header">
          <Title level={2}>Integrations</Title>
          <Text type="secondary">
            Connect to HRIS providers to enable employee creation workflows
          </Text>
        </div>

      <div className="card-grid">
        {providers.map((provider) => {
          const integration = getIntegration(provider.key);
          const isConnected = !!integration;
          
          return (
            <Card
              key={provider.key}
              title={provider.name}
              style={{ height: '100%' }}
            >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    {provider.icon_url ? (
                      <Image
                        src={provider.icon_url}
                        alt={`${provider.name} logo`}
                        width={24}
                        height={24}
                        style={{ borderRadius: '4px' }}
                      />
                    ) : (
                      <ApiOutlined style={{ fontSize: '24px' }} />
                    )}
                    <Text strong>{provider.name}</Text>
                  </div>

              {isConnected ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag 
                    style={{
                      backgroundColor: getStatusColor(integration.status),
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: '500',
                      fontSize: '12px',
                      width: 'fit-content',
                      flexShrink: 0,
                      margin: 0,
                      padding: '2px 8px'
                    }}
                  >
                    {integration.status.toUpperCase()}
                  </Tag>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Button 
                      type="text" 
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(integration)}
                      style={{ color: '#707070' }}
                    />
                    <Button 
                      type="text" 
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(integration)}
                      loading={deletingIntegration === integration.id}
                      style={{ color: '#ff4d4f' }}
                    />
                  </div>
                </div>
              ) : (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    loading={connectingProvider === provider.key}
                    onClick={() => handleConnect(provider)}
                    style={{ 
                      backgroundColor: '#000000', 
                      borderColor: '#000000',
                      color: '#ffffff',
                      width: '100%',
                      height: '40px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#404040';
                      e.currentTarget.style.borderColor = '#404040';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#000000';
                      e.currentTarget.style.borderColor = '#000000';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)';
                    }}
                  >
                    Connect
                  </Button>
              )}
            </Card>
          );
        })}
      </div>

      <StackOneHub
        isOpen={!!connectingProvider}
        provider={connectingProvider || undefined}
        multiple={false}
        onSuccess={handleConnectSuccess}
        onError={handleConnectError}
        onClose={handleConnectClose}
      />
      </div>
    </div>
  );
}
