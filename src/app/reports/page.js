"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Radio,
  Button,
  Table,
  Progress,
  DatePicker,
  Spin,
  Alert,
  Row,
  Col,
  Statistic,
  Space,
} from "antd";
import {
  FileExcelOutlined,
  FilePdfOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import AppLayout from "@/components/AppLayout";
import dayjs from "dayjs";
import {
  initializeGoogleSheets,
  authenticateUser,
  getRoomsData,
  getBookingsData,
} from "@/utils/googleSheets";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportType, setReportType] = useState("daily");
  const [reportDate, setReportDate] = useState(dayjs());
  const [reportData, setReportData] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [roomsData, setRoomsData] = useState([]);
  const [bookingsData, setBookingsData] = useState([]);

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        await initializeGoogleSheets();
        await authenticateUser();

        const [rooms, bookings] = await Promise.all([
          getRoomsData(),
          getBookingsData(),
        ]);

        setRoomsData(rooms);
        setBookingsData(bookings);
        setIsInitializing(false);
      } catch (error) {
        console.error("Error initializing Google Sheets API:", error);
        setError("Failed to initialize Google Sheets API. Please try again.");
        setIsInitializing(false);
      }
    };

    initializeAndFetch();
  }, []);

  const generateReport = async () => {
    try {
      setLoading(true);

      const totalRooms = roomsData.length;
      const occupiedRooms = roomsData.filter(
        (room) => room.status === "occupied"
      ).length;
      const emptyRooms = roomsData.filter(
        (room) => room.status === "empty"
      ).length;
      const outOfServiceRooms = roomsData.filter(
        (room) => room.status === "out-of-service"
      ).length;
      const occupancyRate =
        totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      const calculateRevenue = (occupancyPercent) => {
        const avgPrice =
          roomsData.reduce((sum, room) => sum + parseFloat(room.basePrice), 0) /
          totalRooms;
        return Math.floor(occupancyPercent * totalRooms * 0.01 * avgPrice);
      };

      let dailyOccupancy = [];

      if (reportType === "weekly") {
        for (let i = 0; i < 7; i++) {
          const date = dayjs(reportDate).subtract(3, "day").add(i, "day");
          const dateStr = date.format("YYYY-MM-DD");

          const activeCounts = countActiveBookingsOnDate(bookingsData, dateStr);
          const dailyOccupancyPercent =
            totalRooms > 0 ? (activeCounts / totalRooms) * 100 : 0;

          dailyOccupancy.push({
            date: dateStr,
            occupancy: dailyOccupancyPercent,
            revenue: calculateRevenue(dailyOccupancyPercent),
          });
        }
      } else if (reportType === "monthly") {
        const daysInMonth = reportDate.daysInMonth();
        const monthStart = dayjs(reportDate).startOf("month");

        for (let i = 0; i < daysInMonth; i++) {
          const date = monthStart.add(i, "day");
          const dateStr = date.format("YYYY-MM-DD");

          const activeCounts = countActiveBookingsOnDate(bookingsData, dateStr);
          const dailyOccupancyPercent =
            totalRooms > 0 ? (activeCounts / totalRooms) * 100 : 0;

          dailyOccupancy.push({
            date: dateStr,
            occupancy: dailyOccupancyPercent,
            revenue: calculateRevenue(dailyOccupancyPercent),
          });
        }
      } else {
        const dateStr = reportDate.format("YYYY-MM-DD");
        const activeCounts = countActiveBookingsOnDate(bookingsData, dateStr);
        const dailyOccupancyPercent =
          totalRooms > 0 ? (activeCounts / totalRooms) * 100 : 0;

        dailyOccupancy.push({
          date: dateStr,
          occupancy: dailyOccupancyPercent,
          revenue: calculateRevenue(dailyOccupancyPercent),
        });
      }

      setReportData({
        totalRooms,
        occupiedRooms,
        emptyRooms,
        outOfServiceRooms,
        occupancyRate,
        dailyOccupancy,
        reportType,
        reportDate: reportDate.format("YYYY-MM-DD"),
      });
    } catch (err) {
      setError("Failed to generate report");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const countActiveBookingsOnDate = (bookings, dateStr) => {
    return bookings.filter((booking) => {
      const checkIn = dayjs(booking.checkIn);
      const checkOut = dayjs(booking.checkOut);
      const date = dayjs(dateStr);

      return (
        booking.status === "active" &&
        date.isAfter(checkIn) &&
        date.isBefore(checkOut)
      );
    }).length;
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;

    // Build CSV string
    let csv = "data:text/csv;charset=utf-8,";

    // Headers
    csv += "Date,Occupancy %,Revenue\n";

    // Add each row of data
    reportData.dailyOccupancy.forEach((day) => {
      csv += `${day.date},${day.occupancy.toFixed(1)},${day.revenue}\n`;
    });

    // Add a summary section
    csv += "\nSummary\n";
    csv += `Rooms Total,${reportData.totalRooms}\n`;
    csv += `Rooms Occupied,${reportData.occupiedRooms}\n`;
    csv += `Rooms Empty,${reportData.emptyRooms}\n`;
    csv += `Rooms Out of Service,${reportData.outOfServiceRooms}\n`;
    csv += `Overall Occupancy,${reportData.occupancyRate.toFixed(1)}%\n`;

    // Create filename
    const filename = `occupancy-${reportData.reportType}-${reportData.reportDate}.csv`;

    // Trigger download
    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    if (!reportData) return;

    // New PDF doc
    const doc = new jsPDF();

    // Title and date
    const reportTitle = `${reportData.reportType[0].toUpperCase()}${reportData.reportType.slice(
      1
    )} Report`;
    doc.setFontSize(18);
    doc.text(reportTitle, 14, 22);

    doc.setFontSize(11);
    doc.text(`Generated: ${reportData.reportDate}`, 14, 32);

    // Summary section
    doc.setFontSize(14);
    doc.text("Room Summary", 14, 45);

    // Create summary table data
    const summaryRows = [
      ["Total Rooms:", reportData.totalRooms],
      ["Occupied:", reportData.occupiedRooms],
      ["Empty:", reportData.emptyRooms],
      ["Out of Service:", reportData.outOfServiceRooms],
      ["Occupancy:", `${reportData.occupancyRate.toFixed(1)}%`],
    ];

    // Draw the summary table
    autoTable(doc, {
      startY: 50,
      head: [["Metric", "Value"]],
      body: summaryRows,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Get the Y position after the table
    const yPos = doc.lastAutoTable.finalY + 15;

    // Daily data section
    doc.text("Daily Breakdown", 14, yPos);

    // Format the occupancy data for the table
    const dailyData = reportData.dailyOccupancy.map((d) => [
      d.date,
      `${d.occupancy.toFixed(1)}%`,
      `$${d.revenue}`,
    ]);

    // Draw the occupancy table
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Date", "Occupancy", "Revenue"]],
      body: dailyData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Save the PDF
    doc.save(`hotel-report-${reportData.reportDate}.pdf`);
  };

  const renderDatePicker = () => {
    if (reportType === "daily") {
      return (
        <DatePicker
          value={reportDate}
          onChange={setReportDate}
          allowClear={false}
          style={{ width: 200 }}
        />
      );
    } else if (reportType === "weekly") {
      return (
        <DatePicker
          value={reportDate}
          onChange={setReportDate}
          picker="week"
          allowClear={false}
          style={{ width: 200 }}
        />
      );
    } else if (reportType === "monthly") {
      return (
        <DatePicker
          value={reportDate}
          onChange={setReportDate}
          picker="month"
          allowClear={false}
          style={{ width: 200 }}
        />
      );
    }
  };

  const occupancyColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
    },
    {
      title: "Occupancy Rate",
      dataIndex: "occupancy",
      key: "occupancy",
      render: (rate) => (
        <Space>
          <Progress
            percent={rate.toFixed(1)}
            size="small"
            status={rate < 70 ? "normal" : rate < 90 ? "active" : "success"}
            style={{ width: 120 }}
          />
          <span>{rate.toFixed(1)}%</span>
        </Space>
      ),
    },
    {
      title: "Revenue",
      dataIndex: "revenue",
      key: "revenue",
      render: (amount) => `$${amount.toLocaleString()}`,
    },
  ];

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

  return (
    <AppLayout>
      <h1>Occupancy Reports</h1>

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Radio.Group
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="daily">Daily Report</Radio.Button>
              <Radio.Button value="weekly">Weekly Report</Radio.Button>
              <Radio.Button value="monthly">Monthly Report</Radio.Button>
            </Radio.Group>
          </div>

          <Space>
            {renderDatePicker()}
            <Button
              type="primary"
              onClick={generateReport}
              icon={<BarChartOutlined />}
              loading={loading}
            >
              Generate Report
            </Button>
          </Space>
        </Space>
      </Card>

      {loading ? (
        <div style={{ textAlign: "center", margin: "50px 0" }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert message="Error" description={error} type="error" showIcon />
      ) : reportData ? (
        <div>
          <Card title="Summary" style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="Total Rooms" value={reportData.totalRooms} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Occupied Rooms"
                  value={reportData.occupiedRooms}
                  valueStyle={{ color: "#cf1322" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Empty Rooms"
                  value={reportData.emptyRooms}
                  valueStyle={{ color: "#3f8600" }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Occupancy Rate"
                  value={reportData.occupancyRate}
                  precision={2}
                  suffix="%"
                  valueStyle={{ color: "#1677ff" }}
                />
              </Col>
            </Row>
          </Card>

          <Card
            title={`${
              reportType.charAt(0).toUpperCase() + reportType.slice(1)
            } Occupancy Data`}
            style={{ marginBottom: 24 }}
            extra={
              <Space>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={handleDownloadCSV}
                >
                  CSV
                </Button>
                <Button icon={<FilePdfOutlined />} onClick={handleDownloadPDF}>
                  PDF
                </Button>
              </Space>
            }
          >
            <Table
              columns={occupancyColumns}
              dataSource={reportData.dailyOccupancy.map((item, index) => ({
                ...item,
                key: index,
              }))}
              pagination={false}
            />
          </Card>
        </div>
      ) : null}
    </AppLayout>
  );
}
