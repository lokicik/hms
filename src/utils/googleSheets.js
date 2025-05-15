"use client";

const DISCOVERY_DOC =
  "https://sheets.googleapis.com/$discovery/rest?version=v4";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SPREADSHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID;

let tokenClient;
let gapiInitialized = false;
let gisInitialized = false;
let isInitializing = false;
let initPromise = null;

export async function initializeGoogleSheets() {
  if (isInitializing) {
    return initPromise;
  }

  if (gapiInitialized && gisInitialized) {
    return Promise.resolve();
  }

  isInitializing = true;

  initPromise = new Promise((resolve, reject) => {
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

    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: "",
      });
      gisInitialized = true;
      checkInitialized(resolve);
    };

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

function checkInitialized(resolve) {
  if (gapiInitialized && gisInitialized) {
    resolve();
  }
}

export async function authenticateUser() {
  await initializeGoogleSheets();

  if (gapi.client.getToken() !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      tokenClient.callback = (resp) => {
        if (resp.error) {
          reject(resp);
          return;
        }
        resolve(resp);
      };

      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      reject(err);
    }
  });
}

export function signOut() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    return true;
  }
  return false;
}

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

    return rows.map((row) => ({
      id: row[0],
      roomId: row[1],
      startDate: row[2],
      endDate: row[3],
      priceType: row.length > 4 ? row[4] : "fixed",
      priceValue: parseFloat(row[5]),
      name: row.length > 6 ? row[6] : "",
    }));
  } catch (error) {
    console.error("Error fetching prices data:", error);
    throw error;
  }
}

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

export async function addRoom(room) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

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

export async function updateRoom(roomId, room) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    const rooms = await getRoomsData();
    const rowIndex = rooms.findIndex((r) => r.id === roomId);

    if (rowIndex === -1) {
      throw new Error("Room not found");
    }

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

export async function deleteRoom(roomId) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    const rooms = await getRoomsData();
    const rowIndex = rooms.findIndex((r) => r.id === roomId);

    if (rowIndex === -1) {
      throw new Error("Room not found");
    }

    const row = rowIndex + 2;

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

