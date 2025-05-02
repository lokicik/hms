'use client';

import { getToken } from './auth';

const API_BASE_URL = '/api';

export const fetchData = async (endpoint, options = {}) => {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Something went wrong');
  }
  
  return response.json();
};

export const getRooms = () => {
  return fetchData('/rooms');
};

export const upsertRoom = (room) => {
  return fetchData('/rooms', {
    method: room.id ? 'PUT' : 'POST',
    body: JSON.stringify(room),
  });
};

export const deleteRoom = (id) => {
  return fetchData(`/rooms/${id}`, {
    method: 'DELETE',
  });
};

export const getAvailableRooms = (startDate, endDate, pax) => {
  return fetchData(`/availability?start=${startDate}&end=${endDate}&pax=${pax}`);
};

export const getBookings = () => {
  return fetchData('/bookings');
};

export const createBooking = (booking) => {
  return fetchData('/bookings', {
    method: 'POST',
    body: JSON.stringify(booking),
  });
};

export const updateBooking = (id, booking) => {
  return fetchData(`/bookings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(booking),
  });
};

export const getReport = (period) => {
  return fetchData(`/reports/${period}`);
}; 