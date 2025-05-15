"use client";

import { useState, useEffect } from "react";
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
  Radio,
  InputNumber,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import AppLayout from "@/components/AppLayout";
import dayjs from "dayjs";
import {
  initializeGoogleSheets,
  authenticateUser,
  getRoomsData,
  getPricesData,
  addPriceRule,
  updatePriceRule,
  deletePriceRule,
} from "@/utils/googleSheets";

const { RangePicker } = DatePicker;
const { Option } = Select;

export default function PricingPage() {
  const [priceRules, setPriceRules] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("Add New Price Rule");
  const [modalLoading, setModalLoading] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form] = Form.useForm();
  const [currentPriceType, setCurrentPriceType] = useState("fixed");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await initializeGoogleSheets();
        await authenticateUser();

        const [roomsData, pricesData] = await Promise.all([
          getRoomsData(),
          getPricesData(),
        ]);

        const enhancedPriceRules = pricesData.map((rule) => {
          const room = roomsData.find((r) => r.id === rule.roomId) || {};
          return {
            ...rule,
            roomNumber: room.number,
            roomType: room.type,
            basePrice: room.basePrice,
          };
        });

        setPriceRules(enhancedPriceRules);
        setRooms(roomsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        message.error("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const showAddModal = () => {
    setModalTitle("Add New Price Rule");
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      priceType: "fixed",
      roomId: "all",
    });
    setCurrentPriceType("fixed");
    setIsModalVisible(true);
  };

  const showEditModal = (rule) => {
    setModalTitle("Edit Price Rule");
    setEditingRule(rule);

    const priceType = rule.priceType || "fixed";
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
        startDate: startDate.format("YYYY-MM-DD"),
        endDate: endDate.format("YYYY-MM-DD"),
        priceType: values.priceType,
        priceValue: parseFloat(values.priceValue),
      };

      let result;
      if (editingRule) {
        result = await updatePriceRule(editingRule.id, priceRule);
        message.success("Price rule updated successfully");
      } else {
        result = await addPriceRule(priceRule);
        message.success("Price rule added successfully");
      }

      if (editingRule) {
        setPriceRules((prevRules) =>
          prevRules.map((rule) =>
            rule.id === editingRule.id
              ? {
                  ...result,
                  roomNumber:
                    values.roomId === "all"
                      ? "All Rooms"
                      : rooms.find((r) => r.id === result.roomId)?.number,
                  roomType:
                    values.roomId === "all"
                      ? ""
                      : rooms.find((r) => r.id === result.roomId)?.type,
                  basePrice:
                    values.roomId === "all"
                      ? ""
                      : rooms.find((r) => r.id === result.roomId)?.basePrice,
                }
              : rule
          )
        );
      } else {
        setPriceRules((prevRules) => [
          ...prevRules,
          {
            ...result,
            roomNumber:
              values.roomId === "all"
                ? "All Rooms"
                : rooms.find((r) => r.id === result.roomId)?.number,
            roomType:
              values.roomId === "all"
                ? ""
                : rooms.find((r) => r.id === result.roomId)?.type,
            basePrice:
              values.roomId === "all"
                ? ""
                : rooms.find((r) => r.id === result.roomId)?.basePrice,
          },
        ]);
      }

      setIsModalVisible(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      message.error("Failed to save price rule. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePriceRule(id);
      message.success("Price rule deleted successfully");
      setPriceRules((prevRules) => prevRules.filter((rule) => rule.id !== id));
    } catch (error) {
      console.error("Error deleting price rule:", error);
      message.error("Failed to delete price rule. Please try again.");
    }
  };

  const handlePriceTypeChange = (e) => {
    const type = e.target.value;
    setCurrentPriceType(type);
    form.setFieldsValue({
      priceValue: "",
    });
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => (a.name || "").localeCompare(b.name || ""),
      render: (text) => text || <span style={{ color: "#ccc" }}>Unnamed</span>,
    },
    {
      title: "Room",
      dataIndex: "roomNumber",
      key: "roomNumber",
      sorter: (a, b) => {
        if (a.roomId === "all") return -1;
        if (b.roomId === "all") return 1;
        return a.roomNumber?.localeCompare(b.roomNumber);
      },
      render: (text, record) => {
        if (record.roomId === "all") {
          return <Tag color="blue">All Rooms</Tag>;
        }
        return (
          <span>
            Room {text}{" "}
            {record.roomType && (
              <Tag color="green">{record.roomType.toUpperCase()}</Tag>
            )}
          </span>
        );
      },
      filters: [
        {
          text: "All Rooms",
          value: "all",
        },
        ...Array.from(
          new Set(
            rooms
              .filter((room) => room.number)
              .map((room) => room.number)
              .sort()
          )
        ).map((num) => ({ text: `Room ${num}`, value: num })),
      ],
      onFilter: (value, record) => {
        if (value === "all") return record.roomId === "all";
        return record.roomNumber === value;
      },
    },
    {
      title: "Dates",
      key: "dates",
      render: (_, record) => (
        <span>
          {dayjs(record.startDate).format("MMM DD, YYYY")} -{" "}
          {dayjs(record.endDate).format("MMM DD, YYYY")}
        </span>
      ),
      sorter: (a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return dayjs(a.startDate).diff(dayjs(b.startDate));
      },
    },
    {
      title: "Price Type",
      dataIndex: "priceType",
      key: "priceType",
      render: (text) => (
        <Tag color={text === "fixed" ? "purple" : "orange"}>
          {text === "fixed" ? "Fixed Price" : "Percentage"}
        </Tag>
      ),
      filters: [
        { text: "Fixed Price", value: "fixed" },
        { text: "Percentage", value: "percentage" },
      ],
      onFilter: (value, record) => record.priceType === value,
    },
    {
      title: "Value",
      dataIndex: "priceValue",
      key: "priceValue",
      render: (value, record) => {
        if (record.priceType === "fixed") {
          return <span>${value}</span>;
        } else {
          return (
            <span>
              {value > 0 ? "+" : ""}
              {value}%
            </span>
          );
        }
      },
      sorter: (a, b) => a.priceValue - b.priceValue,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            onClick={() => showEditModal(record)}
            size="small"
          />
          <Popconfirm
            title="Are you sure you want to delete this rule?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            placement="left"
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Spin size="large" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h1>Pricing Rules</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={showAddModal}>
          Add Rule
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={priceRules}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={modalTitle}
        open={isModalVisible}
        onCancel={handleCancel}
        confirmLoading={modalLoading}
        onOk={handleSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Rule Name"
            rules={[
              {
                required: true,
                message: "Please enter a name for the price rule",
              },
            ]}
          >
            <Input placeholder="e.g. Summer Season, Weekend, Holiday" />
          </Form.Item>

          <Form.Item
            name="roomId"
            label="Apply to Room"
            rules={[
              {
                required: true,
                message: "Please select which room(s) this rule applies to",
              },
            ]}
          >
            <Select placeholder="Select a room">
              <Option value="all">All Rooms</Option>
              {rooms.map((room) => (
                <Option key={room.id} value={room.id}>
                  Room {room.number} ({room.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Date Range"
            rules={[
              {
                required: true,
                message: "Please select the date range for this rule",
              },
            ]}
          >
            <RangePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            name="priceType"
            label="Price Type"
            rules={[
              {
                required: true,
                message: "Please select the price type",
              },
            ]}
          >
            <Radio.Group onChange={handlePriceTypeChange}>
              <Radio value="fixed">Fixed Price</Radio>
              <Radio value="percentage">Percentage Adjustment</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="priceValue"
            label={
              currentPriceType === "fixed"
                ? "Fixed Price Amount"
                : "Percentage Adjustment"
            }
            rules={[
              {
                required: true,
                message: "Please enter the price value",
              },
              {
                validator(_, value) {
                  const numValue = parseFloat(value);
                  if (isNaN(numValue)) {
                    return Promise.reject(
                      new Error("Please enter a valid number")
                    );
                  }
                  if (currentPriceType === "fixed" && numValue <= 0) {
                    return Promise.reject(
                      new Error("Fixed price must be greater than 0")
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            {currentPriceType === "fixed" ? (
              <InputNumber
                prefix="$"
                min={0.01}
                step={10}
                style={{ width: "100%" }}
                formatter={(value) =>
                  `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                parser={(value) => value.replace(/\$\s?|(,*)/g, "")}
                placeholder="e.g. 150"
              />
            ) : (
              <InputNumber
                prefix={null}
                suffix="%"
                min={-100}
                max={100}
                step={5}
                style={{ width: "100%" }}
                placeholder="e.g. 20 for +20%, -10 for discount"
              />
            )}
          </Form.Item>

          <div style={{ marginTop: 16 }}>
            <p>
              <strong>How price rules work:</strong>
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>
                <strong>Fixed Price:</strong> Overrides the room's base price
                completely
              </li>
              <li>
                <strong>Percentage Adjustment:</strong> Modifies the room's base
                price by the percentage value
              </li>
              <li>
                When multiple rules apply, they are processed in order of
                selection
              </li>
            </ul>
          </div>
        </Form>
      </Modal>
    </AppLayout>
  );
}
