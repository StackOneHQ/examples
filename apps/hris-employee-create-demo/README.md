# HRIS Employee Create Demo

A Next.js application showcasing StackOne's Platform and Unified APIs for employee creation across various HRIS systems.

## Features

- **Mock Authentication**: Simple login system for demo purposes
- **Integration Management**: Connect to HRIS providers (UKG Pro, Workday, ADP, SAP SuccessFactors, HiBob, Personio)
- **Employee Creation**: Create employees using unified or custom field mappings
- **SAP SuccessFactors Custom Mode**: Special handling for SAP with metadata transformation
- **Request Logging**: Monitor API requests and responses
- **Production-Ready UI**: Clean, responsive interface with proper error handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.local.example .env.local
```

3. Add your StackOne API key to `.env.local`:
```
STACKONE_API_KEY=your_stackone_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Demo Credentials

- **Username**: demo-user
- **Password**: demo

## Architecture

- **Database**: SQLite with better-sqlite3 for local storage
- **API Client**: StackOne TypeScript SDK
- **UI Framework**: Ant Design components
- **Styling**: Custom CSS with responsive design

## API Endpoints

- `POST /api/auth/login` - User authentication
- `GET /api/integrations` - List integrations
- `POST /api/integrations/connect` - Connect to HRIS provider
- `GET /api/employee/fields` - Get form fields for employee creation
- `POST /api/employee/create` - Create employee
- `GET /api/logs` - Get request logs
- `GET /api/dashboard/stats` - Dashboard statistics

## Database Schema

- **users**: Store demo user credentials
- **integrations**: Track connected HRIS providers
- **logs**: Record API requests and responses

## SAP SuccessFactors Integration

The app includes special handling for SAP SuccessFactors with custom metadata transformation:

### Custom Mode Features:
- **Metadata Transformation**: Converts SAP OData metadata to StackOne unified format
- **Field Mapping**: Maps SAP field names to StackOne standardized names
- **Value Mapping**: Handles enum value transformations (e.g., `M` → `male`)
- **Required Field Logic**: Enforces business rules for required fields
- **Proxy Integration**: Uses StackOne proxy endpoint for SAP-specific operations

### Files:
- `schema_transformations/sapsuccessfactors/transformation.ts` - Core transformation logic
- `schema_transformations/sapsuccessfactors/metadata_request.json` - SAP metadata request
- `schema_transformations/sapsuccessfactors/example_response.json` - Sample SAP response

### Usage:
When creating an employee with SAP SuccessFactors, users can toggle between:
- **Unified Mode**: Uses StackOne unified API
- **Custom Mode**: Uses SAP-specific field mappings and proxy endpoint

## Development

The app uses TypeScript and follows Next.js 15 conventions with App Router. All API routes are server-side and use the StackOne SDK for HRIS operations.
