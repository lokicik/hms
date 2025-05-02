import { NextResponse } from 'next/server';
import { updateBooking } from '@/utils/googleSheets';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const bookingData = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { message: 'Booking ID is required' },
        { status: 400 }
      );
    }
    
    const result = await updateBooking(id, bookingData);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { message: 'Failed to update booking' },
      { status: 500 }
    );
  }
} 