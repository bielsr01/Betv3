# BetTracker - Sports Betting Management App

## Overview

BetTracker is a sophisticated web application designed to streamline sports betting management through intelligent data processing and comprehensive tracking. The application enables users to upload screenshots of betting slips, automatically extract betting information using OCR technology, and manage paired betting strategies with detailed performance analytics. Built as a modern full-stack application, it emphasizes user experience with clean design patterns inspired by productivity tools like Notion and Linear.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development patterns
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design system supporting dark/light themes
- **State Management**: TanStack Query for server state and local React state for UI interactions
- **Routing**: Client-side routing with TypeScript path aliases for clean imports

### Backend Architecture
- **Server**: Express.js with TypeScript for API endpoints and middleware
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Schema Validation**: Zod schemas for runtime type checking and API validation
- **Session Management**: PostgreSQL sessions with connect-pg-simple
- **File Processing**: Image upload and OCR processing capabilities

### Database Design
- **Primary Database**: PostgreSQL with Drizzle schema definitions
- **Key Tables**:
  - `users`: User authentication and profiles
  - `bets`: Core betting data with paired betting strategy support
- **Betting Model**: Sophisticated paired betting system where each bet has a corresponding opposing bet, tracked through `pairId` and `betPosition` fields
- **Data Integrity**: Comprehensive validation with status tracking (pending, won, lost, returned)

### Component Architecture
- **Layout System**: Sidebar-based navigation with responsive design
- **Upload Flow**: Multi-step process from image upload → OCR verification → bet confirmation
- **Dashboard**: Card-based bet visualization with filtering and sorting capabilities
- **Theme System**: Comprehensive dark/light mode with CSS custom properties

### Data Processing Pipeline
- **Image Handling**: Drag-and-drop file upload with clipboard paste support
- **OCR Integration**: Automated extraction of betting house, teams, odds, stakes, and payouts
- **Verification Step**: User-editable form for OCR result validation before database storage
- **Bet Resolution**: Manual resolution system with profit/loss calculations

### Design System
- **Color Palette**: Professional blue primary with semantic status colors
- **Typography**: Inter font family for readability and professional appearance
- **Spacing**: Consistent Tailwind spacing units (2, 4, 6, 8) for visual harmony
- **Component Styling**: Hover and active state animations with elevation effects

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless database connection
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe ORM for PostgreSQL operations
- **drizzle-kit**: Database migrations and schema management

### UI and Styling
- **@radix-ui/***: Complete suite of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe component variant handling
- **react-dropzone**: File upload with drag-and-drop functionality

### Image Processing
- **cropperjs**: Image cropping functionality for bet slip optimization

### Form Management
- **react-hook-form**: Performant form handling with validation
- **@hookform/resolvers**: Zod schema integration for form validation

### Development Tools
- **typescript**: Static type checking throughout the application
- **vite**: Development server and build tool
- **tsx**: TypeScript execution for server development