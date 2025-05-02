import { NextResponse } from 'next/server';
import { getAvailableRooms } from '@/utils/googleSheets';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const pax = searchParams.get('pax');
    
    if (!start || !end || !pax) {
      return NextResponse.json(
        { message: 'Start date, end date, and guest count are required' },
        { status: 400 }
      );
    }
    
    const rooms = await getAvailableRooms(start, end, pax);
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    return NextResponse.json(
      { message: 'Failed to fetch available rooms' },
      { status: 500 }
    );
  }
} 