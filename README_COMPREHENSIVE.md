# 🚌 Raahi - Real-Time School Bus Tracking System

> A comprehensive full-stack solution for real-time school bus tracking, emergency detection, and management with web, mobile, and admin dashboard interfaces.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [System Architecture](#system-architecture)
5. [Project Structure](#project-structure)
6. [Installation & Setup](#installation--setup)
7. [Configuration](#configuration)
8. [Usage Guide](#usage-guide)
9. [API Documentation](#api-documentation)
10. [Emergency Detection System](#emergency-detection-system)
11. [Database Schema](#database-schema)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)

---

## 🎯 Project Overview

**Raahi** is a full-featured school bus tracking and management system that provides:

- **Real-time GPS tracking** of school buses with live location updates
- **Automated emergency detection** (sudden stops, falls, loud noise detection)
- **Multi-role access control** (Admin, Driver, Student, Student Admin)
- **Route management** with stop management and ETA calculation
- **Attendance tracking** for automated check-ins at stops
- **Emergency SOS system** with nearby hospital/police location lookup
- **Live notifications** for all stakeholders via Socket.io
- **Web Dashboard** for admin control center
- **Mobile App** (React Native) for drivers
- **Web-based Driver Interface** for testing and alternative access

### Target Users
- 🏫 **School Administrators** - Manage buses, routes, and drivers
- 👨‍✈️ **Bus Drivers** - Track GPS, handle emergencies, mark attendance
- 👨‍🎓 **Students** - View bus location and ETA
- 👩‍💼 **Student Admins** - Manage student assignments

---

## ✨ Features

### Core Features

#### 1. **Real-Time GPS Tracking**
- Live bus location updates every 5 seconds
- GPS speed monitoring
- ETA calculation using Turf.js
- Route visualization on Leaflet maps
- Bus location markers with status indicators

#### 2. **Emergency Detection System**
- **Automatic Triggers:**
  - Sudden speed drops (≥15 km/h decrease or hard stops)
  - Fall detection (DeviceMotionEvent accelerometer ≥24 m/s²)
  - Loud noise detection (Web Audio API RMS ≥50 dB)
- **Manual SOS:**
  - Emergency call button in driver interface
  - Custom emergency messages
- **Quick Response:**
  - Nearby hospitals, police stations, ambulance services lookup
  - Live location sharing via Google Maps
  - Real-time admin alerts with trip details

#### 3. **Route & Stop Management**
- Create and manage bus routes
- Define stops with coordinates and sequence
- Calculate route ETA dynamically
- Track stop events (ARRIVED, DEPARTED, SOS)
- Speed segment statistics

#### 4. **Student Management**
- Assign students to buses and routes
- Track student boarding/alighting
- Attendance automation via QR codes
- Student dashboard with live bus tracking

#### 5. **Multi-Role Access Control**
- Role-based authentication (Admin, Driver, Student, StudentAdmin)
- JWT-based token management
- Protected API endpoints
- Password hashing with bcryptjs

#### 6. **Admin Dashboard**
- Live fleet monitoring
- Real-time statistics (buses, drivers, students, active trips)
- Event timeline
- SOS alert notifications (sticky banner at top)
- Trip history and analytics
- Quick access to management modules

#### 7. **Notifications**
- Push notifications for SOS events
- Stop event notifications
- Real-time updates via Socket.io
- In-app toast notifications

---

## 🛠️ Tech Stack

### Backend
```
- Runtime: Node.js
- Framework: Express.js 4.19.2
- Database: MongoDB 7.6.3 with Mongoose
- Real-Time: Socket.io 4.7.5
- Authentication: JWT + bcryptjs
- Geospatial: Turf.js 6.5.0
- Push Notifications: web-push 3.6.7
- Rate Limiting: express-rate-limit 8.2.1
- Environment: dotenv 16.4.5
- Dev Tool: Nodemon 3.1.0
```

### Frontend (Web)
```
- Framework: React 19.1.0
- Build Tool: Vite 7.3.1
- Routing: React Router 6.27.0
- Styling: Tailwind CSS 3.4.14
- Maps: Leaflet 1.9.4 + react-leaflet 4.2.1
- Icons: Lucide React 0.561.0
- HTTP Client: Axios 1.6.8
- Real-Time: Socket.io Client 4.7.5
- Animations: Framer Motion 12.23.26
- Notifications: react-hot-toast 2.6.0
- Post-CSS: autoprefixer 10.4.19
```

### Mobile (React Native)
```
- Framework: React Native + Expo 54
- Build: Expo CLI
- Geolocation: expo-location
- Maps: react-native-maps
- Local Storage: AsyncStorage
- Navigation: React Navigation
```

---

## 🏗️ System Architecture

### Architecture Overview
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                              │
├─────────────────┬──────────────────┬────────────────────┤
│  Web Dashboard  │  Web Driver UI   │  Mobile App        │
│  (Admin/Viewer) │  (React)         │  (React Native)    │
└────────┬────────┴────────┬─────────┴────────┬───────────┘
         │                 │                  │
         │ HTTP/WebSocket  │                  │
         │                 │                  │
┌────────▼─────────────────▼──────────────────▼───────────┐
│                   API SERVER                            │
│         (Express.js + Socket.io)                        │
│                                                          │
│  ├─ Auth Routes        ├─ Driver Routes                │
│  ├─ Admin Routes       ├─ Student Routes               │
│  ├─ Route Routes       ├─ Bus Routes                    │
│  ├─ Trip Routes        ├─ Event Routes                  │
│  └─ Location Handlers  └─ Notification Routes          │
└────────┬──────────────────────────────────────────────┬─┘
         │                                                │
         │ Mongoose ODM                    API Calls     │
         │                                                │
┌────────▼────────────────────────────────────────────┐  │
│         MongoDB Database                            │  │
│                                                      │  │
│  ├─ Users         ├─ Routes                        │  │
│  ├─ Buses         ├─ Stops                         │  │
│  ├─ Trips         ├─ StudentAssignments           │  │
│  ├─ StopEvents    └─ Attendance                   │  │
│  └─ Notifications                                 │  │
└───────────────────────────────────────────────────┬┘  │
                                                     │  │
                    External APIs                   │  │
                    ├─ OpenStreetMap Overpass◄──────┘  │
                    └─ (Emergency Services Lookup)     │
```

### Communication Flow

#### GPS Location Update Flow
```
Driver Device (GPS)
    ↓
[watchPosition] Periodic update
    ↓
Driver Emits: 'driver:location_update'
    ↓
Socket.io Server
    ↓
[locationController.js] Process location
    ↓
├─ Update Trip location
├─ Calculate ETA
├─ Check emergency triggers
└─ Broadcast to:
    ├─ trip:location_updated (to trip subscribers)
    ├─ admin_room (for admin dashboard)
    └─ specific students (for their bus)
```

#### Emergency SOS Flow
```
Emergency Trigger (Speed/Fall/Sound/Manual)
    ↓
Driver Calls: triggerEmergency()
    ↓
Show SOS Modal → Driver confirms/cancels
    ↓
Fetch: /driver/emergency-services (Get hospitals/police)
    ↓
Driver Emits: 'driver:sos'
    ↓
Backend Creates StopEvent (status: SOS)
    ↓
Admin Receives:
├─ Sticky banner alert at top
├─ Trip details (bus, driver, route)
├─ Location link (Google Maps)
└─ Acknowledge button
    ↓
Admin clicks "Acknowledge" or dismiss
```

---

## 📁 Project Structure

```
Raahi/
├── README.md                          # Old README
├── README_COMPREHENSIVE.md            # This file
├── package.json                       # Root package config
├── vercel.json                        # Deployment config
│
├── backend/                           # Express.js Server
│   ├── server.js                      # Entry point
│   ├── package.json                   # Backend dependencies
│   ├── vercel.json                    # Backend deployment
│   │
│   ├── config/
│   │   ├── constants.js               # App constants
│   │   └── db.js                      # MongoDB connection
│   │
│   ├── models/                        # Mongoose Schemas
│   │   ├── User.js                    # User (Admin/Driver/Student)
│   │   ├── Bus.js                     # Bus details
│   │   ├── Route.js                   # Bus routes
│   │   ├── Stop.js                    # Route stops
│   │   ├── Trip.js                    # Active/past trips
│   │   ├── StopEvent.js               # Stop arrival/SOS events
│   │   ├── StudentAssignment.js       # Student-Bus assignments
│   │   ├── Attendance.js              # Student attendance records
│   │   └── Notification.js            # Push notification logs
│   │
│   ├── controllers/                   # Business Logic
│   │   ├── authController.js          # Auth & user management
│   │   ├── adminController.js         # Admin operations
│   │   ├── busController.js           # Bus management
│   │   ├── driverController.js        # Driver operations (SOS, services)
│   │   ├── studentController.js       # Student data & tracking
│   │   ├── studentAdminController.js  # Student admin ops
│   │   ├── routeController.js         # Route CRUD
│   │   ├── tripController.js          # Trip management
│   │   ├── stopController.js          # Stop management
│   │   ├── eventController.js         # Event logs
│   │   ├── locationController.js      # GPS & emergency handlers
│   │   └── notificationController.js  # Notification sending
│   │
│   ├── routes/                        # API Routes
│   │   ├── authRoutes.js              # /api/auth/*
│   │   ├── adminRoutes.js             # /api/admin/*
│   │   ├── busRoutes.js               # /api/buses/*
│   │   ├── driverRoutes.js            # /api/driver/*
│   │   ├── studentRoutes.js           # /api/student/*
│   │   ├── routeRoutes.js             # /api/routes/*
│   │   ├── tripRoutes.js              # /api/trips/*
│   │   ├── stopRoutes.js              # /api/stops/*
│   │   ├── eventRoutes.js             # /api/events/*
│   │   └── notificationRoutes.js      # /api/notifications/*
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js          # JWT verification
│   │   ├── roleMiddleware.js          # Role-based access control
│   │   └── validateMiddleware.js      # Input validation
│   │
│   ├── utils/
│   │   ├── emailService.js            # Email notifications
│   │   ├── etaCalculator.js           # ETA computation
│   │   ├── geoUtils.js                # Geospatial utilities
│   │   ├── logger.js                  # Logging utility
│   │   ├── notificationService.js     # Push notifications
│   │   └── segmentStats.js            # Route statistics
│   │
│   ├── inMemory/
│   │   └── activeTrips.js             # In-memory trip cache
│   │
│   └── scripts/
│       ├── seed.js                    # Database seeding
│       ├── cleanupLegacyAdmins.js    # Admin cleanup script
│       └── resetAdminFromEnv.js      # Reset admin from env vars
│
├── frontend/                          # React Web App
│   ├── index.html                     # HTML entry
│   ├── package.json                   # Frontend dependencies
│   ├── vite.config.js                 # Vite configuration
│   ├── tailwind.config.js             # Tailwind config
│   ├── postcss.config.js              # PostCSS config
│   ├── vercel.json                    # Frontend deployment
│   │
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json              # PWA manifest
│   │   ├── sw.js                      # Service worker
│   │   ├── _redirects                 # Vercel routing
│   │   ├── markers/                   # Map icons
│   │   ├── favicons/                  # Favicon assets
│   │   └── others/                    # Static assets
│   │
│   └── src/
│       ├── App.jsx                    # Root component
│       ├── main.jsx                   # Entry point
│       ├── index.css                  # Global styles
│       │
│       ├── components/                # Reusable Components
│       │   ├── AdminMap.jsx           # Fleet map for admin
│       │   ├── DriverMap.jsx          # Driver map view
│       │   ├── StudentMap.jsx         # Student tracking map
│       │   ├── MapEditor.jsx          # Route/stop editor
│       │   ├── MapView.jsx            # Generic map viewer
│       │   ├── TrackingControls.jsx   # Map controls
│       │   ├── BusCard.jsx            # Bus info display
│       │   ├── ConfirmDialog.jsx      # Confirmation modal
│       │   ├── Drawer.jsx             # Slide-out panel
│       │   ├── Navbar.jsx             # Top navigation
│       │   ├── NotificationToggle.jsx # Push notifications
│       │   ├── ProtectedRoute.jsx     # Route protection
│       │   ├── RaahiLoader.jsx        # Loading indicator
│       │   ├── Toast.jsx              # Toast notifications
│       │   └── ... (other components)
│       │
│       ├── pages/                     # Page Components
│       │   ├── AdminDashboard.jsx     # Admin control center
│       │   ├── DriverDashboard.jsx    # Driver interface + GPS + SOS
│       │   ├── DriverSimulator.jsx    # GPS simulator for testing
│       │   ├── StudentDashboard.jsx   # Student view
│       │   ├── Login.jsx              # Authentication
│       │   ├── ManageBuses.jsx        # CRUD buses
│       │   ├── ManageRoutes.jsx       # CRUD routes
│       │   ├── ManageStops.jsx        # CRUD stops
│       │   ├── ManageDrivers.jsx      # Driver management
│       │   ├── ManageStudents.jsx     # Student management
│       │   ├── AssignStudents.jsx     # Assign to buses
│       │   ├── ManageAttendanceQR.jsx # QR attendance
│       │   └── ... (other pages)
│       │
│       ├── context/
│       │   ├── AuthContext.jsx        # Auth state
│       │   └── ThemeContext.jsx       # Theme (light/dark)
│       │
│       ├── hooks/
│       │   ├── useAuth.js             # Auth hook
│       │   ├── useGeolocation.js      # GPS hook
│       │   └── useSocket.js           # Socket.io hook
│       │
│       ├── constants/
│       │   ├── api.js                 # API endpoints
│       │   └── geo.js                 # Geospatial constants
│       │
│       ├── utils/
│       │   └── api.js                 # Axios instance
│       │
│       └── styles/
│           └── ... (component styles)
│
└── mobile/                            # React Native App (Expo)
    ├── app.json                       # App config
    ├── package.json                   # Mobile dependencies
    ├── babel.config.js                # Babel config
    ├── index.js                       # Entry point
    │
    ├── src/
    │   ├── config.js                  # App configuration
    │   ├── screens/                   # Screen components
    │   ├── navigation/                # Navigation setup
    │   ├── components/                # Reusable components
    │   ├── context/                   # State management
    │   ├── services/                  # API services
    │   └── utils/                     # Utilities
    │
    └── README.md                      # Mobile-specific docs
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js** 16+ and npm 8+
- **MongoDB** instance (local or MongoDB Atlas)
- **Git**
- For mobile: Android Studio or Xcode

### Step 1: Clone Repository
```bash
git clone https://github.com/your-repo/raahi.git
cd raahi
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 3: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### Step 4: Install Mobile Dependencies (Optional)
```bash
cd ../mobile
npm install
# Install Expo globally
npm install -g expo-cli
```

### Step 5: Create Environment Files

**Backend `.env`:**
```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
DB_NAME=RaahiV1

# Authentication
JWT_SECRET=your_jwt_secret_key_here

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Admin Account (Initial Setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@raahi.local

# Email Service (Optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Web Push Notifications
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

**Frontend `.env`:**
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

**Mobile `.env`:**
```env
API_BASE_URL=http://your-backend-url/api
SOCKET_URL=http://your-backend-url
```

---

## ⚙️ Configuration

### MongoDB Setup

#### Option 1: MongoDB Atlas (Cloud)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free cluster
3. Create database user
4. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/`
5. Set as `MONGO_URI` in `.env`

#### Option 2: Local MongoDB
```bash
# Install MongoDB Community Edition
# macOS
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Connection string
mongodb://localhost:27017/RaahiV1
```

### JWT Configuration
```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Web Push Notifications
```bash
# Generate VAPID keys
npm install -g web-push
web-push generate-vapid-keys
```

---

## 📖 Usage Guide

### Starting Development Servers

**Backend Server:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Frontend Development Server:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

**Mobile Development:**
```bash
cd mobile
expo start
# Scan QR code with Expo Go app
```

### Initial Database Setup

**Seed Database:**
```bash
cd backend
npm run seed
```

**Reset Admin Account:**
```bash
npm run sync:admin-env
```

### Login Credentials (After Seed)

| Role | Username | Password | Email |
|------|----------|----------|-------|
| Admin | admin | admin123 | admin@raahi.local |
| Driver | driver1 | password123 | driver1@raahi.local |
| Student | student1 | password123 | student1@raahi.local |

---

## 🔌 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### 1. **Register User**
```
POST /auth/register
Content-Type: application/json

{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123",
  "role": "student"
}

Response: { token, user: { id, username, email, role } }
```

#### 2. **Login**
```
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

Response: { token, user: { id, username, email, role } }
```

### Driver Endpoints

#### 1. **Get Emergency Services**
```
GET /driver/emergency-services?lat=28.123&lng=77.456

Headers: Authorization: Bearer {token}

Response: {
  "services": [
    {
      "name": "Apollo Hospital",
      "type": "hospital",
      "phone": "+91-11-1234567",
      "distance": "0.5 km",
      "latitude": 28.125,
      "longitude": 77.458
    }
  ]
}
```

#### 2. **Start Trip**
```
POST /driver/start-trip
Content-Type: application/json
Headers: Authorization: Bearer {token}

{
  "routeId": "route_id",
  "busId": "bus_id"
}

Response: { tripId, trip: {...} }
```

#### 3. **Update Location**
```
Socket.io Event: 'driver:location_update'

Payload: {
  "tripId": "trip_id",
  "latitude": 28.123,
  "longitude": 77.456,
  "speed": 45.5,
  "accuracy": 10
}
```

#### 4. **Send SOS**
```
Socket.io Event: 'driver:sos'

Payload: {
  "tripId": "trip_id",
  "message": "Bus Breakdown",
  "location": { "lat": 28.123, "lng": 77.456 }
}
```

### Admin Endpoints

#### 1. **Get Dashboard Stats**
```
GET /admin/dashboard
Headers: Authorization: Bearer {token}

Response: {
  "busCount": 15,
  "driverCount": 15,
  "studentCount": 450,
  "activeTrips": 8
}
```

#### 2. **Get Active Trips**
```
GET /admin/trips
Headers: Authorization: Bearer {token}

Response: [
  {
    "_id": "trip_id",
    "bus": { "name": "Bus A1", "licensePlate": "ABC-123" },
    "driver": { "name": "John Doe" },
    "route": { "name": "Route 1" },
    "status": "active",
    "startTime": "2024-05-16T08:00:00Z"
  }
]
```

#### 3. **Get Events**
```
GET /admin/events
Headers: Authorization: Bearer {token}

Response: [
  {
    "_id": "event_id",
    "trip": "trip_id",
    "stop": { "name": "Stop 1" },
    "status": "ARRIVED",
    "timestamp": "2024-05-16T08:15:00Z"
  }
]
```

### Bus Endpoints

#### 1. **Create Bus**
```
POST /buses
Content-Type: application/json
Headers: Authorization: Bearer {token}

{
  "name": "Bus A1",
  "licensePlate": "ABC-123",
  "capacity": 45,
  "regNumber": "DL-01AB-0001",
  "model": "Tata Marcopolo"
}

Response: { _id, name, licensePlate, ... }
```

#### 2. **Get All Buses**
```
GET /buses
Headers: Authorization: Bearer {token}

Response: [ { _id, name, licensePlate, ... } ]
```

### Route Endpoints

#### 1. **Create Route**
```
POST /routes
Content-Type: application/json
Headers: Authorization: Bearer {token}

{
  "name": "Route 1",
  "startPoint": "School",
  "endPoint": "City Center",
  "stops": ["stop_id_1", "stop_id_2"]
}

Response: { _id, name, stops, ... }
```

#### 2. **Get Route with ETA**
```
GET /routes/:routeId
Headers: Authorization: Bearer {token}

Response: {
  "_id": "route_id",
  "name": "Route 1",
  "stops": [
    { "name": "Stop 1", "etaMinutes": 5 },
    { "name": "Stop 2", "etaMinutes": 15 }
  ]
}
```

### Student Endpoints

#### 1. **Get My Trips**
```
GET /student/my-trips
Headers: Authorization: Bearer {token}

Response: [
  {
    "busName": "Bus A1",
    "driverName": "John",
    "routeName": "Route 1",
    "status": "active",
    "location": { "lat": 28.123, "lng": 77.456 },
    "eta": 10
  }
]
```

---

## 🚨 Emergency Detection System

### Automatic Triggers

#### 1. **Sudden Speed Drop**
- **Detection:** GPS speed monitoring
- **Threshold:** Drop of ≥15 km/h OR hard stop from 35+ km/h to ≤3 km/h
- **Cooldown:** 2 minutes between triggers
- **Payload:**
  ```javascript
  {
    reason: "Sudden speed drop",
    previousSpeed: 45,
    currentSpeed: 10,
    timestamp: Date.now()
  }
  ```

#### 2. **Fall Detection**
- **Detection:** DeviceMotionEvent accelerometer
- **Threshold:** Acceleration magnitude ≥24 m/s²
- **Cooldown:** 2 minutes between triggers
- **Payload:**
  ```javascript
  {
    reason: "Fall detected",
    acceleration: 26.5,
    timestamp: Date.now()
  }
  ```

#### 3. **Microphone Noise Detection**
- **Detection:** Web Audio API RMS calculation
- **Threshold:** RMS level ≥50 dB
- **Cooldown:** 2 minutes between triggers
- **Requires:** User microphone permission
- **Payload:**
  ```javascript
  {
    reason: "Loud noise detected",
    audioLevel: 62,
    timestamp: Date.now()
  }
  ```

### Manual SOS

#### Trigger Flow
```
1. Driver clicks "SOS" button in emergency assist section
2. Modal appears with:
   - Pre-filled emergency reason (Speed drop/Fall/Sound detected)
   - Option to add custom message
   - "Call Nearby Services" button
3. Driver confirms SOS
4. System:
   - Fetches nearby hospitals/police/ambulances (2km radius)
   - Emits 'driver:sos' event to backend
   - Backend persists SOS event in database
   - Broadcasts to admin room
5. Admin receives:
   - Sticky banner alert at top
   - Trip details (bus, driver, route)
   - Location link to Google Maps
   - Acknowledge button
```

### Emergency Services Lookup

#### API Integration: OpenStreetMap Overpass API

**Query Types:**
- `amenity=hospital` (Hospitals)
- `amenity=police` (Police Stations)
- `amenity=ambulance_station` (Ambulance Services)

**Search Radius:** 2 km from incident location

**Response Data:**
- Name
- Phone number
- Opening hours
- Distance from incident
- Latitude/Longitude

**Example Request:**
```
GET /driver/emergency-services?lat=28.5355&lng=77.3910

Response:
{
  "services": [
    {
      "name": "AIIMS New Delhi",
      "type": "hospital",
      "phone": "+91-11-26589123",
      "distance": "0.8 km",
      "latitude": 28.5424,
      "longitude": 77.2064,
      "hours": "24/7"
    },
    {
      "name": "Police Station - Saket",
      "type": "police",
      "phone": "+91-11-41016666",
      "distance": "1.2 km",
      "latitude": 28.5244,
      "longitude": 77.1864
    }
  ]
}
```

### Admin Dashboard SOS Alerts

#### Sticky Banner Display
```
┌─────────────────────────────────────────────────────────────┐
│ 🚨 EMERGENCY SOS ALERT                                      │
│                                                              │
│ EMERGENCY ALERT: Bus Breakdown                             │
│ 🚌 Bus: Bus A1 • Plate: ABC-123                           │
│ 👨‍✈️ Driver: John Doe                                        │
│ 🛣️ Route: Route 1                                           │
│                                                              │
│ [Live Location] [Acknowledge] [×]                          │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Sticky at top of page
- Red gradient background for visibility
- Animated alert icon with pulsing effect
- Direct Google Maps link with coordinates
- Trip information auto-populated from database
- One-click acknowledge to dismiss
- Auto-display on new SOS event

---

## 🗄️ Database Schema

### User Schema
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String,
  password: String (hashed),
  role: String (enum: admin, driver, student, studentAdmin),
  name: String,
  phone: String,
  avatar: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Bus Schema
```javascript
{
  _id: ObjectId,
  name: String,
  licensePlate: String (unique),
  capacity: Number,
  regNumber: String,
  model: String,
  currentDriver: ObjectId (ref: User),
  currentRoute: ObjectId (ref: Route),
  status: String (enum: active, inactive, maintenance),
  createdAt: Date,
  updatedAt: Date
}
```

### Route Schema
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  stops: [ObjectId] (ref: Stop),
  startPoint: String,
  endPoint: String,
  totalDistance: Number,
  estimatedDuration: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Stop Schema
```javascript
{
  _id: ObjectId,
  name: String,
  address: String,
  latitude: Number,
  longitude: Number,
  sequence: Number,
  arrivalWindow: { start: Time, end: Time },
  createdAt: Date,
  updatedAt: Date
}
```

### Trip Schema
```javascript
{
  _id: ObjectId,
  bus: ObjectId (ref: Bus),
  driver: ObjectId (ref: User),
  route: ObjectId (ref: Route),
  status: String (enum: scheduled, active, completed),
  startTime: Date,
  endTime: Date,
  currentLocation: { type: Point, coordinates: [lng, lat] },
  currentSpeed: Number,
  events: [ObjectId] (ref: StopEvent),
  createdAt: Date,
  updatedAt: Date
}
```

### StopEvent Schema
```javascript
{
  _id: ObjectId,
  trip: ObjectId (ref: Trip),
  stop: ObjectId (ref: Stop),
  stopIndex: Number,
  stopName: String,
  status: String (enum: DEPARTED, ARRIVED, SOS),
  message: String,
  location: { type: Point, coordinates: [lng, lat] },
  timestamp: Date,
  source: String (enum: auto, manual),
  createdAt: Date
}
```

### StudentAssignment Schema
```javascript
{
  _id: ObjectId,
  student: ObjectId (ref: User),
  bus: ObjectId (ref: Bus),
  route: ObjectId (ref: Route),
  boardingStop: ObjectId (ref: Stop),
  alightingStop: ObjectId (ref: Stop),
  status: String (enum: active, inactive),
  createdAt: Date,
  updatedAt: Date
}
```

### Attendance Schema
```javascript
{
  _id: ObjectId,
  student: ObjectId (ref: User),
  trip: ObjectId (ref: Trip),
  boardingTime: Date,
  alightingTime: Date,
  status: String (enum: present, absent, marked-present),
  qrCode: String,
  createdAt: Date
}
```

---

## 🌐 Deployment

### Backend Deployment (Vercel)

1. **Connect Repository to Vercel**
   ```bash
   npm install -g vercel
   vercel link
   ```

2. **Create `backend/vercel.json`:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "server.js"
       }
     ],
     "env": {
       "MONGO_URI": "@mongo_uri",
       "DB_NAME": "RaahiV1",
       "JWT_SECRET": "@jwt_secret",
       "NODE_ENV": "production"
     }
   }
   ```

3. **Add Environment Variables in Vercel Dashboard**
   - `MONGO_URI`
   - `JWT_SECRET`
   - `DB_NAME`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`

4. **Deploy:**
   ```bash
   cd backend
   vercel --prod
   ```

### Frontend Deployment (Vercel)

1. **Create `frontend/vercel.json`:**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist"
   }
   ```

2. **Add Environment Variables:**
   - `VITE_API_BASE_URL=https://your-backend.vercel.app/api`
   - `VITE_SOCKET_URL=https://your-backend.vercel.app`

3. **Deploy:**
   ```bash
   cd frontend
   vercel --prod
   ```

### Mobile Deployment (Expo)

1. **Build APK (Android):**
   ```bash
   cd mobile
   eas build --platform android
   ```

2. **Build IPA (iOS):**
   ```bash
   eas build --platform ios
   ```

3. **Submit to App Stores:**
   - Google Play Store: https://play.google.com/console
   - Apple App Store: https://appstoreconnect.apple.com

---

## 🐛 Troubleshooting

### Common Issues

#### 1. **MongoDB Connection Failed**
```
Error: MongoDB connection error
```
**Solution:**
- Verify `MONGO_URI` in `.env`
- Check MongoDB is running (if local)
- Verify IP whitelist on MongoDB Atlas
- Test connection: `mongo "mongodb+srv://..."`

#### 2. **Socket.io Not Connecting**
```
Error: Socket connection failed
```
**Solution:**
- Check `ALLOWED_ORIGINS` in `.env`
- Verify backend server is running
- Check firewall/CORS settings
- Verify Socket.io version compatibility

#### 3. **GPS Location Not Updating**
```
Error: Location updates not showing on dashboard
```
**Solution:**
- Check browser location permissions
- Verify GPS is enabled on device
- Check Socket.io connection
- Monitor Network tab in DevTools

#### 4. **Emergency Detection Not Triggering**
```
Error: SOS triggers not working
```
**Solution:**
- Verify accelerometer permissions (DeviceMotionEvent)
- Check microphone permissions for audio detection
- Verify browser supports necessary APIs
- Check cooldown timer (2 min between triggers)

#### 5. **Authentication Failed**
```
Error: Invalid credentials or token expired
```
**Solution:**
- Clear localStorage: `localStorage.clear()`
- Re-login with correct credentials
- Check JWT_SECRET consistency
- Verify token hasn't expired (24 hours)

#### 6. **Map Not Displaying**
```
Error: Leaflet map not rendering
```
**Solution:**
- Verify Leaflet CSS is loaded
- Check console for tile layer errors
- Verify coordinates are valid (lat: -90 to 90, lng: -180 to 180)
- Check internet connection for tile loading

### Debug Mode

**Backend:**
```bash
# Enable detailed logging
DEBUG=* npm run dev
```

**Frontend:**
```javascript
// In console
localStorage.debug = '*'
```

**Socket.io Debug:**
```javascript
import io from 'socket.io-client';
const socket = io('http://localhost:5000', {
  debug: true,
  reconnection: true
});
```

---

## 🤝 Contributing

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make Changes**
   - Follow existing code style
   - Add comments for complex logic
   - Test thoroughly

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add my feature"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/my-feature
   ```

### Code Style

- **Backend:** ES6+ with camelCase naming
- **Frontend:** React hooks, functional components
- **Mobile:** React Native conventions
- **Database:** Mongoose ODM patterns

### Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

---

## 📝 License

This project is proprietary and confidential. All rights reserved.

---

## 📞 Support

For issues and support:
- Create an issue on GitHub
- Contact: support@raahi.local
- Email: admin@raahi.local

---

## 🎉 Acknowledgments

Built with ❤️ using:
- Express.js & Node.js
- React & Vite
- MongoDB & Mongoose
- Socket.io & Real-time Web
- Leaflet Maps & OpenStreetMap
- Tailwind CSS & Lucide Icons

---

**Last Updated:** May 16, 2026

**Version:** 1.0.0

**Status:** ✅ Production Ready
