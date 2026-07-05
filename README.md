# AgroConnect - Farmers and Distributors Connect System

AgroConnect is a full-stack MCA project that connects farmers directly with distributors. Farmers can add crop/product listings, distributors can search crops and place orders, and admins can manage users, products, and orders.

## Tech Stack

- Frontend: React.js + Vite
- Backend: Node.js + Express.js
- Database: MySQL
- Authentication: JWT + bcrypt
- Styling: Custom CSS

## Main Modules

1. Farmer Registration/Login
2. Distributor Registration/Login
3. Admin Login
4. Farmer Product/Crop Management
5. Distributor Marketplace Search
6. Order/Inquiry Management
7. Admin Dashboard
8. Role Based Authentication

## Folder Structure

```txt
agroconnect-mca-project/
├── backend/
├── frontend/
└── database/
```

## How to Run

### 1. Create Database

Open MySQL and run:

```sql
CREATE DATABASE agroconnect_db;
USE agroconnect_db;
SOURCE database/agroconnect.sql;
```

Or import `database/agroconnect.sql` from phpMyAdmin.

### 2. Backend Setup

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Backend will run on:

```txt
http://localhost:8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on:

```txt
http://localhost:5173
```

## Default Admin Login

```txt
Email: admin@agroconnect.com
Password: admin123
```

## API Base URL

```txt
http://localhost:8000/api
```

## Project Title for MCA Report

**AgroConnect: A Web Based Platform to Connect Farmers and Distributors**
