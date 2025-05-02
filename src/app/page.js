'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';
import { isAuthenticated } from '@/utils/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // If user is authenticated, redirect to dashboard
    // Otherwise, redirect to login
    const redirectPath = isAuthenticated() ? '/dashboard' : '/login';
    router.push(redirectPath);
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      <Spin size="large" tip="Redirecting..." />
      </div>
  );
}
