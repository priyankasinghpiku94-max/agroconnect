-- Run this file once after phase1_migration.sql.
USE AgroConnect;

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

ALTER TABLE orders
  ADD COLUMN demandId INT NULL AFTER status,
  ADD COLUMN quotationId INT NULL AFTER demandId,
  ADD COLUMN agreedPrice DECIMAL(12,2) UNSIGNED NULL AFTER quotationId,
  ADD UNIQUE KEY uq_orders_quotation (quotationId),
  ADD CONSTRAINT fk_orders_demand
    FOREIGN KEY (demandId) REFERENCES demands(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_orders_quotation
    FOREIGN KEY (quotationId) REFERENCES quotations(id) ON DELETE SET NULL;

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

INSERT INTO demands
(
  distributorId, cropName, category, quantity, unit, targetPrice,
  qualityGrade, deliveryCity, deliveryState, neededBy, description, status
)
SELECT
  id, 'Wheat', 'Grains', 200, 'kg', 27, 'A', city, state,
  DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),
  'Sample Phase 2 wholesale demand.', 'open'
FROM users
WHERE role = 'distributor' AND verificationStatus = 'verified'
ORDER BY id
LIMIT 1;
