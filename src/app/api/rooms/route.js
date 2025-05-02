import { NextResponse } from 'next/server';
import { getRoomsData, addRoom, updateRoom, deleteRoom } from '@/utils/googleSheets';

export async function GET() {
  try {
    const rooms = await getRoomsData();
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { message: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const roomData = await request.json();
    const result = await addRoom(roomData);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { message: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const roomData = await request.json();
    const { id, ...room } = roomData;
    
    if (!id) {
      return NextResponse.json(
        { message: 'Room ID is required' },
        { status: 400 }
      );
    }
    
    const result = await updateRoom(id, room);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { message: 'Failed to update room' },
      { status: 500 }
    );
  }
} 