'use client';

import { useState, useEffect } from 'react';
import { 
  DatePicker, 
  InputNumber, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Card, 
  Form, 
  Row, 
  Col,
  Empty,
  Spin,
  message
} from 'antd';
import { SearchOutlined, CalendarOutlined, TeamOutlined } from '@ant-design/icons';
import AppLayout from '@/components/AppLayout';
import dayjs from 'dayjs';
import { initializeGoogleSheets, authenticateUser, getAvailableRooms } from '@/utils/googleSheets';
import { useRouter } from 'next/navigation';

const { RangePicker } = DatePicker;

export default function AvailabilityPage() {
  const [form] = Form.useForm();
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeApi = async () => {
      try {
        await initializeGoogleSheets();
        await authenticateUser();
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing Google Sheets API:', error);
        message.error('Failed to initialize Google Sheets API. Please try again.');
        setIsInitializing(false);
      }
    };

    initializeApi();
  }, []);

  const handleSearch = async (values) => {
    const { dateRange, guestCount } = values;
    
    if (!dateRange || !guestCount) {
      message.error('Please select dates and guest count');
      return;
    }
    
    const [checkIn, checkOut] = dateRange;
    const startDate = checkIn.format('YYYY-MM-DD');
    const endDate = checkOut.format('YYYY-MM-DD');
    
    setLoading(true);
    setSearched(true);
    
    try {
      const roomsData = await getAvailableRooms(startDate, endDate, guestCount);
      setAvailableRooms(roomsData);
    } catch (error) {
      message.error('Failed to search for available rooms');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = (room) => {
    router.push(`/bookings?action=new&roomId=${room.id}`);
  };

  const columns = [
    {
      title: 'Room Number',
      dataIndex: 'number',
      key: 'number',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        let color = 'blue';
        if (type === 'double') {
          color = 'purple';
        } else if (type === 'family') {
          color = 'green';
        }
        return <Tag color={color}>{type.toUpperCase()}</Tag>;
      },
      filters: [
        { text: 'Single', value: 'single' },
        { text: 'Double', value: 'double' },
        { text: 'Family', value: 'family' },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      sorter: (a, b) => a.capacity - b.capacity,
    },
    {
      title: 'Price per Night',
      dataIndex: 'pricePerNight',
      key: 'pricePerNight',
      render: (price) => `$${price}`,
      sorter: (a, b) => a.pricePerNight - b.pricePerNight,
    },
    {
      title: 'Nights',
      dataIndex: 'nights',
      key: 'nights',
    },
    {
      title: 'Total Price',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (price) => `$${price}`,
      sorter: (a, b) => a.totalPrice - b.totalPrice,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="primary" 
          onClick={() => handleBookNow(record)}
        >
          Book Now
        </Button>
      ),
    },
  ];

  const disabledDate = (current) => {
    // Can't select days before today
    return current && current < dayjs().startOf('day');
  };

  if (isInitializing) {
    return (
      <AppLayout>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Initializing Google Sheets API...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1>Check Room Availability</h1>
      
      <Card style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          initialValues={{ guestCount: 1 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="dateRange" 
                label="Check-in & Check-out Dates"
                rules={[{ required: true, message: 'Please select date range' }]}
              >
                <RangePicker 
                  style={{ width: '100%' }} 
                  disabledDate={disabledDate}
                  format="YYYY-MM-DD"
                  placeholder={['Check-in', 'Check-out']}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item 
                name="guestCount" 
                label="Guest Count"
                rules={[{ required: true, message: 'Please enter number of guests' }]}
              >
                <InputNumber 
                  min={1} 
                  max={10} 
                  style={{ width: '100%' }} 
                  placeholder="Number of guests"
                />
              </Form.Item>
            </Col>
            <Col span={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SearchOutlined />}
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  Search
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
      ) : searched ? (
        availableRooms.length > 0 ? (
          <Table 
            columns={columns} 
            dataSource={availableRooms}
            rowKey="id"
            pagination={{ pageSize: 5 }}
          />
        ) : (
          <Empty 
            description="No available rooms for the selected criteria"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )
      ) : (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Space direction="vertical" align="center" size="large">
            <div style={{ fontSize: 64 }}>
              <CalendarOutlined style={{ marginRight: 16 }} />
              <TeamOutlined />
            </div>
            <h3>Select dates and guest count to check room availability</h3>
          </Space>
        </div>
      )}
    </AppLayout>
  );
} 