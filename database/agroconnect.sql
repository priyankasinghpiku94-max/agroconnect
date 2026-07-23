CREATE DATABASE IF NOT EXISTS AgroConnect
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
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
  businessName VARCHAR(150),
  businessType VARCHAR(100),
  verificationStatus ENUM('unsubmitted', 'pending', 'verified', 'rejected')
    NOT NULL DEFAULT 'unsubmitted',
  verificationNote VARCHAR(500),
  kycDocumentType ENUM(
    'aadhaar',
    'pan',
    'farmer_id',
    'gst',
    'business_registration'
  ),
  kycDocumentPath VARCHAR(255),
  verifiedAt DATETIME,
  verifiedBy INT,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_status (role, verificationStatus, isActive),
  CONSTRAINT fk_users_verified_by
    FOREIGN KEY (verifiedBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  farmerId INT NOT NULL,
  productName VARCHAR(120) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(12,2) UNSIGNED NOT NULL,
  unit ENUM('kg', 'quintal', 'ton', 'box', 'piece') NOT NULL DEFAULT 'kg',
  price DECIMAL(12,2) UNSIGNED NOT NULL,
  minOrderQuantity DECIMAL(12,2) UNSIGNED NOT NULL DEFAULT 1,
  qualityGrade ENUM('A', 'B', 'C', 'Standard') NOT NULL DEFAULT 'Standard',
  harvestDate DATE,
  description TEXT,
  image VARCHAR(500),
  imagePublicId VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  status ENUM('available', 'out_of_stock', 'paused', 'sold')
    NOT NULL DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_marketplace (status, category, city, state),
  INDEX idx_products_farmer (farmerId),
  CONSTRAINT fk_products_farmer
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE demands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  distributorId INT NOT NULL,
  cropName VARCHAR(120) NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity DECIMAL(12,2) UNSIGNED NOT NULL,
  unit ENUM('kg', 'quintal', 'ton', 'box', 'piece') NOT NULL,
  targetPrice DECIMAL(12,2) UNSIGNED,
  qualityGrade ENUM('Any', 'A', 'B', 'C', 'Standard') NOT NULL DEFAULT 'Any',
  deliveryCity VARCHAR(100) NOT NULL,
  deliveryState VARCHAR(100) NOT NULL,
  neededBy DATE NOT NULL,
  description TEXT,
  status ENUM('open', 'awarded', 'closed', 'expired') NOT NULL DEFAULT 'open',
  awardedQuotationId INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_demands_board (status, category, deliveryCity, deliveryState, neededBy),
  INDEX idx_demands_distributor (distributorId, status),
  CONSTRAINT fk_demands_distributor
    FOREIGN KEY (distributorId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  demandId INT NOT NULL,
  productId INT NOT NULL,
  farmerId INT NOT NULL,
  distributorId INT NOT NULL,
  quantity DECIMAL(12,2) UNSIGNED NOT NULL,
  unitPrice DECIMAL(12,2) UNSIGNED NOT NULL,
  message VARCHAR(1000),
  status ENUM('submitted', 'countered', 'accepted', 'rejected', 'withdrawn')
    NOT NULL DEFAULT 'submitted',
  currentOfferBy ENUM('farmer', 'distributor') NOT NULL DEFAULT 'farmer',
  acceptedAt DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_demand_farmer (demandId, farmerId),
  INDEX idx_quotations_farmer (farmerId, status),
  INDEX idx_quotations_distributor (distributorId, status),
  CONSTRAINT fk_quotations_demand
    FOREIGN KEY (demandId) REFERENCES demands(id) ON DELETE CASCADE,
  CONSTRAINT fk_quotations_product
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_quotations_farmer
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_quotations_distributor
    FOREIGN KEY (distributorId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE quotation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quotationId INT NOT NULL,
  actorId INT NOT NULL,
  action ENUM('submitted', 'countered', 'accepted', 'rejected', 'withdrawn')
    NOT NULL,
  quantity DECIMAL(12,2) UNSIGNED,
  unitPrice DECIMAL(12,2) UNSIGNED,
  message VARCHAR(1000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_quote_history (quotationId, id),
  CONSTRAINT fk_quote_history_quotation
    FOREIGN KEY (quotationId) REFERENCES quotations(id) ON DELETE CASCADE,
  CONSTRAINT fk_quote_history_actor
    FOREIGN KEY (actorId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  productId INT NOT NULL,
  farmerId INT NOT NULL,
  distributorId INT NOT NULL,
  quantity DECIMAL(12,2) UNSIGNED NOT NULL,
  message TEXT,
  status ENUM('pending', 'accepted', 'rejected', 'completed')
    NOT NULL DEFAULT 'pending',
  demandId INT,
  quotationId INT,
  agreedPrice DECIMAL(12,2) UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_quotation (quotationId),
  INDEX idx_orders_farmer (farmerId, status),
  INDEX idx_orders_distributor (distributorId, status),
  CONSTRAINT fk_orders_product
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_farmer
    FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_distributor
    FOREIGN KEY (distributorId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_demand
    FOREIGN KEY (demandId) REFERENCES demands(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_quotation
    FOREIGN KEY (quotationId) REFERENCES quotations(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message VARCHAR(500) NOT NULL,
  relatedType VARCHAR(30),
  relatedId INT,
  isRead TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (userId, isRead, id),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users
(
  fullName, email, phoneNumber, password, role, city, state, address,
  businessName, businessType, verificationStatus, verifiedAt, isActive
)
VALUES
(
  'System Admin', 'admin@agroconnect.com', '9999999999',
  '$2a$10$scKYCtf1yOU12yUaDflQmO2.S.oJlqrR7ZxUhC7iKbDs2e2j84EYW',
  'admin', 'Patna', 'Bihar', 'Admin Office', 'AgroConnect', 'Platform',
  'verified', CURRENT_TIMESTAMP, 1
),
(
  'Ramesh Farmer', 'farmer@test.com', '9876543210',
  '$2a$10$GYQS7cvyBWeabOMCAeRcjOD3a8bakWML6vfoIzViDiadZfuMtQBdO',
  'farmer', 'Patna', 'Bihar', 'Village Road', 'Ramesh Farms',
  'Individual Farmer', 'verified', CURRENT_TIMESTAMP, 1
),
(
  'Fresh Mart Distributor', 'distributor@test.com', '9123456780',
  '$2a$10$IKoNlkqrgdYCwnURqyLMMOddPzmcEIZGTLFSftLok.NGziK8OocQa',
  'distributor', 'Patna', 'Bihar', 'Market Area', 'Fresh Mart',
  'Wholesaler', 'verified', CURRENT_TIMESTAMP, 1
);

INSERT INTO products
(
  farmerId, productName, category, quantity, unit, price,
  minOrderQuantity, qualityGrade, harvestDate, description,
  image, imagePublicId, city, state, status
)
VALUES
(
  2, 'Wheat', 'Grains', 500, 'kg', 28, 25, 'A', CURRENT_DATE,
  'Fresh wheat available directly from farm.',
  'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b',
  NULL, 'Patna', 'Bihar', 'available'
),
(
  2, 'Organic Potato', 'Vegetables', 300, 'kg', 18, 20, 'A', CURRENT_DATE,
  'Good quality potato available for bulk purchase.',
  'https://images.unsplash.com/photo-1518977676601-b53f82aba655',
  NULL, 'Patna', 'Bihar', 'available'
),
(
  2, 'Fresh Tomato', 'Vegetables', 120, 'kg', 25, 10, 'Standard', CURRENT_DATE,
  'Fresh tomatoes from local farm.',
  'https://images.unsplash.com/photo-1546470427-e26264be0b0d',
  NULL, 'Patna', 'Bihar', 'available'
);

INSERT INTO demands
(
  distributorId, cropName, category, quantity, unit, targetPrice,
  qualityGrade, deliveryCity, deliveryState, neededBy, description, status
)
VALUES
(
  3, 'Wheat', 'Grains', 200, 'kg', 27, 'A', 'Patna', 'Bihar',
  DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),
  'Regular wholesale supply required with clean packaging.', 'open'
);

INSERT INTO orders
(productId, farmerId, distributorId, quantity, message, status)
VALUES
(1, 2, 3, 50, 'I want to buy 50 kg wheat.', 'pending');
