"use client";

// Constants for Google Sheets API
const DISCOVERY_DOC =
  "https://sheets.googleapis.com/$discovery/rest?version=v4";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
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
    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      gapi.load("client", async () => {
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
    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: "", // Will be defined in the authenticateUser function
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
      tokenClient.requestAccessToken({ prompt: "consent" });
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
    gapi.client.setToken("");
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
      range: "rooms!A2:F",
    });

    const rows = response.result.values || [];

    // Transform the rows into objects
    return rows.map((row) => ({
      id: row[0],
      number: row[1],
      type: row[2],
      capacity: parseInt(row[3]),
      basePrice: parseFloat(row[4]),
      status: row[5],
    }));
  } catch (error) {
    console.error("Error fetching rooms data:", error);
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
      range: "prices!A2:G",
    });

    const rows = response.result.values || [];

    // Transform the rows into objects
    return rows.map((row) => ({
      id: row[0],
      roomId: row[1],
      startDate: row[2],
      endDate: row[3],
      priceType: row.length > 4 ? row[4] : "fixed", // 'fixed' or 'percentage'
      priceValue: parseFloat(row[5]),
      name: row.length > 6 ? row[6] : "",
    }));
  } catch (error) {
    console.error("Error fetching prices data:", error);
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
      range: "bookings!A2:M",
    });

    const rows = response.result.values || [];

    // Transform the rows into objects
    return rows.map((row) => ({
      id: row[0],
      roomId: row[1],
      guestName: row[2],
      phone: row[3],
      checkIn: row[4],
      checkOut: row[5],
      totalPrice: parseFloat(row[6]),
      status: row[7],
      basePrice: row.length > 8 ? parseFloat(row[8]) : null,
      pricePerNight: row.length > 9 ? parseFloat(row[9]) : null,
      nights: row.length > 10 ? parseInt(row[10]) : null,
      selectedRuleIds:
        row.length > 11 ? (row[11] ? row[11].split(",") : []) : [],
      notes: row.length > 12 ? row[12] : "",
    }));
  } catch (error) {
    console.error("Error fetching bookings data:", error);
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
    const nextId = Math.max(...rooms.map((r) => parseInt(r.id) || 0), 0) + 1;

    const values = [
      [
        nextId.toString(),
        room.number,
        room.type,
        room.capacity.toString(),
        room.basePrice.toString(),
        room.status,
      ],
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "rooms!A2:F",
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    return { ...room, id: nextId.toString() };
  } catch (error) {
    console.error("Error adding room:", error);
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
    const rowIndex = rooms.findIndex((r) => r.id === roomId);

    if (rowIndex === -1) {
      throw new Error("Room not found");
    }

    // +2 because the first row is headers and array is 0-indexed
    const row = rowIndex + 2;

    const values = [
      [
        roomId,
        room.number,
        room.type,
        room.capacity.toString(),
        room.basePrice.toString(),
        room.status,
      ],
    ];

    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `rooms!A${row}:F${row}`,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    return { ...room, id: roomId };
  } catch (error) {
    console.error("Error updating room:", error);
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
    const rowIndex = rooms.findIndex((r) => r.id === roomId);

    if (rowIndex === -1) {
      throw new Error("Room not found");
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
    console.error("Error deleting room:", error);
    throw error;
  }
}

/**
 * Calculate price with pricing rules
 */
export function calculatePriceWithRules(
  basePrice,
  rules,
  selectedRuleIds = [],
  checkIn,
  checkOut
) {
  let finalPrice = basePrice;

  // If check-in and check-out dates are provided, calculate day-by-day pricing
  if (checkIn && checkOut) {
    // Convert dates to Date objects if they're strings
    const startDate = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
    const endDate =
      typeof checkOut === "string" ? new Date(checkOut) : checkOut;

    // Calculate total nights
    const totalNights = Math.ceil(
      (endDate - startDate) / (1000 * 60 * 60 * 24)
    );

    // Initialize total price sum
    let totalSum = 0;

    // Calculate price for each day of the stay
    for (let i = 0; i < totalNights; i++) {
      // Get current date being calculated
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      // Start with base price for this day
      let dayPrice = basePrice;

      // Apply selected rules that are applicable for this specific day
      if (selectedRuleIds && selectedRuleIds.length > 0) {
        const appliedRules = selectedRuleIds
          .map((id) => rules.find((rule) => rule.id === id))
          .filter((rule) => rule !== undefined)
          .filter((rule) => {
            // Check if rule applies to this specific day
            const ruleStart = new Date(rule.startDate);
            const ruleEnd = new Date(rule.endDate);
            return currentDate >= ruleStart && currentDate <= ruleEnd;
          });

        // Apply each applicable rule for this day
        for (const rule of appliedRules) {
          if (rule.priceType === "fixed") {
            dayPrice = rule.priceValue;
          } else if (rule.priceType === "percentage") {
            dayPrice = dayPrice * (1 + rule.priceValue / 100);
          }
        }
      }

      // Add this day's price to the total
      totalSum += dayPrice;
    }

    // Calculate the average price per night (to maintain backward compatibility)
    finalPrice = totalSum / totalNights;
  }
  // Backward compatibility for when dates aren't provided
  else {
    // Apply selected rules in order
    if (selectedRuleIds && selectedRuleIds.length > 0) {
      // Find all applicable rules in the selected order
      const appliedRules = selectedRuleIds
        .map((id) => rules.find((rule) => rule.id === id))
        .filter((rule) => rule !== undefined);

      // Apply each rule
      for (const rule of appliedRules) {
        if (rule.priceType === "fixed") {
          finalPrice = rule.priceValue;
        } else if (rule.priceType === "percentage") {
          // For percentage, adjust the price by the percentage
          // Positive percentage means increase, negative means discount
          finalPrice = finalPrice * (1 + rule.priceValue / 100);
        }
      }
    }
  }

  return finalPrice;
}

/**
 * Get available rooms for a date range
 */
export async function getAvailableRooms(
  startDate,
  endDate,
  pax,
  selectedRuleIds = []
) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    // Get all rooms and bookings
    const rooms = await getRoomsData();
    const bookings = await getBookingsData();

    // Filter rooms by capacity and status
    let availableRooms = rooms.filter(
      (room) =>
        parseInt(room.capacity) >= parseInt(pax) &&
        (room.status === "empty" || room.status === "occupied")
    );

    // Filter out rooms with overlapping bookings
    availableRooms = availableRooms.filter((room) => {
      const roomBookings = bookings.filter(
        (b) => b.roomId === room.id && b.status === "active"
      );

      // Check if any booking overlaps with the requested dates
      const hasOverlap = roomBookings.some((booking) => {
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

    // Get pricing rules
    const prices = await getPricesData();

    // Calculate total price for each room
    const roomsWithPricing = availableRooms.map((room) => {
      // Get base price from the room
      const basePrice = parseFloat(room.basePrice);

      // Find any applicable pricing rules for this room and date range
      const applicableRules = prices.filter(
        (p) =>
          (p.roomId === room.id || p.roomId === "all") &&
          datesOverlap(p.startDate, p.endDate, startDate, endDate)
      );

      // Calculate price per night using rules
      const pricePerNight = calculatePriceWithRules(
        basePrice,
        applicableRules,
        selectedRuleIds,
        startDate,
        endDate
      );

      // Calculate number of nights
      const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      return {
        ...room,
        basePrice,
        pricePerNight,
        nights,
        totalPrice: pricePerNight * nights,
        applicableRules,
      };
    });

    return roomsWithPricing;
  } catch (error) {
    console.error("Error fetching available rooms:", error);
    throw error;
  }
}

// Helper function to check if date ranges overlap
function datesOverlap(ruleStart, ruleEnd, bookingStart, bookingEnd) {
  // Convert strings to Date objects
  const rStart = new Date(ruleStart);
  const rEnd = new Date(ruleEnd);
  const bStart = new Date(bookingStart);
  const bEnd = new Date(bookingEnd);

  // Check for any overlap between the ranges
  return (
    // Rule starts during booking
    (rStart >= bStart && rStart <= bEnd) ||
    // Rule ends during booking
    (rEnd >= bStart && rEnd <= bEnd) ||
    // Rule surrounds booking
    (rStart <= bStart && rEnd >= bEnd)
  );
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
    const nextId = Math.max(...bookings.map((b) => parseInt(b.id) || 0), 0) + 1;

    // Get rooms data
    const rooms = await getRoomsData();
    const room = rooms.find((r) => r.id === booking.roomId);

    // Use provided price information if available, otherwise calculate it
    let basePrice = booking.basePrice;
    let pricePerNight = booking.pricePerNight;
    let nights = booking.nights;
    let totalPrice = booking.totalPrice;
    
    // If price information is not provided, calculate it
    if (!basePrice || !pricePerNight || !nights || !totalPrice) {
      // Get the base price from the room
      basePrice = room ? parseFloat(room.basePrice) : 0;
      
      // Find applicable pricing rules for this room and date range
      const prices = await getPricesData();
      const applicableRules = prices.filter(
        (p) =>
          (p.roomId === booking.roomId || p.roomId === "all") &&
          datesOverlap(p.startDate, p.endDate, booking.checkIn, booking.checkOut)
      );

      // Get selected rule IDs from the booking if available
      const selectedRuleIds = booking.selectedRuleIds || [];

      // Calculate price per night using rules
      pricePerNight = calculatePriceWithRules(
        basePrice,
        applicableRules,
        selectedRuleIds,
        booking.checkIn,
        booking.checkOut
      );

      // Calculate number of nights
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      // Calculate total price
      totalPrice = pricePerNight * nights;
    }

    // Expand spreadsheet headers if needed
    try {
      const headersResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "bookings!A1:M1",
      });

      const headers =
        headersResponse.result.values && headersResponse.result.values[0];
      if (!headers || headers.length < 13) {
        // Update headers to include the new fields
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: "bookings!A1:M1",
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [
              [
                "ID",
                "Room ID",
                "Guest Name",
                "Phone",
                "Check In",
                "Check Out",
                "Total Price",
                "Status",
                "Base Price",
                "Price Per Night",
                "Nights",
                "Selected Rule IDs",
                "Notes",
              ],
            ],
          },
        });
      }
    } catch (error) {
      console.warn(
        "Error checking headers, will attempt to update them:",
        error
      );
      // If error, try to update headers anyway
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "bookings!A1:M1",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [
            [
              "ID",
              "Room ID",
              "Guest Name",
              "Phone",
              "Check In",
              "Check Out",
              "Total Price",
              "Status",
              "Base Price",
              "Price Per Night",
              "Nights",
              "Selected Rule IDs",
              "Notes",
            ],
          ],
        },
      });
    }

    const values = [
      [
        nextId.toString(),
        booking.roomId,
        booking.guestName,
        booking.phone,
        booking.checkIn,
        booking.checkOut,
        totalPrice.toString(),
        booking.status || "active",
        basePrice.toString(),
        pricePerNight.toString(),
        nights.toString(),
        booking.selectedRuleIds ? booking.selectedRuleIds.join(",") : "",
        booking.notes || "",
      ],
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "bookings!A2:M",
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    // Update room status to occupied
    if (room) {
      await updateRoom(room.id, { ...room, status: "occupied" });
    }

    return {
      ...booking,
      id: nextId.toString(),
      totalPrice,
      basePrice,
      pricePerNight,
      nights,
      selectedRuleIds: booking.selectedRuleIds,
    };
  } catch (error) {
    console.error("Error adding booking:", error);
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
    const rowIndex = bookings.findIndex((b) => b.id === bookingId);

    if (rowIndex === -1) {
      throw new Error("Booking not found");
    }

    // +2 because the first row is headers and array is 0-indexed
    const row = rowIndex + 2;

    // Use provided price information if available
    let basePrice = booking.basePrice !== undefined ? booking.basePrice : 0;
    let pricePerNight = booking.pricePerNight !== undefined ? booking.pricePerNight : 0;
    let totalPrice = booking.totalPrice !== undefined ? booking.totalPrice : 0;
    
    // If key booking parameters changed and price info not explicitly provided, recalculate prices
    if (
      (booking.checkIn !== bookings[rowIndex].checkIn ||
      booking.checkOut !== bookings[rowIndex].checkOut ||
      booking.roomId !== bookings[rowIndex].roomId) &&
      (booking.basePrice === undefined || booking.pricePerNight === undefined || booking.totalPrice === undefined)
    ) {
      // Check if any pricing rule applies to this booking
      const prices = await getPricesData();
      const rooms = await getRoomsData();
      const room = rooms.find((r) => r.id === booking.roomId);

      // Get base price from room
      basePrice = room ? parseFloat(room.basePrice) : 0;

      // Find applicable pricing rules for this room and date range
      const applicableRules = prices.filter(
        (p) =>
          (p.roomId === booking.roomId || p.roomId === "all") &&
          datesOverlap(p.startDate, p.endDate, booking.checkIn, booking.checkOut)
      );

      // Get selected rule IDs from the booking if available
      const selectedRuleIds = booking.selectedRuleIds || [];

      // Calculate price per night using rules
      pricePerNight = calculatePriceWithRules(
        basePrice,
        applicableRules,
        selectedRuleIds,
        booking.checkIn,
        booking.checkOut
      );

      // Calculate number of nights
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      // Calculate total price
      totalPrice = pricePerNight * nights;
    }

    // If we have selectedRuleIds, format them correctly
    const priceRuleId = booking.selectedRuleIds 
      ? (Array.isArray(booking.selectedRuleIds) 
          ? booking.selectedRuleIds.join(",") 
          : booking.selectedRuleIds)
      : "";

    // For backward compatibility
    const priceRuleApplied = booking.priceRuleApplied !== undefined 
      ? booking.priceRuleApplied 
      : basePrice !== pricePerNight;

    const values = [
      [
        booking.id || bookingId,
        booking.roomId,
        booking.guestName,
        booking.phone,
        booking.checkIn,
        booking.checkOut,
        totalPrice.toString(),
        booking.status,
        basePrice.toString(),
        pricePerNight.toString(),
        priceRuleApplied.toString(),
        priceRuleId,
      ],
    ];

    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `bookings!A${row}:L${row}`,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    // If status changed to 'checked-out' or 'cancelled', update room status to 'empty'
    if (booking.status === "checked-out" || booking.status === "cancelled") {
      const rooms = await getRoomsData();
      const room = rooms.find((r) => r.id === booking.roomId);

      if (room) {
        await updateRoom(room.id, { ...room, status: "empty" });
      }
    }

    return {
      ...booking,
      id: bookingId,
      totalPrice,
      basePrice,
      pricePerNight,
      priceRuleApplied,
      priceRuleId,
    };
  } catch (error) {
    console.error("Error updating booking:", error);
    throw error;
  }
}

