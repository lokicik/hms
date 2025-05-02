'use client';

// Constants for Google Sheets API
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SPREADSHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID;

// Variables to track initialization
let tokenClient;
let gapiInitialized = false;
let gisInitialized = false;
let isInitializing = false;
let initPromise = null;

/**
 * Initialize the Google Sheets API
 */
export async function initializeGoogleSheets() {
  // If already initializing, return the existing promise
  if (isInitializing) {
    return initPromise;
  }

  // If already initialized, return immediately
  if (gapiInitialized && gisInitialized) {
    return Promise.resolve();
  }

  isInitializing = true;
  
  // Create a promise that resolves when both APIs are loaded
  initPromise = new Promise((resolve, reject) => {
    // Load the Google API client library
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInitialized = true;
          checkInitialized(resolve);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    // Load the Google Identity Services library
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Will be defined in the authenticateUser function
        // No redirect_uri needed - it uses the current URL by default
      });
      gisInitialized = true;
      checkInitialized(resolve);
    };
    
    // Add scripts to document
    document.head.appendChild(gapiScript);
    document.head.appendChild(gisScript);
  });
  
  try {
    await initPromise;
    isInitializing = false;
    return initPromise;
  } catch (error) {
    isInitializing = false;
    throw error;
  }
}

// Helper function to check if both APIs are initialized
function checkInitialized(resolve) {
  if (gapiInitialized && gisInitialized) {
    resolve();
  }
}

/**
 * Authenticate the user
 */
export async function authenticateUser() {
  await initializeGoogleSheets();
  
  // If we already have a token, no need to authenticate again
  if (gapi.client.getToken() !== null) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Define the callback for the token client
      tokenClient.callback = (resp) => {
        if (resp.error) {
          reject(resp);
          return;
        }
        resolve(resp);
      };
      
      // Request access token
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Sign the user out
 */
export function signOut() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
    return true;
  }
  return false;
}

/**
 * Get data from rooms sheet
 */
export async function getRoomsData() {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'rooms!A2:F',
    });
    
    const rows = response.result.values || [];
    
    // Transform the rows into objects
    return rows.map(row => ({
      id: row[0],
      number: row[1],
      type: row[2],
      capacity: parseInt(row[3]),
      basePrice: parseFloat(row[4]),
      status: row[5],
    }));
  } catch (error) {
    console.error('Error fetching rooms data:', error);
    throw error;
  }
}

/**
 * Get data from prices sheet
 */
export async function getPricesData() {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'prices!A2:E',
    });
    
    const rows = response.result.values || [];
    
    // Transform the rows into objects
    return rows.map(row => ({
      id: row[0],
      roomId: row[1],
      startDate: row[2],
      endDate: row[3],
      price: parseFloat(row[4]),
    }));
  } catch (error) {
    console.error('Error fetching prices data:', error);
    throw error;
  }
}

/**
 * Get data from bookings sheet
 */
export async function getBookingsData() {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'bookings!A2:H',
    });
    
    const rows = response.result.values || [];
    
    // Transform the rows into objects
    return rows.map(row => ({
      id: row[0],
      roomId: row[1],
      guestName: row[2],
      phone: row[3],
      checkIn: row[4],
      checkOut: row[5],
      totalPrice: parseFloat(row[6]),
      status: row[7],
    }));
  } catch (error) {
    console.error('Error fetching bookings data:', error);
    throw error;
  }
}

/**
 * Add a new room
 */
export async function addRoom(room) {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    // Get existing rooms to determine next ID
    const rooms = await getRoomsData();
    const nextId = Math.max(...rooms.map(r => parseInt(r.id) || 0), 0) + 1;
    
    const values = [
      [nextId.toString(), room.number, room.type, room.capacity.toString(), room.basePrice.toString(), room.status]
    ];
    
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'rooms!A2:F',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    
    return { ...room, id: nextId.toString() };
  } catch (error) {
    console.error('Error adding room:', error);
    throw error;
  }
}

/**
 * Update an existing room
 */
