CREATE DATABASE IF NOT EXISTS AgroConnect;
USE AgroConnect;


CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fullName VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phoneNumber VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('farmer', 'distributor', 'admin') NOT NULL DEFAULT 'farmer',
  city VARCHAR(100),
  state VARCHAR(100),
  address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  farmerId INT NOT NULL,
  productName VARCHAR(120) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'kg',
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  image VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  status ENUM('available', 'sold') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  productId INT NOT NULL,
  farmerId INT NOT NULL,
  distributorId INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  message TEXT,
  status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (distributorId) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users 
(fullName, email, phoneNumber, password, role, city, state, address)
VALUES
(
  'System Admin',
  'admin@agroconnect.com',
  '9999999999',
  '$2a$10$scKYCtf1yOU12yUaDflQmO2.S.oJlqrR7ZxUhC7iKbDs2e2j84EYW',
  'admin',
  'Patna',
  'Bihar',
  'Admin Office'
),
(
  'Ramesh Farmer',
  'farmer@test.com',
  '9876543210',
  '$2a$10$GYQS7cvyBWeabOMCAeRcjOD3a8bakWML6vfoIzViDiadZfuMtQBdO',
  'farmer',
  'Patna',
  'Bihar',
  'Village Road'
),
(
  'Fresh Mart Distributor',
  'distributor@test.com',
  '9123456780',
  '$2a$10$IKoNlkqrgdYCwnURqyLMMOddPzmcEIZGTLFSftLok.NGziK8OocQa',
  'distributor',
  'Patna',
  'Bihar',
  'Market Area'
);

INSERT INTO products
(farmerId, productName, category, quantity, unit, price, description, image, city, state, status)
VALUES
(
  2,
  'Wheat',
  'Grains',
  500,
  'kg',
  28,
  'Fresh wheat available directly from farm.',
  'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b',
  'Patna',
  'Bihar',
  'available'
),
(
  2,
  'Organic Potato',
  'Vegetables',
  300,
  'kg',
  18,
  'Good quality potato available for bulk purchase.',
  'https://images.unsplash.com/photo-1518977676601-b53f82aba655',
  'Patna',
  'Bihar',
  'available'
),
(
  2,
  'Fresh Tomato',
  'Vegetables',
  120,
  'kg',
  25,
  'Fresh tomatoes from local farm.',
  'https://images.unsplash.com/photo-1546470427-e26264be0b0d',
  'Patna',
  'Bihar',
  'available'
);

INSERT INTO orders
(productId, farmerId, distributorId, quantity, message, status)
VALUES
(
  1,
  2,
  3,
  50,
  'I want to buy 50 kg wheat.',
  'pending'
);