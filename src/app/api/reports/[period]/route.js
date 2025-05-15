import { NextResponse } from "next/server";
import { getRoomsData, getBookingsData } from "@/utils/googleSheets";

export async function GET(request, { params }) {
  try {
    const { period } = params;
    const { searchParams } = new URL(request.url);
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];

    if (!period || !["daily", "weekly", "monthly"].includes(period)) {
      return NextResponse.json(
        { message: "Valid period is required (daily, weekly, or monthly)" },
        { status: 400 }
      );
    }

    const rooms = await getRoomsData();
    const bookings = await getBookingsData();

    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(
      (room) => room.status === "occupied"
    ).length;
    const emptyRooms = rooms.filter((room) => room.status === "empty").length;
    const outOfServiceRooms = rooms.filter(
      (room) => room.status === "out-of-service"
    ).length;
    const occupancyRate = (occupiedRooms / totalRooms) * 100;

    const reportDate = new Date(date);
    let dailyOccupancy = [];

    if (period === "daily") {
      dailyOccupancy = [
        {
          date,
          occupancyRate,
          occupiedRooms,
          totalRooms,
          revenue: calculateRevenue(bookings, date, date),
        },
      ];
    } else if (period === "weekly") {
      const startDate = new Date(reportDate);
      startDate.setDate(startDate.getDate() - 3);

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const formattedDate = currentDate.toISOString().split("T")[0];

        dailyOccupancy.push({
          date: formattedDate,
          occupancyRate: calculateOccupancyRate(bookings, rooms, formattedDate),
          revenue: calculateRevenue(bookings, formattedDate, formattedDate),
        });
      }
    } else if (period === "monthly") {
      const year = reportDate.getFullYear();
      const month = reportDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let i = 1; i <= daysInMonth; i++) {
        const currentDate = new Date(year, month, i);
        const formattedDate = currentDate.toISOString().split("T")[0];

        dailyOccupancy.push({
          date: formattedDate,
          occupancyRate: calculateOccupancyRate(bookings, rooms, formattedDate),
          revenue: calculateRevenue(bookings, formattedDate, formattedDate),
        });
      }
    }

    return NextResponse.json({
      totalRooms,
      occupiedRooms,
      emptyRooms,
      outOfServiceRooms,
      occupancyRate,
      dailyOccupancy,
      reportType: period,
      reportDate: date,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { message: "Failed to generate report" },
      { status: 500 }
    );
  }
}

function calculateOccupancyRate(bookings, rooms, date) {
  const activeBookingsOnDate = bookings.filter((booking) => {
    return (
      booking.status === "active" &&
      new Date(booking.checkIn) <= new Date(date) &&
      new Date(booking.checkOut) >= new Date(date)
    );
  });

  const occupiedRoomIds = activeBookingsOnDate.map((booking) => booking.roomId);
  const occupancyRate = (occupiedRoomIds.length / rooms.length) * 100;

  return occupancyRate;
}

function calculateRevenue(bookings, startDate, endDate) {
  const relevantBookings = bookings.filter((booking) => {
    const bookingStart = new Date(booking.checkIn);
    const bookingEnd = new Date(booking.checkOut);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    return (
      bookingStart <= rangeEnd &&
      bookingEnd >= rangeStart &&
      (booking.status === "active" || booking.status === "checked-out")
    );
  });

  return relevantBookings.reduce((total, booking) => {
    const bookingDays = Math.ceil(
      (new Date(booking.checkOut) - new Date(booking.checkIn)) /
        (1000 * 60 * 60 * 24)
    );

    const dailyRate = booking.totalPrice / bookingDays;

    const overlapStart = new Date(
      Math.max(new Date(booking.checkIn), new Date(startDate))
    );
    const overlapEnd = new Date(
      Math.min(new Date(booking.checkOut), new Date(endDate))
    );
    const overlapDays = Math.ceil(
      (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)
    );

    return total + dailyRate * overlapDays;
  }, 0);
}
