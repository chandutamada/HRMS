# HRMS Employee Location & Route Tracking Service (Spring Boot)

High-performance, secure Spring Boot 3 Java backend service for real-time employee geolocation ingestion, field duty session synchronization, and GPS route persistence in the HRMS platform.

---

## 🌟 Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | **Spring Boot 3.3.4 & Java 21** | REST API, Dependency Injection, Validation |
| **Data Persistence** | **Spring Data JPA & Hibernate 6** | Entity persistence mapping to `tracking_sessions`, `route_points`, `checkpoints` |
| **Database** | **MySQL 8.4 LTS / H2 (Testing)** | Production relational storage with camelCase mapping |
| **Security** | **Spring Security 6 & JJWT 0.12.5** | Stateless Bearer JWT authentication linked to user & employee ID |
| **Geofencing Engine** | **Haversine Geodesic Math** | 50m office radius evaluation & Asia/Kolkata (09:00 - 17:30 IST) office shift compliance |

---

## 🏗️ Architecture & Entities

### 1. Data Entities (`com.hrms.tracking.entity`)

* **`TrackingSession.java`**: Represents a continuous on-duty field session.
  * Fields: `id`, `userId`, `employeeId`, `companyId`, `startTime`, `endTime`, `distanceKm`, `areaName`, `state`, `isOfficeHours`, `createdAt`, `updatedAt`
  * Relationships: 1-to-Many with `RoutePoint` and `Checkpoint`.
* **`RoutePoint.java`**: Granular GPS coordinates recorded during travel.
  * Fields: `id`, `sessionId`, `latitude`, `longitude`, `altitude`, `speed`, `accuracy`, `timestamp`
* **`Checkpoint.java`**: Auto-detected stationary dwell stops or manually tagged field milestones.
  * Fields: `id`, `sessionId`, `latitude`, `longitude`, `arrivedAt`, `departedAt`, `pointIndex`, `notes`

### 2. Security & JWT Filter (`com.hrms.tracking.security`)

* **`JwtAuthenticationFilter.java`**: Intercepts requests with `Authorization: Bearer <token>`, validates token HMAC-SHA256 signature using `JWT_SECRET`, and extracts employee identity into `SecurityContextHolder`.
* **`SecurityConfig.java`**: Enforces stateless session policy, enables CORS for Flutter mobile (`10.0.2.2`, `localhost`) and Next.js web dashboard (`http://localhost:3000`).

---

## 📡 REST API Endpoints

### 1. Synchronize Field Session (Batch Coordinates & Milestones)
* **Method & Path**: `POST /api/tracking/sessions/sync`
* **Authorization**: `Bearer <JWT_TOKEN>`
* **Request Body (`SessionSyncRequest`)**:
```json
{
  "id": "session_1729661234567",
  "startTime": 1729661200000,
  "endTime": 1729664800000,
  "distanceKm": 4.85,
  "areaName": "Electronic City Phase 1",
  "state": "Karnataka",
  "routePoints": [
    {
      "lat": 13.04983,
      "lng": 77.62024,
      "alt": 920.5,
      "speed": 18.5,
      "accuracy": 4.2,
      "heading": 85.0,
      "ts": 1729661200000
    }
  ],
  "checkpoints": [
    {
      "lat": 13.05120,
      "lng": 77.62150,
      "arrivedAt": 1729662000000,
      "departedAt": 1729663200000,
      "index": 1,
      "notes": "Client Site Alpha Inspection"
    }
  ]
}
```
* **Response Body (`SessionSyncResponse`)**:
```json
{
  "success": true,
  "sessionId": "session_1729661234567",
  "distanceKm": 4.85,
  "isOfficeHours": true,
  "routePointsCount": 1,
  "checkpointsCount": 1,
  "message": "Session successfully synchronized with HR persistent route storage"
}
```

### 2. Live GPS Telemetry Ping
* **Method & Path**: `POST /api/tracking/live`
* **Authorization**: `Bearer <JWT_TOKEN>`
* **Request Body (`LivePingRequest`)**:
```json
{
  "latitude": 13.04983,
  "longitude": 77.62024,
  "accuracy": 5.0,
  "altitude": 920.0,
  "speed": 0.0,
  "heading": 0.0,
  "isMoving": false
}
```
* **Response Body (`LivePingResponse`)**:
```json
{
  "success": true,
  "meta": {
    "isWithinOfficeHours": true,
    "isWithinGeofence": true,
    "distanceToOfficeMeters": 0.0,
    "officeName": "Superbee Aeronautics HQ"
  },
  "message": "Live location ping accepted"
}
```

### 3. Retrieve Session History
* **Method & Path**: `GET /api/tracking/sessions`
* **Authorization**: `Bearer <JWT_TOKEN>`
* **Query Params**: `userId` (optional, for HR admins)

### 4. Retrieve Full Route Session Detail
* **Method & Path**: `GET /api/tracking/sessions/{id}`
* **Authorization**: `Bearer <JWT_TOKEN>`

### 5. Health Check
* **Method & Path**: `GET /api/tracking/health`
* **Authorization**: Public

---

## 🚀 Running the Service

### Prerequisites
* **Java 21 JDK** (e.g. bundled OpenJDK 21 or Eclipse Temurin)
* **MySQL 8.4 LTS** running on port `3306` with database `hrms_db`

### Launch with Maven
```bash
cd apps/tracking-service
mvn spring-boot:run
```

*Default Server Port*: `8080` (or configured via environment variable `PORT=8080`)
