'use client';

import { useState, useEffect } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  Spin, 
  Alert,
  message 
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined 
} from '@ant-design/icons';
import AppLayout from '@/components/AppLayout';
import { 
  initializeGoogleSheets, 
  authenticateUser,
  getRoomsData, 
  addRoom, 
  updateRoom, 
  deleteRoom 
} from '@/utils/googleSheets';

const { Option } = Select;

export default function RoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingRoom, setEditingRoom] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        await initializeGoogleSheets();
        await authenticateUser();
        setIsInitializing(false);
        fetchRooms();
      } catch (error) {
        console.error('Error initializing Google Sheets API:', error);
        setError('Failed to initialize Google Sheets API. Please try again.');
        setIsInitializing(false);
        setLoading(false);
      }
    };
    
    initializeAndFetch();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const roomsData = await getRoomsData();
      setRooms(roomsData);
    } catch (err) {
      setError('Failed to load rooms');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showAddModal = () => {
    setEditingRoom(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (room) => {
    setEditingRoom(room);
    form.setFieldsValue(room);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this room?',
      content: 'This action cannot be undone.',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await deleteRoom(id);
          await fetchRooms();
          message.success('Room deleted successfully');
        } catch (err) {
          message.error('Failed to delete room');
          console.error(err);
        }
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      
      if (editingRoom) {
        // Update existing room
        await updateRoom(editingRoom.id, values);
        message.success('Room updated successfully');
      } else {
        // Create new room
        await addRoom(values);
        message.success('Room created successfully');
      }
      
      setIsModalVisible(false);
      fetchRooms();
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setConfirmLoading(false);
    }
  };

  const columns = [
    {
      title: 'Room Number',
      dataIndex: 'number',
      key: 'number',
      sorter: (a, b) => a.number.localeCompare(b.number),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: 'Single', value: 'single' },
        { text: 'Double', value: 'double' },
        { text: 'Family', value: 'family' },
      ],
      onFilter: (value, record) => record.type === value,
      render: (type) => {
        let color = 'blue';
        if (type === 'double') {
          color = 'purple';
        } else if (type === 'family') {
          color = 'green';
        }
        return <Tag color={color}>{type.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      sorter: (a, b) => a.capacity - b.capacity,
    },
    {
      title: 'Base Price',
      dataIndex: 'basePrice',
      key: 'basePrice',
      sorter: (a, b) => a.basePrice - b.basePrice,
      render: (price) => `$${price}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Empty', value: 'empty' },
        { text: 'Occupied', value: 'occupied' },
        { text: 'Out of Service', value: 'out-of-service' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        let color = 'green';
        if (status === 'occupied') {
          color = 'red';
        } else if (status === 'out-of-service') {
          color = 'gray';
        }
        return <Tag color={color}>{status.replace(/-/g, ' ').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            icon={<EditOutlined />} 
            onClick={() => showEditModal(record)} 
            size="small"
          />
          <Button 
            icon={<DeleteOutlined />} 
            danger 
            onClick={() => handleDelete(record.id)} 
            size="small"
          />
        </Space>
      ),
    },
  ];

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
        <h1>Rooms Management</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={showAddModal}
        >
          Add Room
        </Button>
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', margin: '50px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table 
          columns={columns} 
          dataSource={rooms} 
          rowKey="id" 
          pagination={{ pageSize: 10 }}
        />
      )}

      <Modal
        title={editingRoom ? 'Edit Room' : 'Add Room'}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={confirmLoading} 
            onClick={handleSubmit}
          >
            {editingRoom ? 'Update' : 'Create'}
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          name="roomForm"
        >
          <Form.Item
            name="number"
            label="Room Number"
            rules={[{ required: true, message: 'Please enter the room number' }]}
          >
            <Input placeholder="e.g. 101" />
          </Form.Item>
          
          <Form.Item
            name="type"
            label="Room Type"
            rules={[{ required: true, message: 'Please select the room type' }]}
          >
            <Select placeholder="Select a room type">
              <Option value="single">Single</Option>
              <Option value="double">Double</Option>
              <Option value="family">Family</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="capacity"
            label="Capacity"
            rules={[{ required: true, message: 'Please enter the room capacity' }]}
          >
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="basePrice"
            label="Base Price"
            rules={[{ required: true, message: 'Please enter the base price' }]}
          >
            <InputNumber
              min={0}
              step={10}
              prefix="$"
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select the room status' }]}
          >
            <Select placeholder="Select a status">
              <Option value="empty">Empty</Option>
              <Option value="occupied">Occupied</Option>
              <Option value="out-of-service">Out of Service</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
} 