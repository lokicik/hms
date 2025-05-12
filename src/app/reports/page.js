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

    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";

    // Add header row
    csvContent += "Date,Occupancy Rate (%),Revenue ($)\n";

    // Add data rows
    reportData.dailyOccupancy.forEach((item) => {
      csvContent += `${item.date},${item.occupancy.toFixed(1)},${
        item.revenue
      }\n`;
    });

    // Add summary data
    csvContent += "\nSummary Data\n";
    csvContent += `Total Rooms,${reportData.totalRooms}\n`;
    csvContent += `Occupied Rooms,${reportData.occupiedRooms}\n`;
    csvContent += `Empty Rooms,${reportData.emptyRooms}\n`;
    csvContent += `Out of Service Rooms,${reportData.outOfServiceRooms}\n`;
    csvContent += `Overall Occupancy Rate,${reportData.occupancyRate.toFixed(
      1
    )}%\n`;

    // Create file name based on report type
    const fileName = `${reportData.reportType}_report_${reportData.reportDate}.csv`;

    // Create a download link and trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    if (!reportData) return;

    // Create new PDF document
    const doc = new jsPDF();

    // Add title
    const title = `${
      reportData.reportType.charAt(0).toUpperCase() +
      reportData.reportType.slice(1)
    } Occupancy Report`;
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(12);
    doc.text(`Report Date: ${reportData.reportDate}`, 14, 30);

    // Add summary statistics
    doc.setFontSize(14);
    doc.text("Summary", 14, 40);

    const summaryData = [
      ["Total Rooms", reportData.totalRooms],
      ["Occupied Rooms", reportData.occupiedRooms],
      ["Empty Rooms", reportData.emptyRooms],
      ["Out of Service Rooms", reportData.outOfServiceRooms],
      ["Occupancy Rate", `${reportData.occupancyRate.toFixed(1)}%`],
    ];

    // First table - Summary
    autoTable(doc, {
      startY: 45,
      head: [["Metric", "Value"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [66, 139, 202] },
    });

    // Get final Y position after the first table
    const finalY = (doc.lastAutoTable || {}).finalY || 45;

    // Add occupancy data table title
    doc.setFontSize(14);
    doc.text("Occupancy Data", 14, finalY + 10);

    const tableData = reportData.dailyOccupancy.map((item) => [
      item.date,
      `${item.occupancy.toFixed(1)}%`,
      `$${item.revenue.toLocaleString()}`,
    ]);

    // Second table - Occupancy data
    autoTable(doc, {
      startY: finalY + 15,
      head: [["Date", "Occupancy Rate", "Revenue"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [66, 139, 202] },
    });

    // Save PDF with filename
    const fileName = `${reportData.reportType}_report_${reportData.reportDate}.pdf`;
    doc.save(fileName);
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