/**
 * Add a new price rule
 */
export async function addPriceRule(priceRule) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    // Get existing price rules to determine next ID
    const prices = await getPricesData();
    const nextId = Math.max(...prices.map((p) => parseInt(p.id) || 0), 0) + 1;

    // Expand spreadsheet headers if needed
    try {
      const headersResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "prices!A1:G1",
      });

      const headers =
        headersResponse.result.values && headersResponse.result.values[0];
      if (!headers || headers.length < 7) {
        // Update headers to include the new fields
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: "prices!A1:G1",
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [
              [
                "ID",
                "Room ID",
                "Start Date",
                "End Date",
                "Price Type",
                "Price Value",
                "Rule Name",
              ],
            ],
          },
        });
      }
    } catch (error) {
      console.warn(
        "Error checking headers, will attempt to update them:",
        error
      );
      // If error, try to update headers anyway
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "prices!A1:G1",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [
            [
              "ID",
              "Room ID",
              "Start Date",
              "End Date",
              "Price Type",
              "Price Value",
              "Rule Name",
            ],
          ],
        },
      });
    }

    const values = [
      [
        nextId.toString(),
        priceRule.roomId,
        priceRule.startDate,
        priceRule.endDate,
        priceRule.priceType || "fixed",
        priceRule.priceValue.toString(),
        priceRule.name || "",
      ],
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "prices!A2:G",
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    return { ...priceRule, id: nextId.toString() };
  } catch (error) {
    console.error("Error adding price rule:", error);
    throw error;
  }
}

