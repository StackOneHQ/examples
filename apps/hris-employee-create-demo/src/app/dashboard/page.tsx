'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button } from 'antd';
import { 
  UserAddOutlined, 
  ApiOutlined, 
  FileTextOutlined,
  LoginOutlined 
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import Navigation from '@/components/Navigation';

export default function Dashboard() {
  const [stats, setStats] = useState({
    integrations: 0,
    employeesCreated: 0
  });
  const router = useRouter();

  useEffect(() => {
    // Fetch dashboard stats
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <div>
      <Navigation />
      
      <div style={{ 
        padding: '32px',
        backgroundColor: '#fafafa',
        minHeight: '100vh'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <p style={{ color: '#707070', fontSize: '16px', margin: 0 }}>
            Showcase StackOne's Platform and Unified APIs for employee creation across HRIS systems
          </p>
        </div>

        <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
          <Col span={8}>
            <Card 
              className="stackone-card"
              styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' } }}
            >
              <Statistic
                title="Active Integrations"
                value={stats.integrations}
                style={{ color: '#000000', fontSize: '32px', fontWeight: 600 }}
                prefix={<ApiOutlined />}
                className="stackone-statistic"
              />
              <div style={{ marginTop: 'auto' }}>
                <Button 
                  type="default" 
                  size="middle"
                  icon={<ApiOutlined />}
                  onClick={() => router.push('/integrations')}
                  style={{
                    backgroundColor: '#000000',
                    borderColor: '#000000',
                    color: '#ffffff',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    height: '36px',
                    paddingLeft: '16px',
                    paddingRight: '16px'
                  }}
                >
                  Manage Integrations
                </Button>
              </div>
            </Card>
          </Col>

          <Col span={8}>
            <Card 
              className="stackone-card"
              styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' } }}
            >
              <Statistic
                title="Employees Created"
                value={stats.employeesCreated}
                style={{ color: '#000000', fontSize: '32px', fontWeight: 600 }}
                prefix={<UserAddOutlined />}
                className="stackone-statistic"
              />
              <div style={{ marginTop: 'auto' }}>
                <Button 
                  type="default" 
                  size="middle"
                  icon={<UserAddOutlined />}
                  onClick={() => router.push('/actions')}
                  style={{
                    backgroundColor: '#000000',
                    borderColor: '#000000',
                    color: '#ffffff',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    height: '36px',
                    paddingLeft: '16px',
                    paddingRight: '16px'
                  }}
                >
                  Create Employee
                </Button>
              </div>
            </Card>
          </Col>

          <Col span={8}>
            <Card 
              className="stackone-card"
              styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' } }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '16px',
                minHeight: '56px',
                paddingTop: '10px',
                paddingBottom: '4px'
              }}>
                <FileTextOutlined style={{ fontSize: '32px', color: '#000000', marginRight: '12px' }} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#000000', marginBottom: '4px' }}>
                    Request Logs
                  </div>
                  <div style={{ fontSize: '14px', color: '#707070' }}>
                    Monitor API activity
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <Button 
                  type="default" 
                  size="middle"
                  icon={<FileTextOutlined />}
                  onClick={() => router.push('/logs')}
                  style={{
                    backgroundColor: '#000000',
                    borderColor: '#000000',
                    color: '#ffffff',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    height: '36px',
                    paddingLeft: '16px',
                    paddingRight: '16px'
                  }}
                >
                  View Logs
                </Button>
              </div>
            </Card>
          </Col>

        </Row>
      </div>
    </div>
  );
}
