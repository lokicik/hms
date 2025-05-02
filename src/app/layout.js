import './globals.css';
import { Inter } from 'next/font/google';
import { ConfigProvider } from 'antd';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Hotel Management System',
  description: 'Admin panel to manage rooms, reservations, and reports for a hotel',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConfigProvider>
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
