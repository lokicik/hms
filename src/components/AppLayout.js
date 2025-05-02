'use client';

import { useState, useEffect } from 'react';
import { Layout, Menu, Button, theme, Spin } from 'antd';
import { 
  HomeOutlined, 
  BankOutlined, 
  CalendarOutlined, 
  BookOutlined, 
  BarChartOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated, clearToken } from '@/utils/auth';

const { Header, Content, Footer, Sider } = Layout;

function getItem(label, key, icon, children) {
  return {
    key,
    icon,
    children,
    label: <Link href={key}>{label}</Link>,
  };
}

const items = [
  getItem('Dashboard', '/dashboard', <HomeOutlined />),
  getItem('Rooms', '/rooms', <BankOutlined />),
  getItem('Availability', '/availability', <CalendarOutlined />),
  getItem('Bookings', '/bookings', <BookOutlined />),
  getItem('Reports', '/reports', <BarChartOutlined />),
];

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [selectedKeys, setSelectedKeys] = useState([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      router.push('/login');
    } else {
      setLoading(false);
    }
    
    const matchingKey = items.find(item => pathname.startsWith(item.key))?.key || '/dashboard';
    setSelectedKeys([matchingKey]);
  }, [pathname, router]);

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div className="logo">HMS</div>
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={selectedKeys}
          items={items} 
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <Button 
            type="text" 
            icon={<LogoutOutlined />} 
            onClick={handleLogout}
            style={{ float: 'right', margin: '16px 24px' }}
          >
            Logout
          </Button>
        </Header>
        <Content style={{ margin: '0 16px' }}>
          <div 
            style={{ 
              padding: 24, 
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              margin: '16px 0'
            }}
          >
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          Hotel Management System ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  );
} 