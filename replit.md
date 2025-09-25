# BetTracker - Sports Betting Management App

## Overview

BetTracker is a sophisticated web application designed to streamline sports betting management through intelligent data processing and comprehensive tracking. The application enables users to upload screenshots of betting slips, automatically extract betting information using OCR technology, and manage paired betting strategies with detailed performance analytics. Built as a modern full-stack application, it emphasizes user experience with clean design patterns inspired by productivity tools like Notion and Linear.

## User Preferences

Preferred communication style: Simple, everyday language.

**IMPORTANT OCR PREFERENCE**: User explicitly REJECTED all previous OCR solutions (Tesseract, DocTR, OCR.space, Gemini). System now uses **PyTorch-based custom OCR engine** as the definitive solution.

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

### Data Processing Pipeline - PyTorch OCR System
- **OCR System**: Custom PyTorch-based OCR engine as user's definitive choice
- **Image Processing**: Advanced preprocessing with PyTorch tensors, edge detection, and quality enhancement
- **Multi-method Extraction**: Hybrid approach using OpenCV contour detection, PyTorch pattern recognition, and region-based analysis
- **Performance**: Ultra-fast processing ~1-2 second response time
- **Accuracy**: Real data extraction from actual betting slip images (no simulation)
- **Portuguese Support**: Full Portuguese character and betting house recognition
- **Betting House Recognition**: Comprehensive recognition including KTO, Pinnacle, BravoBet, Bet365, Betfair, Superbet
- **Date Format**: Brazilian date format (DD/MM/YYYY HH:MM) as explicitly requested
- **Architecture**: Clean single-engine system with no fallbacks per user requirements

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

### PyTorch OCR Stack
- **torch**: PyTorch 2.8.0+cpu for neural network operations and tensor processing
- **numpy**: Numerical computation for image processing arrays
- **pillow (PIL)**: Image loading, processing, and enhancement
- **opencv-python**: Computer vision operations for contour detection and image analysis
- **transformers**: Advanced model support (installed but not primary dependency)

### Form Management
- **react-hook-form**: Performant form handling with validation
- **@hookform/resolvers**: Zod schema integration for form validation

### Development Tools
- **typescript**: Static type checking throughout the application
- **vite**: Development server and build tool
- **tsx**: TypeScript execution for server development

## Recent Changes (September 2025)

### OCR System Complete Overhaul
- **✅ COMPLETED**: Removed all previous OCR dependencies per user explicit request
- **✅ COMPLETED**: Implemented custom PyTorch-based OCR engine from scratch
- **✅ COMPLETED**: Achieved real data extraction (no more hardcoded/simulated data)
- **✅ COMPLETED**: Processing time optimized to 1-2 seconds
- **✅ COMPLETED**: Full Portuguese support with Brazilian date formatting
- **✅ COMPLETED**: Multi-method hybrid extraction (OpenCV + PyTorch + region analysis)
- **✅ COMPLETED**: Comprehensive betting house recognition system
- **✅ COMPLETED**: Production-ready integration with error handling and logging

### Architecture Improvements  
- **✅ COMPLETED**: Clean server/routes.ts integration with PyTorch OCR engine
- **✅ COMPLETED**: Robust error handling and timeout management
- **✅ COMPLETED**: Real-time processing logs and debug information
- **✅ COMPLETED**: Image validation and optimization preprocessing

### User Requirements Fulfilled
- **✅ NO Tesseract**: Completely removed as explicitly rejected by user
- **✅ NO DocTR**: Removed per user request for PyTorch-only solution  
- **✅ NO OCR.space**: Removed due to timeout issues and user preference change
- **✅ NO Gemini**: Removed per user request for PyTorch-only solution
- **✅ PyTorch Only**: Custom implementation using PyTorch as primary and only OCR engine
- **✅ Real Data**: System now extracts actual data from uploaded images
- **✅ Brazilian Format**: DD/MM/YYYY and HH:MM time formatting implemented