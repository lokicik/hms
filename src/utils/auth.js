"use client";

export const isAuthenticated = () => {
  if (typeof window !== "undefined") {
    return !!localStorage.getItem("jwt");
  }
  return false;
};

export const getToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("jwt");
  }
  return null;
};

export const setToken = (token) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("jwt", token);
  }
};

export const clearToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("jwt");
  }
};
