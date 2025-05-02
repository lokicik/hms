# Hotel Management System

A single-page admin panel (SPA-like) to manage rooms, reservations, and reports for a hotel using Next.js, Ant Design, and Google Sheets API.

## Features

- Room management (CRUD operations)
- Booking management
- Availability search
- Occupancy reporting with data export
- Authentication

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **UI Kit**: Ant Design
- **Data Store**: Google Sheets API
- **State Management**: React hooks and context
- **Authentication**: Simple JWT authentication

## Prerequisites

- Node.js 18+ and npm
- A Google account with access to Google Cloud Console
- A Google Sheets document with the following worksheets:
  - `rooms`: with columns for id, number, type, capacity, basePrice, status
  - `prices`: with columns for id, roomId, startDate, endDate, price
  - `bookings`: with columns for id, roomId, guestName, phone, checkIn, checkOut, totalPrice, status

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd hotel-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up Google Sheets API:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the Google Sheets API and press Manage
   - Set up the OAuth consent settings
   - Create credentials OAuth Client ID and API key
   - Add a redirect url to in OAuth Credentials screen to both Redirect URI's and JavaScript origins (e.g. http://localhost:3000)
   - Add your e-mail to test users
   - Create a Google Sheet with the required worksheets 
   - Get the Sheet ID from the URL
   - Create a Google Sheet document to use as your db
   - Share the sheet with the with open permissions

4. Create an environment file:
```bash
cp env.example .env.local
```

5. Fill in your environment variables in `.env.local`:
   - `NEXT_PUBLIC_GOOGLE_API_KEY`: API key for Google Sheet
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Private key from the downloaded JSON
   - `NEXT_PUBLIC_GOOGLE_SHEETS_ID`: The ID of your Google Sheet

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application

## Usage

1. Login with any credentials (for demo purposes)
2. Navigate through the sidebar menu to access different features:
   - Dashboard: Shows KPI cards with occupancy data
   - Rooms: Manage hotel rooms
   - Availability: Search for available rooms by date and guest count
   - Bookings: Manage guest bookings
   - Reports: Generate occupancy reports with export options

## Production Deployment

To build the app for production:

```bash
npm run build
npm run start
```

Or deploy to Vercel:

```bash
npm install -g vercel
vercel
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