export function calculatePriceWithRules(
  basePrice,
  rules,
  selectedRuleIds = [],
  checkIn,
  checkOut
) {
  let finalPrice = basePrice;

  if (checkIn && checkOut) {
    const startDate = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
    const endDate =
      typeof checkOut === "string" ? new Date(checkOut) : checkOut;

    const totalNights = Math.ceil(
      (endDate - startDate) / (1000 * 60 * 60 * 24)
    );

    let totalSum = 0;

    for (let i = 0; i < totalNights; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      let dayPrice = basePrice;

      if (selectedRuleIds && selectedRuleIds.length > 0) {
        const appliedRules = selectedRuleIds
          .map((id) => rules.find((rule) => rule.id === id))
          .filter((rule) => rule !== undefined)
          .filter((rule) => {
            const ruleStart = new Date(rule.startDate);
            const ruleEnd = new Date(rule.endDate);
            return currentDate >= ruleStart && currentDate <= ruleEnd;
          });

        for (const rule of appliedRules) {
          if (rule.priceType === "fixed") {
            dayPrice = rule.priceValue;
          } else if (rule.priceType === "percentage") {
            dayPrice = dayPrice * (1 + rule.priceValue / 100);
          }
        }
      }

      totalSum += dayPrice;
    }

    finalPrice = totalSum / totalNights;
  } else {
    if (selectedRuleIds && selectedRuleIds.length > 0) {
      const appliedRules = selectedRuleIds
        .map((id) => rules.find((rule) => rule.id === id))
        .filter((rule) => rule !== undefined);

      for (const rule of appliedRules) {
        if (rule.priceType === "fixed") {
          finalPrice = rule.priceValue;
        } else if (rule.priceType === "percentage") {
          finalPrice = finalPrice * (1 + rule.priceValue / 100);
        }
      }
    }
  }

  return finalPrice;
}

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

    const rooms = await getRoomsData();
    const bookings = await getBookingsData();

    let availableRooms = rooms.filter(
      (room) =>
        parseInt(room.capacity) >= parseInt(pax) &&
        (room.status === "empty" || room.status === "occupied")
    );

    availableRooms = availableRooms.filter((room) => {
      const roomBookings = bookings.filter(
        (b) => b.roomId === room.id && b.status === "active"
      );

      const hasOverlap = roomBookings.some((booking) => {
        const bookingStart = new Date(booking.checkIn);
        const bookingEnd = new Date(booking.checkOut);
        const requestStart = new Date(startDate);
        const requestEnd = new Date(endDate);

        return (
          (bookingStart >= requestStart && bookingStart < requestEnd) ||
          (bookingEnd > requestStart && bookingEnd <= requestEnd) ||
          (bookingStart <= requestStart && bookingEnd >= requestEnd)
        );
      });

      return !hasOverlap;
    });

    const prices = await getPricesData();

    const roomsWithPricing = availableRooms.map((room) => {
      const basePrice = parseFloat(room.basePrice);

      const applicableRules = prices.filter(
        (p) =>
          (p.roomId === room.id || p.roomId === "all") &&
          datesOverlap(p.startDate, p.endDate, startDate, endDate)
      );

      const pricePerNight = calculatePriceWithRules(
        basePrice,
        applicableRules,
        selectedRuleIds,
        startDate,
        endDate
      );

      const effectiveStartDate = new Date(startDate);
      const effectiveEndDate = new Date(endDate);
      const nights = Math.ceil(
        (effectiveEndDate - effectiveStartDate) / (1000 * 60 * 60 * 24)
      );

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

function datesOverlap(ruleStart, ruleEnd, bookingStart, bookingEnd) {
  const rStart = new Date(ruleStart);
  const rEnd = new Date(ruleEnd);
  const bStart = new Date(bookingStart);
  const bEnd = new Date(bookingEnd);

  return (
    (rStart >= bStart && rStart <= bEnd) ||
    (rEnd >= bStart && rEnd <= bEnd) ||
    (rStart <= bStart && rEnd >= bEnd)
  );
}

export async function addBooking(booking) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    const bookings = await getBookingsData();
    const nextId = Math.max(...bookings.map((b) => parseInt(b.id) || 0), 0) + 1;

    const rooms = await getRoomsData();
    const room = rooms.find((r) => r.id === booking.roomId);

    let basePrice = booking.basePrice;
    let pricePerNight = booking.pricePerNight;
    let nights = booking.nights;
    let totalPrice = booking.totalPrice;

    if (!basePrice || !pricePerNight || !nights || !totalPrice) {
      basePrice = room ? parseFloat(room.basePrice) : 0;

      const prices = await getPricesData();
      const applicableRules = prices.filter(
        (p) =>
          (p.roomId === booking.roomId || p.roomId === "all") &&
          datesOverlap(
            p.startDate,
            p.endDate,
            booking.checkIn,
            booking.checkOut
          )
      );

      const selectedRuleIds = booking.selectedRuleIds || [];

      pricePerNight = calculatePriceWithRules(
        basePrice,
        applicableRules,
        selectedRuleIds,
        booking.checkIn,
        booking.checkOut
      );

      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      totalPrice = pricePerNight * nights;
    }

    try {
      const headersResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "bookings!A1:M1",
      });

      const headers =
        headersResponse.result.values && headersResponse.result.values[0];
      if (!headers || headers.length < 13) {
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

export async function updateBooking(bookingId, booking) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    const bookings = await getBookingsData();
    const rowIndex = bookings.findIndex((b) => b.id === bookingId);

    if (rowIndex === -1) {
      throw new Error("Booking not found");
    }

    const row = rowIndex + 2;

    let basePrice = booking.basePrice ?? 0;
    let pricePerNight = booking.pricePerNight ?? 0;
    let totalPrice = booking.totalPrice ?? 0;

    if (
      (booking.checkIn !== bookings[rowIndex].checkIn ||
        booking.checkOut !== bookings[rowIndex].checkOut ||
        booking.roomId !== bookings[rowIndex].roomId) &&
      (booking.basePrice === undefined ||
        booking.pricePerNight === undefined ||
        booking.totalPrice === undefined)
    ) {
      const prices = await getPricesData();
      const rooms = await getRoomsData();
      const room = rooms.find((r) => r.id === booking.roomId);

      basePrice = room ? parseFloat(room.basePrice) ?? 0 : 0;

      const applicableRules = prices.filter(
        (p) =>
          (p.roomId === booking.roomId || p.roomId === "all") &&
          datesOverlap(
            p.startDate,
            p.endDate,
            booking.checkIn,
            booking.checkOut
          )
      );

      const selectedRuleIds = booking.selectedRuleIds || [];

      pricePerNight = calculatePriceWithRules(
        basePrice,
        applicableRules,
        selectedRuleIds,
        booking.checkIn,
        booking.checkOut
      );

      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      totalPrice = pricePerNight * nights;
    }

    const priceRuleId = booking.selectedRuleIds
      ? Array.isArray(booking.selectedRuleIds)
        ? booking.selectedRuleIds.join(",")
        : booking.selectedRuleIds
      : "";

    const priceRuleApplied =
      booking.priceRuleApplied ?? basePrice !== pricePerNight;

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

export async function addPriceRule(priceRule) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    const prices = await getPricesData();
    const nextId = Math.max(...prices.map((p) => parseInt(p.id) || 0), 0) + 1;

    try {
      const headersResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "prices!A1:G1",
      });

      const headers =
        headersResponse.result.values && headersResponse.result.values[0];
      if (!headers || headers.length < 7) {
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

export async function updatePriceRule(ruleId, priceRule) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    const prices = await getPricesData();
    const rowIndex = prices.findIndex((p) => p.id === ruleId);

    if (rowIndex === -1) {
      throw new Error("Price rule not found");
    }

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

export async function deletePriceRule(ruleId) {
  try {
    await initializeGoogleSheets();

    if (!gapi.client.getToken()) {
      await authenticateUser();
    }

    const prices = await getPricesData();
    const rowIndex = prices.findIndex((p) => p.id === ruleId);

    if (rowIndex === -1) {
      throw new Error("Price rule not found");
    }

    const row = rowIndex + 2;

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
