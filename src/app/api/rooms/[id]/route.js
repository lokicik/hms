import { NextResponse } from 'next/server';
import { deleteRoom } from '@/utils/googleSheets';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { message: 'Room ID is required' },
        { status: 400 }
      );
    }
    
    const result = await deleteRoom(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { message: 'Failed to delete room' },
      { status: 500 }
    );
  }
} 