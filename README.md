# DigitalizePOS

Professional Desktop Point of Sale System for grocery shops

## Technology Stack

- **Framework**: Electron 27+ + React 18+ + TypeScript
- **UI Library**: Material-UI (MUI) 5.15+
- **State Management**: Redux Toolkit 2.0+
- **Build Tool**: Vite 5.0+
- **Styling**: Tailwind CSS 3.4+
- **Database**: SQLite with Prisma 5.7+
- **Database Driver**: better-sqlite3 9.2+

## Project Structure

```
digitalize-grocery-pos/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/          # React frontend
│   ├── preload/           # Preload scripts
│   ├── shared/            # Shared types and utilities
│   └── database/          # Database schema and migrations
├── dist/                  # Built renderer files
├── dist-electron/         # Built main process files
└── release/               # Packaged application
```

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development Mode

```bash
npm run electron:dev
```

This will:
1. Start Vite dev server for the renderer process
2. Build the main process
3. Launch Electron when ready

### Build

```bash
npm run build
```

This will:
1. Build TypeScript files
2. Build Vite bundle
3. Package the application with electron-builder

## Environment Variables

### Development Setup

The app works out of the box with defaults:
- `LICENSE_SERVER_URL` defaults to `http://localhost:3000` (for local development)
- `APP_SECRET` defaults to a placeholder (should be changed for production)

### Generate Secure Secret

For development, generate a secure `APP_SECRET`:

```bash
npm run generate:secret
```

This will output a secure random secret. Copy it to your `.env` file:

```env
# Development
LICENSE_SERVER_URL=http://localhost:3000
APP_SECRET=<generated-secret-from-script>

# Production (when ready)
# LICENSE_SERVER_URL=https://license.digitalizepos.com/api
# APP_SECRET=<strong-production-secret>
```

### Optional Environment Variables

- `APP_NAME` - Application name (default: "DigitalizePOS")
- `APP_VERSION` - Application version (default: "1.0.0")
- `LICENSE_SERVER_URL` - License server API URL (default: "http://localhost:3000")
- `APP_SECRET` - Secret key for encryption (generate with `npm run generate:secret`)

## License

Proprietary - All rights reserved