/**
 * Update an existing price rule
 */
export async function updatePriceRule(ruleId, priceRule) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    // Find the row with the given ID
    const prices = await getPricesData();
    const rowIndex = prices.findIndex((p) => p.id === ruleId);

    if (rowIndex === -1) {
      throw new Error("Price rule not found");
    }

    // +2 because the first row is headers and array is 0-indexed
    const row = rowIndex + 2;

    const values = [
      [
        ruleId,
        priceRule.roomId,
        priceRule.startDate,
        priceRule.endDate,
        priceRule.priceType || "fixed",
        priceRule.priceValue.toString(),
        priceRule.name || "",
      ],
    ];

    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `prices!A${row}:G${row}`,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    return { ...priceRule, id: ruleId };
  } catch (error) {
    console.error("Error updating price rule:", error);
    throw error;
  }
}

/**
 * Delete a price rule
 */
export async function deletePriceRule(ruleId) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    // Find the row with the given ID
    const prices = await getPricesData();
    const rowIndex = prices.findIndex((p) => p.id === ruleId);

    if (rowIndex === -1) {
      throw new Error("Price rule not found");
    }

    // +2 because the first row is headers and array is 0-indexed
    const row = rowIndex + 2;

    // Clear the row by updating it with empty values
    await gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `prices!A${row}:G${row}`,
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting price rule:", error);
    throw error;
  }
}
