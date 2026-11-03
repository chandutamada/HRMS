-- ==============================================================================
-- GTIDS & GTIB Multi-Company Seeding SQL Script
-- Gram Tarang Inclusive Development Services Pvt. Ltd. &
-- Gram Tarang Insurance and Brokering Pvt. Ltd.
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Insert GTIDS Company
INSERT INTO `companies` (`id`, `code`, `name`, `legalName`, `email`, `phone`, `website`, `address`, `status`, `createdAt`, `updatedAt`)
VALUES (
    'gtids-company-uuid-001',
    'GTIDS',
    'Gram Tarang Inclusive Development Services Private Limited',
    'Gram Tarang Inclusive Development Services Private Limited',
    'hr@gtids.in',
    '+91 891 234 5679',
    'https://gramtarang.org/',
    'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, Andhra Pradesh 535003',
    'ACTIVE',
    NOW(3),
    NOW(3)
)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `legalName` = VALUES(`legalName`), `updatedAt` = NOW(3);

-- 2. Insert GTIB Company
INSERT INTO `companies` (`id`, `code`, `name`, `legalName`, `email`, `phone`, `website`, `address`, `status`, `createdAt`, `updatedAt`)
VALUES (
    'gtib-company-uuid-002',
    'GTIB',
    'Gram Tarang Insurance and Brokering Private Limited',
    'Gram Tarang Insurance and Brokering Private Limited',
    'hr@gtib.in',
    '+91 891 234 5680',
    'https://gramtarang.org/',
    'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, Andhra Pradesh 535003',
    'ACTIVE',
    NOW(3),
    NOW(3)
)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `legalName` = VALUES(`legalName`), `updatedAt` = NOW(3);

-- 3. Office Locations
INSERT INTO `office_locations` (`id`, `companyId`, `name`, `code`, `address`, `latitude`, `longitude`, `radiusMeters`, `timezone`, `isActive`, `attendanceValidationEnabled`, `createdAt`, `updatedAt`)
VALUES
(
    'gtids-office-001',
    'gtids-company-uuid-001',
    'GTIDS Operations Center (Nellimarla HQ)',
    'GTIDS-NLM-01',
    'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, AP 535003',
    18.1895500,
    83.3871110,
    50,
    'Asia/Kolkata',
    1,
    1,
    NOW(3),
    NOW(3)
)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `radiusMeters` = VALUES(`radiusMeters`);

INSERT INTO `office_locations` (`id`, `companyId`, `name`, `code`, `address`, `latitude`, `longitude`, `radiusMeters`, `timezone`, `isActive`, `attendanceValidationEnabled`, `createdAt`, `updatedAt`)
VALUES
(
    'gtib-office-001',
    'gtib-company-uuid-002',
    'GTIB Corporate Hub (Nellimarla HQ)',
    'GTIB-NLM-01',
    'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, AP 535003',
    18.1895500,
    83.3871110,
    50,
    'Asia/Kolkata',
    1,
    1,
    NOW(3),
    NOW(3)
)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `radiusMeters` = VALUES(`radiusMeters`);

-- 4. Departments
INSERT INTO `departments` (`id`, `companyId`, `name`, `code`, `createdAt`, `updatedAt`)
VALUES
('dept-gtids-01', 'gtids-company-uuid-001', 'Inclusive Financial Services & Banking', 'GTIDS_FIN', NOW(3), NOW(3)),
('dept-gtids-02', 'gtids-company-uuid-001', 'Skill Training & Rural Livelihoods', 'GTIDS_SKILL', NOW(3), NOW(3)),
('dept-gtids-03', 'gtids-company-uuid-001', 'Field Operations & Banking Correspondents', 'GTIDS_BC_OPS', NOW(3), NOW(3)),
('dept-gtids-04', 'gtids-company-uuid-001', 'Quality, Audit & Compliance', 'GTIDS_COMPL', NOW(3), NOW(3)),
('dept-gtids-05', 'gtids-company-uuid-001', 'Human Resources & Talent Management', 'GTIDS_HR', NOW(3), NOW(3)),
('dept-gtids-06', 'gtids-company-uuid-001', 'Administration & Finance', 'GTIDS_ADMIN', NOW(3), NOW(3)),
('dept-gtib-01', 'gtib-company-uuid-002', 'Insurance Broking & Risk Advisory', 'GTIB_BROK', NOW(3), NOW(3)),
('dept-gtib-02', 'gtib-company-uuid-002', 'Underwriting & Claims Settlement', 'GTIB_UNDER', NOW(3), NOW(3)),
('dept-gtib-03', 'gtib-company-uuid-002', 'Corporate Policy Distribution', 'GTIB_SALES', NOW(3), NOW(3)),
('dept-gtib-04', 'gtib-company-uuid-002', 'Actuarial & Regulatory Compliance', 'GTIB_ACT', NOW(3), NOW(3)),
('dept-gtib-05', 'gtib-company-uuid-002', 'Human Resources', 'GTIB_HR', NOW(3), NOW(3)),
('dept-gtib-06', 'gtib-company-uuid-002', 'Accounts & Finance', 'GTIB_ACCTS', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 5. Shifts
INSERT INTO `shifts` (`id`, `companyId`, `name`, `code`, `startTime`, `endTime`, `lunchStartTime`, `lunchEndTime`, `gracePeriodMinutes`, `lateExceptionMaxMinutes`, `netWorkSpanMinutes`, `totalSpanMinutes`, `isDefault`, `createdAt`, `updatedAt`)
VALUES
('shift-gtids-01', 'gtids-company-uuid-001', 'General Day Schedule (GTIDS)', 'GTIDS-GS', '09:00', '17:30', '13:00', '14:00', 30, 60, 450, 510, 1, NOW(3), NOW(3)),
('shift-gtib-01', 'gtib-company-uuid-002', 'General Day Schedule (GTIB)', 'GTIB-GS', '09:00', '17:30', '13:00', '14:00', 30, 60, 450, 510, 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `startTime` = VALUES(`startTime`), `endTime` = VALUES(`endTime`), `netWorkSpanMinutes` = VALUES(`netWorkSpanMinutes`), `totalSpanMinutes` = VALUES(`totalSpanMinutes`);

SET FOREIGN_KEY_CHECKS = 1;
