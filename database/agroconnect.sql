CREATE DATABASE IF NOT EXISTS AgroConnect;
USE AgroConnect;

DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('farmer', 'distributor', 'admin') NOT NULL DEFAULT 'farmer',
  address VARCHAR(255),
  district VARCHAR(100),
  state VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id INT NOT NULL,
  crop_name VARCHAR(120) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'kg',
  price_per_unit DECIMAL(10,2) NOT NULL,
  description TEXT,
  location VARCHAR(150),
  image_url VARCHAR(255),
  status ENUM('available', 'sold') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  farmer_id INT NOT NULL,
  distributor_id INT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  message TEXT,
  status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (distributor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password for admin is: admin123
-- Demo passwords are stored as plain text only for initial seed. On first login backend upgrades them to bcrypt hash.
INSERT INTO users (name, email, phone, password, role, address, district, state)
VALUES (
  'System Admin',
  'admin@agroconnect.com',
  '9999999999',
  'admin123',
  'admin',
  'Admin Office',
  'Patna',
  'Bihar'
);

-- Demo Farmer password: farmer123
INSERT INTO users (name, email, phone, password, role, address, district, state)
VALUES (
  'Ramesh Farmer',
  'farmer@test.com',
  '9876543210',
  'farmer123',
  'farmer',
  'Village Road',
  'Patna',
  'Bihar'
);

-- Demo Distributor password: distributor123
INSERT INTO users (name, email, phone, password, role, address, district, state)
VALUES (
  'Fresh Mart Distributor',
  'distributor@test.com',
  '9123456780',
  'distributor123',
  'distributor',
  'Market Area',
  'Patna',
  'Bihar'
);

INSERT INTO products (farmer_id, crop_name, category, quantity, unit, price_per_unit, description, location, image_url)
VALUES
(2, 'Wheat', 'Grains', 500, 'kg', 28, 'Fresh wheat available directly from farm.', 'Patna, Bihar', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b'),
(2, 'Potato', 'Vegetables', 300, 'kg', 18, 'Good quality potato available for bulk purchase.', 'Patna, Bihar', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655'),
(2, 'Tomato', 'Vegetables', 120, 'kg', 25, 'Fresh tomatoes from local farm.', 'Patna, Bihar', 'https://images.unsplash.com/photo-1546470427-e26264be0b0d');
