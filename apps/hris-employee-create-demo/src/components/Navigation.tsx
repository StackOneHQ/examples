'use client';

import { Button, Breadcrumb, Space } from 'antd';
import { HomeOutlined, ArrowLeftOutlined, LogoutOutlined } from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Logo from './Logo';

interface NavigationProps {
  showBackButton?: boolean;
  breadcrumbItems?: Array<{
    title: string;
    href?: string;
  }>;
}

export default function Navigation({ showBackButton = false, breadcrumbItems = [] }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    router.push('/login');
  };

  const handleBack = () => {
    router.back();
  };

  const handleHome = () => {
    router.push('/dashboard');
  };

  // Generate breadcrumb items based on current path
  const generateBreadcrumbs = () => {
    const items = [
      {
        title: (
          <Button 
            type="text" 
            icon={<HomeOutlined />} 
            onClick={handleHome}
            style={{ padding: 0, height: 'auto' }}
          >
            Dashboard
          </Button>
        ),
      }
    ];

    // Add custom breadcrumb items if provided
    breadcrumbItems.forEach(item => {
      items.push({
        title: item.href ? (
          <Button 
            type="text" 
            onClick={() => router.push(item.href!)}
            style={{ padding: 0, height: 'auto' }}
          >
            {item.title}
          </Button>
        ) : (
          <Button 
            type="text" 
            disabled
            style={{ 
              padding: 0, 
              height: 'auto',
              color: 'rgba(0, 0, 0, 0.45)',
              cursor: 'default'
            }}
          >
            {item.title}
          </Button>
        ),
      });
    });

    return items;
  };

  return (
    <div style={{ 
      padding: '16px 24px', 
      borderBottom: '1px solid #f0f0f0',
      backgroundColor: '#ffffff',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Logo />
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#202020' }}>
            HRIS Demo
          </h1>
        </div>
        
        {showBackButton && (
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBack}
            type="text"
            style={{ marginLeft: '16px' }}
          >
            Back
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Breadcrumb items={generateBreadcrumbs()} />
        
        <Button 
          icon={<LogoutOutlined />} 
          onClick={handleLogout}
          type="text"
        >
          Logout
        </Button>
      </div>
    </div>
  );
}
