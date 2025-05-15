"use client";

import { useState, useEffect } from "react";
import { Row, Col, Card, Statistic, Spin, Alert } from "antd";
import {
  BankOutlined,
  TeamOutlined,
  CalendarOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import AppLayout from "@/components/AppLayout";
import {
  initializeGoogleSheets,
  authenticateUser,
  getRoomsData,
  getBookingsData,
} from "@/utils/googleSheets";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRooms: 0,
    vacantRooms: 0,
    occupiedRooms: 0,
    occupancyRate: 0,
    totalBookings: 0,
    activeBookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        await initializeGoogleSheets();
        await authenticateUser();
        setIsInitializing(false);
        fetchData();
      } catch (error) {
        console.error("Error initializing Google Sheets API:", error);
        setError("Failed to initialize Google Sheets API. Please try again.");
        setIsInitializing(false);
        setLoading(false);
      }
    };

    initializeAndFetch();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [roomsData, bookingsData] = await Promise.all([
        getRoomsData(),
        getBookingsData(),
      ]);

      const totalRooms = roomsData.length;
      const vacantRooms = roomsData.filter(
        (room) => room.status === "empty"
      ).length;
      const occupiedRooms = roomsData.filter(
        (room) => room.status === "occupied"
      ).length;
      const occupancyRate =
        totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
      const totalBookings = bookingsData.length;
      const activeBookings = bookingsData.filter(
        (booking) => booking.status === "active"
      ).length;

      setStats({
        totalRooms,
        vacantRooms,
        occupiedRooms,
        occupancyRate,
        totalBookings,
        activeBookings,
      });
    } catch (err) {
      setError("Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Initializing Google Sheets API...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <Alert message="Error" description={error} type="error" showIcon />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1>Dashboard</h1>

      {loading ? (
        <div style={{ textAlign: "center", margin: "50px 0" }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={16} className="dashboard-cards">
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Rooms"
                  value={stats.totalRooms}
                  prefix={<BankOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Vacant Rooms"
                  value={stats.vacantRooms}
                  valueStyle={{ color: "#3f8600" }}
                  prefix={<BankOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Occupied Rooms"
                  value={stats.occupiedRooms}
                  valueStyle={{ color: "#cf1322" }}
                  prefix={<BankOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Occupancy Rate"
                  value={stats.occupancyRate}
                  precision={2}
                  valueStyle={{ color: "#1677ff" }}
                  suffix={<PercentageOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Card>
                <Statistic
                  title="Total Bookings"
                  value={stats.totalBookings}
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic
                  title="Active Bookings"
                  value={stats.activeBookings}
                  valueStyle={{ color: "#1677ff" }}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </AppLayout>
  );
}
