'use client';

import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, Space, Tooltip } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Log } from '@/types';
import Navigation from '@/components/Navigation';

const { Title, Text } = Typography;

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 25,
    total: 0
  });

  useEffect(() => {
    fetchLogs();
  }, [pagination.current, pagination.pageSize]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/logs?page=${pagination.current}&limit=${pagination.pageSize}`
      );
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs);
        setAccountCount(data.accountCount || 0);
        setPagination(prev => ({
          ...prev,
          total: data.total
        }));
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchLogs();
  };

  const columns = [
    {
      title: 'Operation',
      dataIndex: 'operation',
      key: 'operation',
      render: (operation: string) => (
        <Tag color="blue">{operation.replace(/_/g, ' ').toUpperCase()}</Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag 
          color={status === 'success' ? 'green' : 'red'}
          icon={status === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        >
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Integration',
      dataIndex: 'integration_id',
      key: 'integration_id',
      render: (integrationId: string) => (
        <Text code>{integrationId ? integrationId.slice(0, 8) + '...' : 'N/A'}</Text>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Log) => (
        <Space>
          <Tooltip title="View Request Data">
            <Button 
              size="small" 
              type="link"
              onClick={() => {
                if (record.request_data) {
                  const data = JSON.parse(record.request_data);
                  console.log('Request Data:', data);
                  // In a real app, you might show this in a modal
                }
              }}
            >
              Request
            </Button>
          </Tooltip>
          {record.response_data && (
            <Tooltip title="View Response Data">
              <Button 
                size="small" 
                type="link"
                onClick={() => {
                  const data = JSON.parse(record.response_data!);
                  console.log('Response Data:', data);
                  // In a real app, you might show this in a modal
                }}
              >
                Response
              </Button>
            </Tooltip>
          )}
          {record.error_message && (
            <Tooltip title="View Error">
              <Button 
                size="small" 
                type="link"
                danger
                onClick={() => {
                  console.log('Error:', record.error_message);
                  // In a real app, you might show this in a modal
                }}
              >
                Error
              </Button>
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Navigation 
        showBackButton={true}
        breadcrumbItems={[
          { title: 'Request Logs' }
        ]}
      />
      
      <div className="container" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        <div className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <Title level={2}>Request Logs</Title>
            </div>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
              loading={loading}
              style={{
                backgroundColor: '#000000',
                borderColor: '#000000',
                color: '#ffffff',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              Refresh
            </Button>
          </div>
        </div>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} logs`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize || 25
              }));
            }
          }}
          scroll={{ x: 800 }}
        />
      </Card>
      </div>
    </div>
  );
}
