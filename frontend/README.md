# Money Exchange App Frontend

This is the frontend for the Money Exchange Admin Application. It's built with React, TypeScript, and Material-UI.

## Setup Instructions

1. Make sure Node.js (v14.0.0 or later) and npm are installed
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── Layout/           # App layout components
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Layout.tsx
│   ├── Dashboard/        # Dashboard components
│   ├── Currency/         # Currency management components
│   ├── ExchangeRate/     # Exchange rate components
│   ├── Transaction/      # Transaction components
│   ├── GoogleSheet/      # Google Sheets integration components
│   └── common/           # Common components like buttons, cards, etc.
├── pages/                # Main application pages
│   ├── Dashboard.tsx
│   ├── CurrencyList.tsx
│   ├── ExchangeRates.tsx
│   ├── Transactions.tsx
│   ├── Reports.tsx
│   ├── GoogleSheetSync.tsx
│   ├── Settings.tsx
│   └── Login.tsx
├── services/             # API and service functions
│   ├── api.ts            # Base API setup with axios
│   ├── auth-service.ts   # Authentication service
│   ├── currency-service.ts
│   ├── exchange-rate-service.ts
│   ├── transaction-service.ts
│   └── google-sheet-service.ts
├── hooks/                # Custom hooks
├── context/              # React context for global state
│   ├── AuthContext.tsx
│   └── UIContext.tsx
├── utils/                # Utility functions
├── types/                # TypeScript type definitions
└── App.tsx               # Main application component
```

## Required Dependencies

```json
{
  "dependencies": {
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0",
    "@mui/icons-material": "^5.14.16",
    "@mui/material": "^5.14.16",
    "@mui/x-data-grid": "^6.18.0",
    "@mui/x-date-pickers": "^6.18.0",
    "axios": "^1.6.0",
    "chart.js": "^4.4.0",
    "date-fns": "^2.30.0",
    "formik": "^2.4.5",
    "react": "^18.2.0",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.2.0",
    "react-query": "^3.39.3",
    "react-router-dom": "^6.18.0",
    "yup": "^1.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.8.10",
    "@types/react": "^18.2.34",
    "@types/react-dom": "^18.2.14",
    "typescript": "^5.2.2"
  }
}
```

## Features

- Admin authentication
- Dashboard with key metrics and charts
- Currency management
- Exchange rate management
- Transaction entry and management
- Google Sheets integration for data import
- Reports and analytics
- Responsive design for all screen sizes

## Deployment

To build the production version:

```
npm run build
```

The built files will be in the `build` directory, which can be deployed to any static file hosting service. 