export async function updateRoom(roomId, room) {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    // Find the row with the given ID
    const rooms = await getRoomsData();
    const rowIndex = rooms.findIndex(r => r.id === roomId);
    
    if (rowIndex === -1) {
      throw new Error('Room not found');
    }
    
    // +2 because the first row is headers and array is 0-indexed
    const row = rowIndex + 2;
    
    const values = [
      [roomId, room.number, room.type, room.capacity.toString(), room.basePrice.toString(), room.status]
    ];
    
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `rooms!A${row}:F${row}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    
    return { ...room, id: roomId };
  } catch (error) {
    console.error('Error updating room:', error);
    throw error;
  }
}

/**
 * Delete a room
 */
export async function deleteRoom(roomId) {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    // Find the row with the given ID
    const rooms = await getRoomsData();
    const rowIndex = rooms.findIndex(r => r.id === roomId);
    
    if (rowIndex === -1) {
      throw new Error('Room not found');
    }
    
    // +2 because the first row is headers and array is 0-indexed
    const row = rowIndex + 2;
    
    // Clear the row by updating it with empty values
    await gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `rooms!A${row}:F${row}`,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting room:', error);
    throw error;
  }
}

/**
 * Add a new booking
 */
export async function addBooking(booking) {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    // Get existing bookings to determine next ID
    const bookings = await getBookingsData();
    const nextId = Math.max(...bookings.map(b => parseInt(b.id) || 0), 0) + 1;
    
    const values = [
      [
        nextId.toString(), 
        booking.roomId, 
        booking.guestName, 
        booking.phone, 
        booking.checkIn, 
        booking.checkOut, 
        booking.totalPrice.toString(), 
        booking.status || 'active'
      ]
    ];
    
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'bookings!A2:H',
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    
    // Update room status to occupied
    const rooms = await getRoomsData();
    const room = rooms.find(r => r.id === booking.roomId);
    
    if (room) {
      await updateRoom(room.id, { ...room, status: 'occupied' });
    }
    
    return { ...booking, id: nextId.toString() };
  } catch (error) {
    console.error('Error adding booking:', error);
    throw error;
  }
}

/**
 * Update an existing booking
 */
export async function updateBooking(bookingId, booking) {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    // Find the row with the given ID
    const bookings = await getBookingsData();
    const rowIndex = bookings.findIndex(b => b.id === bookingId);
    
    if (rowIndex === -1) {
      throw new Error('Booking not found');
    }
    
    // +2 because the first row is headers and array is 0-indexed
    const row = rowIndex + 2;
    
    const values = [
      [
        bookingId, 
        booking.roomId, 
        booking.guestName, 
        booking.phone, 
        booking.checkIn, 
        booking.checkOut, 
        booking.totalPrice.toString(), 
        booking.status
      ]
    ];
    
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `bookings!A${row}:H${row}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
    
    // If status changed to 'checked-out' or 'cancelled', update room status to 'empty'
    if (booking.status === 'checked-out' || booking.status === 'cancelled') {
      const rooms = await getRoomsData();
      const room = rooms.find(r => r.id === booking.roomId);
      
      if (room) {
        await updateRoom(room.id, { ...room, status: 'empty' });
      }
    }
    
    return { ...booking, id: bookingId };
  } catch (error) {
    console.error('Error updating booking:', error);
    throw error;
  }
}

/**
 * Get available rooms for a date range
 */
export async function getAvailableRooms(startDate, endDate, pax) {
  try {
    await initializeGoogleSheets();
    
    if (!gapi.client.getToken()) {
      await authenticateUser();
    }
    
    // Get all rooms and bookings
    const rooms = await getRoomsData();
    const bookings = await getBookingsData();
    
    // Filter rooms by capacity and status
    let availableRooms = rooms.filter(room => 
      parseInt(room.capacity) >= parseInt(pax) && 
      (room.status === 'empty' || room.status === 'occupied')
    );
    
    // Filter out rooms with overlapping bookings
    availableRooms = availableRooms.filter(room => {
      const roomBookings = bookings.filter(b => 
        b.roomId === room.id && 
        b.status === 'active'
      );
      
      // Check if any booking overlaps with the requested dates
      const hasOverlap = roomBookings.some(booking => {
        const bookingStart = new Date(booking.checkIn);
        const bookingEnd = new Date(booking.checkOut);
        const requestStart = new Date(startDate);
        const requestEnd = new Date(endDate);
        
        return (
          // Check if booking starts during the requested period
          (bookingStart >= requestStart && bookingStart < requestEnd) ||
          // Check if booking ends during the requested period
          (bookingEnd > requestStart && bookingEnd <= requestEnd) ||
          // Check if booking surrounds the requested period
          (bookingStart <= requestStart && bookingEnd >= requestEnd)
        );
      });
      
      return !hasOverlap;
    });
    
    // Get pricing for the period
    const prices = await getPricesData();
    
    // Calculate total price for each room
    const roomsWithPricing = availableRooms.map(room => {
      // Find custom pricing for this room during the requested period
      const customPricing = prices.find(p => 
        p.roomId === room.id && 
        new Date(p.startDate) <= new Date(startDate) && 
        new Date(p.endDate) >= new Date(endDate)
      );
      
      const pricePerNight = customPricing ? parseFloat(customPricing.price) : parseFloat(room.basePrice);
      
      // Calculate number of nights
      const start = new Date(startDate);
      const end = new Date(endDate);
      const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      return {
        ...room,
        pricePerNight,
        nights,
        totalPrice: pricePerNight * nights
      };
    });
    
    return roomsWithPricing;
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    throw error;
  }
} 