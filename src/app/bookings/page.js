'use client';

import { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Tabs, 
  Drawer, 
  Form, 
  Input, 
  DatePicker, 
  Select, 
  Spin, 
  Alert,
  message,
  InputNumber,
  Descriptions,
  Badge
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  EyeOutlined, 
  CheckOutlined, 
  CloseOutlined
} from '@ant-design/icons';
import AppLayout from '@/components/AppLayout';
import dayjs from 'dayjs';
import { useSearchParams } from 'next/navigation';
import { 
  initializeGoogleSheets, 
  authenticateUser,
  getBookingsData, 
  getRoomsData,
  addBooking,
  updateBooking,
  getAvailableRooms
} from '@/utils/googleSheets';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [viewingBooking, setViewingBooking] = useState(null);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerType, setDrawerType] = useState('view'); // 'view', 'new', 'edit'
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('active');
  const [isInitializing, setIsInitializing] = useState(true);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedTotalPrice, setSelectedTotalPrice] = useState(0);
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        await initializeGoogleSheets();
        await authenticateUser();
        setIsInitializing(false);
        await fetchData();
        
        // Check if we need to open the new booking drawer
        const action = searchParams.get('action');
        const roomId = searchParams.get('roomId');
        
        if (action === 'new' && roomId) {
          const room = rooms.find(r => r.id === roomId);
          if (room) {
            handleShowDrawer('new');
            form.setFieldsValue({ roomId });
          }
        }
      } catch (error) {
        console.error('Error initializing Google Sheets API:', error);
        setError('Failed to initialize Google Sheets API. Please try again.');
        setIsInitializing(false);
        setLoading(false);
      }
    };
    
    initializeAndFetch();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch rooms and bookings data from Google Sheets
      const [roomsData, bookingsData] = await Promise.all([
        getRoomsData(),
        getBookingsData()
      ]);
      
      // Add room number to bookings data
      const enrichedBookings = bookingsData.map(booking => {
        const room = roomsData.find(r => r.id === booking.roomId);
        return {
          ...booking,
          roomNumber: room ? room.number : 'Unknown'
        };
      });
      
      setRooms(roomsData);
      setBookings(enrichedBookings);
    } catch (err) {
      setError('Failed to load bookings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowDrawer = (type, booking = null) => {
    setDrawerType(type);
    
    if (type === 'view') {
      setViewingBooking(booking);
      setDrawerTitle('Booking Details');
    } else if (type === 'new') {
      form.resetFields();
      setEditingBooking(null);
      setDrawerTitle('Create New Booking');
    } else if (type === 'edit') {
      setEditingBooking(booking);
      form.setFieldsValue({
        ...booking,
        dateRange: [dayjs(booking.checkIn), dayjs(booking.checkOut)],
      });
      setDrawerTitle('Edit Booking');
    }
    
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const [checkIn, checkOut] = values.dateRange;
      
      const bookingData = {
        ...values,
        checkIn: checkIn.format('YYYY-MM-DD'),
        checkOut: checkOut.format('YYYY-MM-DD'),
        totalPrice: selectedTotalPrice,
      };
      
      delete bookingData.dateRange;
      
      if (drawerType === 'edit' && editingBooking) {
        // Update existing booking
        await updateBooking(editingBooking.id, bookingData);
        message.success('Booking updated successfully');
      } else {
        // Create new booking
        await addBooking(bookingData);
        message.success('Booking created successfully');
      }
      
      setDrawerVisible(false);
      fetchData();
    } catch (err) {
      console.error('Validation failed:', err);
    }
  };

  const handleCheckout = async (id) => {
    try {
      const booking = bookings.find(b => b.id === id);
      if (booking) {
        await updateBooking(id, { ...booking, status: 'checked-out' });
        message.success('Guest checked out successfully');
        fetchData();
      }
    } catch (error) {
      message.error('Failed to check out guest');
      console.error(error);
    }
  };

  const handleCancel = async (id) => {
    try {
      const booking = bookings.find(b => b.id === id);
      if (booking) {
        await updateBooking(id, { ...booking, status: 'cancelled' });
        message.success('Booking cancelled successfully');
        fetchData();
      }
    } catch (error) {
      message.error('Failed to cancel booking');
      console.error(error);
    }
  };

  const handleDateRangeChange = async (dates) => {
    if (!dates || dates.length !== 2) {
      setAvailableRooms([]);
      // Reset total price when dates change
      setSelectedTotalPrice(0);
      return;
    }
    
    const [checkIn, checkOut] = dates;
    const guestCount = form.getFieldValue('guestCount') || 1;
    
    try {
      const availableRoomsData = await getAvailableRooms(
        checkIn.format('YYYY-MM-DD'),
        checkOut.format('YYYY-MM-DD'),
        guestCount
      );
      
      setAvailableRooms(availableRoomsData);
      
      // Reset the room selection and total price when available rooms change
      form.setFieldsValue({ roomId: undefined });
      setSelectedTotalPrice(0);
      
      // If there's only one room available, auto-select it
      if (availableRoomsData.length === 1) {
        form.setFieldsValue({ roomId: availableRoomsData[0].id });
        setSelectedTotalPrice(availableRoomsData[0].totalPrice);
      }
      
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  const handleGuestCountChange = async (value) => {
    const dateRange = form.getFieldValue('dateRange');
    if (!dateRange || dateRange.length !== 2) return;
    
    const [checkIn, checkOut] = dateRange;
    
    try {
      const availableRoomsData = await getAvailableRooms(
        checkIn.format('YYYY-MM-DD'),
        checkOut.format('YYYY-MM-DD'),
        value
      );
      
      setAvailableRooms(availableRoomsData);
      
      // Reset the room selection and total price when available rooms change
      form.setFieldsValue({ roomId: undefined });
      setSelectedTotalPrice(0);
      
      // If there's only one room available, auto-select it
      if (availableRoomsData.length === 1) {
        form.setFieldsValue({ roomId: availableRoomsData[0].id });
        setSelectedTotalPrice(availableRoomsData[0].totalPrice);
      }
      
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  const handleRoomSelect = (roomId) => {
    const room = availableRooms.find(r => r.id === roomId);
    if (room) {
      setSelectedTotalPrice(room.totalPrice);
      console.log(`Selected room with price: ${room.totalPrice}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'checked-out':
        return 'blue';
      case 'cancelled':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: 'Room',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      sorter: (a, b) => a.roomNumber.localeCompare(b.roomNumber),
    },
    {
      title: 'Guest Name',
      dataIndex: 'guestName',
      key: 'guestName',
      sorter: (a, b) => a.guestName.localeCompare(b.guestName),
    },
    {
      title: 'Check-in',
      dataIndex: 'checkIn',
      key: 'checkIn',
      sorter: (a, b) => dayjs(a.checkIn).unix() - dayjs(b.checkIn).unix(),
    },
    {
      title: 'Check-out',
      dataIndex: 'checkOut',
      key: 'checkOut',
      sorter: (a, b) => dayjs(a.checkOut).unix() - dayjs(b.checkOut).unix(),
    },
    {
      title: 'Total Price',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      render: (price) => `$${price}`,
      sorter: (a, b) => a.totalPrice - b.totalPrice,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Checked-out', value: 'checked-out' },
        { text: 'Cancelled', value: 'cancelled' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase().replace(/-/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const actions = [
          <Button 
            key="view" 
            icon={<EyeOutlined />} 
            onClick={() => handleShowDrawer('view', record)}
            size="small"
          />,
        ];
        
        if (record.status === 'active') {
          actions.push(
            <Button 
              key="edit" 
              icon={<EditOutlined />} 
              onClick={() => handleShowDrawer('edit', record)}
              size="small"
            />,
            <Button 
              key="checkout" 
              icon={<CheckOutlined />}
              onClick={() => handleCheckout(record.id)}
              size="small"
              style={{ backgroundColor: '#52c41a', color: 'white' }}
            />,
            <Button 
              key="cancel" 
              icon={<CloseOutlined />}
              danger
              onClick={() => handleCancel(record.id)}
              size="small"
            />
          );
        }
        
        return <Space size="small">{actions}</Space>;
      },
    },
  ];

  const renderDrawerContent = () => {
    if (drawerType === 'view' && viewingBooking) {
      return (
        <Descriptions 
          bordered 
          column={1}
          title={`Booking #${viewingBooking.id}`}
        >
          <Descriptions.Item label="Status">
            <Badge 
              status={getStatusColor(viewingBooking.status) === 'green' ? 'success' : 
                     getStatusColor(viewingBooking.status) === 'blue' ? 'processing' : 'error'} 
              text={viewingBooking.status.toUpperCase().replace(/-/g, ' ')} 
            />
          </Descriptions.Item>
          <Descriptions.Item label="Room Number">{viewingBooking.roomNumber}</Descriptions.Item>
          <Descriptions.Item label="Guest Name">{viewingBooking.guestName}</Descriptions.Item>
          <Descriptions.Item label="Phone Number">{viewingBooking.phone}</Descriptions.Item>
          <Descriptions.Item label="Check-in Date">{viewingBooking.checkIn}</Descriptions.Item>
          <Descriptions.Item label="Check-out Date">{viewingBooking.checkOut}</Descriptions.Item>
          <Descriptions.Item label="Total Price">${viewingBooking.totalPrice}</Descriptions.Item>
        </Descriptions>
      );
    }
    
    const disabledDate = (current) => {
      // Can't select days before today
      return current && current < dayjs().startOf('day');
    };
    
    return (
      <Form
        form={form}
        layout="vertical"
        name="bookingForm"
      >
        <Form.Item
          name="guestName"
          label="Guest Name"
          rules={[{ required: true, message: 'Please enter guest name' }]}
        >
          <Input placeholder="Full name" />
        </Form.Item>
        
        <Form.Item
          name="phone"
          label="Phone Number"
          rules={[{ required: true, message: 'Please enter phone number' }]}
        >
          <Input placeholder="e.g. +1 234 567 8900" />
        </Form.Item>
        
        <Form.Item
          name="guestCount"
          label="Number of Guests"
          rules={[{ required: true, message: 'Please enter number of guests' }]}
          initialValue={1}
        >
          <InputNumber 
            min={1} 
            max={10} 
            style={{ width: '100%' }}
            onChange={handleGuestCountChange}
          />
        </Form.Item>
        
        <Form.Item
          name="dateRange"
          label="Check-in & Check-out Dates"
          rules={[{ required: true, message: 'Please select date range' }]}
        >
          <RangePicker 
            style={{ width: '100%' }} 
            format="YYYY-MM-DD"
            disabledDate={disabledDate}
            onChange={handleDateRangeChange}
          />
        </Form.Item>
        
        <Form.Item
          name="roomId"
          label="Room"
          rules={[{ required: true, message: 'Please select a room' }]}
        >
          <Select 
            placeholder="Select a room" 
            onChange={handleRoomSelect}
            disabled={availableRooms.length === 0}
          >
            {availableRooms.map(room => (
              <Option key={room.id} value={room.id}>
                Room {room.number} ({room.type}) - ${room.pricePerNight}/night - Total: ${room.totalPrice}
              </Option>
            ))}
          </Select>
        </Form.Item>
        
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>
            <span>Total Price</span>
          </div>
          <div 
            style={{ 
              fontSize: '16px', 
              padding: '8px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '2px',
              backgroundColor: '#f5f5f5'
            }}
          >
            ${selectedTotalPrice}
          </div>
        </div>
        
        {drawerType === 'edit' && (
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select>
              <Option value="active">Active</Option>
              <Option value="checked-out">Checked Out</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Form.Item>
        )}
      </Form>
    );
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

  if (error) {
    return (
      <AppLayout>
        <Alert 
          message="Error" 
          description={error} 
          type="error" 
          showIcon 
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>Bookings</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => handleShowDrawer('new')}
        >
          New Booking
        </Button>
      </div>
      
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'active',
            label: 'Active Bookings',
            children: (
              <Table 
                columns={columns} 
                dataSource={bookings.filter(b => b.status === 'active')} 
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'checked-out',
            label: 'Checked-out',
            children: (
              <Table 
                columns={columns} 
                dataSource={bookings.filter(b => b.status === 'checked-out')} 
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'cancelled',
            label: 'Cancelled',
            children: (
              <Table 
                columns={columns} 
                dataSource={bookings.filter(b => b.status === 'cancelled')} 
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'all',
            label: 'All Bookings',
            children: (
              <Table 
                columns={columns} 
                dataSource={bookings} 
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />
      
      <Drawer
        title={drawerTitle}
        placement="right"
        closable={true}
        onClose={handleCloseDrawer}
        open={drawerVisible}
        width={480}
        footer={
          drawerType !== 'view' ? (
            <div style={{ textAlign: 'right' }}>
              <Button onClick={handleCloseDrawer} style={{ marginRight: 8 }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} type="primary">
                {drawerType === 'edit' ? 'Update' : 'Create'}
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <Button onClick={handleCloseDrawer}>
                Close
              </Button>
            </div>
          )
        }
      >
        {renderDrawerContent()}
      </Drawer>
    </AppLayout>
  );
} 