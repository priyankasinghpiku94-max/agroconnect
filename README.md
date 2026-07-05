# AgroConnect - Farmer Distributor Connect System

## Project Description

AgroConnect is a web-based platform developed for connecting farmers directly with distributors. The main objective of this project is to reduce the gap between farmers and buyers by providing a digital marketplace where farmers can upload their agricultural products and distributors can view available products and place orders.

This system helps farmers sell their crops without depending completely on middlemen. Distributors can easily search products, check quantity, price, and location, and place orders directly through the platform.

AgroConnect is developed as an MCA final-year project using React.js, Node.js, Express.js, and MySQL.

## Technology Used

### Frontend

* React.js
* Vite
* HTML5
* CSS3
* JavaScript
* Axios
* React Router DOM

### Backend

* Node.js
* Express.js
* JWT Authentication
* bcrypt.js
* CORS
* dotenv

### Database

* MySQL

### Tools

* Visual Studio Code
* Git
* GitHub
* MySQL / XAMPP
* Postman

## Features

* User registration
* User login
* Role-based authentication
* Farmer dashboard
* Distributor dashboard
* Admin dashboard
* Farmer can add agricultural products
* Farmer can view and manage products
* Distributor can view available products
* Distributor can place product orders
* Order management system
* Admin can view users, products, and orders
* Secure password storage using bcrypt
* JWT-based authentication
* MySQL database integration

## User Roles

### 1. Farmer

* Register and login
* Add products
* View own products
* View received orders

### 2. Distributor

* Register and login
* View marketplace products
* Place orders for products
* View order status

### 3. Admin

* Login as admin
* View all users
* View all products
* View all orders
* Manage platform data

## Database Setup

1. Open MySQL or phpMyAdmin.
2. Create a database using the given SQL file.
3. Import the `agroconnect.sql` file.
4. Make sure the database name is:

```sql
AgroConnect
```

5. Check that the following tables are created:

```text
users
products
orders
```

6. Update backend `.env` file with your database details:

```env
PORT=8000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=AgroConnect
DB_PORT=3306
JWT_SECRET=change_this_secret_key
CLIENT_URL=http://localhost:5173
```

## Backend Run Command

Go to backend folder:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Run backend server:

```bash
npm run dev
```

Or:

```bash
node server.js
```

Backend will run on:

```text
http://localhost:8000
```

## Frontend Run Command

Go to frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run frontend:

```bash
npm run dev
```

Frontend will run on:

```text
http://localhost:5173
```

## Default Login Credentials

### Admin Login

```text
Email: admin@agroconnect.com
Password: admin123
```

### Farmer Login

```text
Email: farmer@test.com
Password: farmer123
```

### Distributor Login

```text
Email: distributor@test.com
Password: distributor123
```

## Screenshots

Add project screenshots in this section before final submission.

Recommended screenshots:

```text
1. Home Page
2. Register Page
3. Login Page
4. Farmer Dashboard
5. Add Product Page
6. Product List Page
7. Distributor Marketplace
8. Order Page
9. Admin Dashboard
10. Database Tables
```

## Project Modules

### Authentication Module

This module handles user registration, login, password encryption, and JWT token-based authentication.

### Farmer Module

This module allows farmers to add products, manage their products, and view orders placed by distributors.

### Distributor Module

This module allows distributors to view available agricultural products and place orders.

### Admin Module

This module allows the admin to monitor users, products, and orders.

### Product Module

This module manages product details such as product name, category, quantity, price, image, city, and state.

### Order Module

This module manages product orders placed by distributors.

## Future Scope

* Online payment integration
* Real-time chat between farmer and distributor
* Delivery tracking system
* Invoice generation
* Crop price prediction
* Weather-based crop suggestion
* Mobile application
* SMS and email notification

## Conclusion

AgroConnect provides a digital solution for connecting farmers and distributors. It helps farmers sell their products directly and allows distributors to find agricultural products easily. The project is useful, practical, and suitable for MCA final-year academic submission.
