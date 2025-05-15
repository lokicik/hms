import { NextResponse } from "next/server";
import { getBookingsData, addBooking } from "@/utils/googleSheets";

export async function GET() {
  try {
    const bookings = await getBookingsData();
    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { message: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const bookingData = await request.json();

    bookingData.status = "active";

    const result = await addBooking(bookingData);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { message: "Failed to create booking" },
      { status: 500 }
    );
  }
}
