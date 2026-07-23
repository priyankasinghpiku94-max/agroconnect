-- Run this file once only when upgrading an existing AgroConnect database.
USE AgroConnect;

ALTER TABLE users
  ADD COLUMN businessName VARCHAR(150) NULL AFTER address,
  ADD COLUMN businessType VARCHAR(100) NULL AFTER businessName,
  ADD COLUMN verificationStatus
    ENUM('unsubmitted', 'pending', 'verified', 'rejected')
    NOT NULL DEFAULT 'unsubmitted' AFTER businessType,
  ADD COLUMN verificationNote VARCHAR(500) NULL AFTER verificationStatus,
  ADD COLUMN kycDocumentType
    ENUM('aadhaar', 'pan', 'farmer_id', 'gst', 'business_registration')
    NULL AFTER verificationNote,
  ADD COLUMN kycDocumentPath VARCHAR(255) NULL AFTER kycDocumentType,
  ADD COLUMN verifiedAt DATETIME NULL AFTER kycDocumentPath,
  ADD COLUMN verifiedBy INT NULL AFTER verifiedAt,
  ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER verifiedBy,
  ADD COLUMN updated_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD INDEX idx_users_role_status (role, verificationStatus, isActive);

ALTER TABLE products
  MODIFY COLUMN quantity DECIMAL(12,2) UNSIGNED NOT NULL,
  MODIFY COLUMN price DECIMAL(12,2) UNSIGNED NOT NULL,
  MODIFY COLUMN image VARCHAR(500) NULL,
  MODIFY COLUMN status
    ENUM('available', 'out_of_stock', 'paused', 'sold')
    NOT NULL DEFAULT 'available',
  ADD COLUMN minOrderQuantity DECIMAL(12,2) UNSIGNED
    NOT NULL DEFAULT 1 AFTER price,
  ADD COLUMN qualityGrade ENUM('A', 'B', 'C', 'Standard')
    NOT NULL DEFAULT 'Standard' AFTER minOrderQuantity,
  ADD COLUMN harvestDate DATE NULL AFTER qualityGrade,
  ADD COLUMN imagePublicId VARCHAR(255) NULL AFTER image,
  ADD COLUMN updated_at TIMESTAMP
    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD INDEX idx_products_marketplace (status, category, city, state);

ALTER TABLE orders
  MODIFY COLUMN quantity DECIMAL(12,2) UNSIGNED NOT NULL,
  ADD INDEX idx_orders_farmer (farmerId, status),
  ADD INDEX idx_orders_distributor (distributorId, status);

-- Keep the original demo accounts usable after the migration.
UPDATE users
SET
  verificationStatus = 'verified',
  verifiedAt = CURRENT_TIMESTAMP,
  businessName = CASE
    WHEN role = 'farmer' THEN 'Demo Farm'
    WHEN role = 'distributor' THEN 'Demo Distribution Business'
    ELSE 'AgroConnect'
  END,
  businessType = CASE
    WHEN role = 'farmer' THEN 'Individual Farmer'
    WHEN role = 'distributor' THEN 'Wholesaler'
    ELSE 'Platform'
  END
WHERE email IN (
  'admin@agroconnect.com',
  'farmer@test.com',
  'distributor@test.com'
);
