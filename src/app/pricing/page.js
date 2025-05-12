'use client';

import { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  DatePicker, 
  Select, 
  Popconfirm, 
  message, 
  Spin,
  Tag,
  Space,
  Radio
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import AppLayout from '@/components/AppLayout';
import dayjs from 'dayjs';
import { 
  initializeGoogleSheets, 
  authenticateUser, 
  getRoomsData, 
  getPricesData,
  addPriceRule,
  updatePriceRule,
  deletePriceRule
} from '@/utils/googleSheets';

const { RangePicker } = DatePicker;
const { Option } = Select;

export default function PricingPage() {
  const [priceRules, setPriceRules] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add New Price Rule');
  const [modalLoading, setModalLoading] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form] = Form.useForm();
  const [currentPriceType, setCurrentPriceType] = useState('fixed');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await initializeGoogleSheets();
        await authenticateUser();
        
        const [roomsData, pricesData] = await Promise.all([
          getRoomsData(),
          getPricesData()
        ]);
        
        // Enrich price rules with room details
        const enhancedPriceRules = pricesData.map(rule => {
          const room = roomsData.find(r => r.id === rule.roomId) || {};
          return {
            ...rule,
            roomNumber: room.number,
            roomType: room.type,
            basePrice: room.basePrice
          };
        });
        
        setPriceRules(enhancedPriceRules);
        setRooms(roomsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        message.error('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const showAddModal = () => {
    setModalTitle('Add New Price Rule');
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      priceType: 'fixed',
      roomId: 'all'
    });
    setCurrentPriceType('fixed');
    setIsModalVisible(true);
  };

  const showEditModal = (rule) => {
    setModalTitle('Edit Price Rule');
    setEditingRule(rule);
    
    const priceType = rule.priceType || 'fixed';
    setCurrentPriceType(priceType);
    
    form.setFieldsValue({
      name: rule.name,
      roomId: rule.roomId,
      dateRange: [dayjs(rule.startDate), dayjs(rule.endDate)],
      priceType: priceType,
      priceValue: rule.priceValue,
    });
    
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);
      
      const [startDate, endDate] = values.dateRange;
      const priceRule = {
        name: values.name,
        roomId: values.roomId,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        priceType: values.priceType,
        priceValue: parseFloat(values.priceValue),
      };
      
      let result;
      if (editingRule) {
        result = await updatePriceRule(editingRule.id, priceRule);
        message.success('Price rule updated successfully');
      } else {
        result = await addPriceRule(priceRule);
        message.success('Price rule added successfully');
      }
      
      // Update the rule in the state
      if (editingRule) {
        setPriceRules(prevRules => prevRules.map(rule => 
          rule.id === editingRule.id ? {
            ...result,
            roomNumber: values.roomId === 'all' ? 'All Rooms' : rooms.find(r => r.id === result.roomId)?.number,
            roomType: values.roomId === 'all' ? '' : rooms.find(r => r.id === result.roomId)?.type,
            basePrice: values.roomId === 'all' ? '' : rooms.find(r => r.id === result.roomId)?.basePrice
          } : rule
        ));
      } else {
        setPriceRules(prevRules => [...prevRules, {
          ...result,
          roomNumber: values.roomId === 'all' ? 'All Rooms' : rooms.find(r => r.id === result.roomId)?.number,
          roomType: values.roomId === 'all' ? '' : rooms.find(r => r.id === result.roomId)?.type,
          basePrice: values.roomId === 'all' ? '' : rooms.find(r => r.id === result.roomId)?.basePrice
        }]);
      }
      
      setIsModalVisible(false);
    } catch (error) {
      console.error('Error submitting form:', error);
      message.error('Failed to save price rule. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await deletePriceRule(id);
      setPriceRules(prevRules => prevRules.filter(rule => rule.id !== id));
      message.success('Price rule deleted successfully');
    } catch (error) {
      console.error('Error deleting price rule:', error);
      message.error('Failed to delete price rule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Rule Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => name || `Rule ${record.id}`,
    },
    {
      title: 'Room',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      render: (roomNumber, record) => record.roomId === 'all' ? 'All Rooms' : roomNumber,
    },
    {
      title: 'Room Type',
      dataIndex: 'roomType',
      key: 'roomType',
      render: (type) => {
        if (!type) return '';
        let color = 'blue';
        if (type === 'double') {
          color = 'purple';
        } else if (type === 'family') {
          color = 'green';
        }
        return type ? <Tag color={color}>{type.toUpperCase()}</Tag> : '';
      },
      filters: [
        { text: 'All Rooms', value: 'all' },
        { text: 'Single', value: 'single' },
        { text: 'Double', value: 'double' },
        { text: 'Family', value: 'family' },
      ],
      onFilter: (value, record) => record.roomId === 'all' || record.roomType === value,
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      sorter: (a, b) => new Date(a.startDate) - new Date(b.startDate),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      sorter: (a, b) => new Date(a.endDate) - new Date(b.endDate),
    },
    {
      title: 'Price Type',
      dataIndex: 'priceType',
      key: 'priceType',
      render: (type) => (
        <Tag color={type === 'percentage' ? 'blue' : 'green'}>
          {type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
        </Tag>
      ),
      filters: [
        { text: 'Fixed Amount', value: 'fixed' },
        { text: 'Percentage', value: 'percentage' },
      ],
      onFilter: (value, record) => record.priceType === value,
    },
    {
      title: 'Price Value',
      dataIndex: 'priceValue',
      key: 'priceValue',
      render: (value, record) => {
        if (record.priceType === 'percentage') {
          const isIncrease = value > 0;
          return (
            <span style={{ color: isIncrease ? '#ff4d4f' : '#52c41a' }}>
              {isIncrease ? '+' : ''}{value}%
            </span>
          );
        } else {
          return `$${value}`;
        }
      },
      sorter: (a, b) => a.priceValue - b.priceValue,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => showEditModal(record)}
            size="small"
          />
          <Popconfirm
            title="Are you sure you want to delete this price rule?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <h1>Dynamic Pricing Management</h1>
      
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={showAddModal}
        >
          Add New Price Rule
        </Button>
      </div>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Card>
          <Table 
            columns={columns} 
            dataSource={priceRules}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}
      
      <Modal
        title={modalTitle}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="back" onClick={handleCancel}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={modalLoading} onClick={handleSubmit}>
            Save
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="Rule Name"
            rules={[{ required: true, message: 'Please enter a rule name' }]}
          >
            <Input placeholder="Enter a descriptive name (e.g. Summer Season, Weekend Discount)" />
          </Form.Item>
          
          <Form.Item
            name="roomId"
            label="Apply to"
            rules={[{ required: true, message: 'Please select where to apply the rule' }]}
          >
            <Select placeholder="Select room or all rooms">
              <Option key="all" value="all">All Rooms</Option>
              {rooms.map(room => (
                <Option key={room.id} value={room.id}>
                  Room {room.number} - {room.type.toUpperCase()} (Base Price: ${room.basePrice})
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="dateRange"
            label="Date Range"
            rules={[{ required: true, message: 'Please select date range' }]}
          >
            <RangePicker 
              style={{ width: '100%' }} 
              format="YYYY-MM-DD"
            />
          </Form.Item>
          
          <Form.Item
            name="priceType"
            label="Price Type"
            rules={[{ required: true, message: 'Please select price type' }]}
          >
            <Radio.Group 
              onChange={(e) => {
                setCurrentPriceType(e.target.value);
                // Force form to update
                form.setFieldsValue({
                  ...form.getFieldsValue(),
                  priceType: e.target.value
                });
              }}
            >
              <Radio value="fixed">Fixed Amount</Radio>
              <Radio value="percentage">Percentage Adjustment</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            name="priceValue"
            label="Price Value"
            rules={[
              { required: true, message: 'Please enter the price value' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const priceType = getFieldValue('priceType');
                  if (priceType === 'fixed' && value <= 0) {
                    return Promise.reject('Fixed price must be greater than 0');
                  }
                  if (priceType === 'percentage' && value === 0) {
                    return Promise.reject('Percentage cannot be 0');
                  }
                  return Promise.resolve();
                },
              }),
            ]}
            extra={
              currentPriceType === 'percentage' ? 
                'Use positive values for price increases (e.g. 10 for +10%) or negative values for discounts (e.g. -15 for -15%)' : 
                'Enter the exact price to charge per night'
            }
          >
            <Input 
              prefix={currentPriceType === 'fixed' ? <DollarOutlined /> : null}
              suffix={currentPriceType === 'percentage' ? '%' : null}
              placeholder={currentPriceType === 'fixed' ? "Enter fixed price" : "Enter percentage adjustment"}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
} 