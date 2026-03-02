-- ============================================================================
-- Sandbox Form Configuration Seed Script
-- ============================================================================
-- Purpose: Configure form email recipients for sandbox testing environment
-- Email: laron.maughn@govtech.bb (test submissions go to dev team, not government)
-- Environment: Sandbox only - DO NOT run in production
-- ============================================================================

-- Enable UUID extension (required for form_configs table)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table if you want to start fresh (OPTIONAL - comment out if you want to keep existing data)
-- DROP TABLE IF EXISTS form_configs CASCADE;

-- Create form_configs table
CREATE TABLE IF NOT EXISTS form_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_form_config_form_id_key'
    ) THEN
        CREATE UNIQUE INDEX idx_form_config_form_id_key 
        ON form_configs (form_id, key);
    END IF;
END $$;

-- ============================================================================
-- CERTIFICATE FORMS (Office of Attorney General - Registration Department)
-- ============================================================================

-- Birth Certificate
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-birth-certificate',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Birth certificate test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-birth-certificate',
    'payment_code',
    'BIRTH_CERT',
    'EZPay payment code for birth certificates'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-birth-certificate',
    'payment_amount',
    '20.00',
    'Cost per birth certificate copy in BBD'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Death Certificate
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-death-certificate',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Death certificate test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-death-certificate',
    'payment_code',
    'DEATH_CERT',
    'EZPay payment code for death certificates'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-death-certificate',
    'payment_amount',
    '20.00',
    'Cost per death certificate copy in BBD'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Marriage Certificate
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-marriage-certificate',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Marriage certificate test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-marriage-certificate',
    'payment_code',
    'MARRIAGE_CERT',
    'EZPay payment code for marriage certificates'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'get-marriage-certificate',
    'payment_amount',
    '20.00',
    'Cost per marriage certificate copy in BBD'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Birth Registration (OpenCRVS integration)
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'register-birth-form',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Birth registration test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- BUSINESS & CORPORATE FORMS (Corporate Affairs & Intellectual Property Office)
-- ============================================================================

-- Reserve Company Name
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'reserve-company-name',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Company name reservation test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Reserve Society Name
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'reserve-society-name',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Society name reservation test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- POSTAL SERVICES (Barbados Postal Service)
-- ============================================================================

-- Post Office Redirection - Individual
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'post-office-redirection-individual',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Individual mail redirection test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Post Office Redirection - Business
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'post-office-redirection-business',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Business mail redirection test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Post Office Redirection - Deceased
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'post-office-redirection-deceased',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Deceased mail redirection test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- EDUCATION FORMS (Ministry of Education)
-- ============================================================================

-- Primary School Textbook Grant
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'primary-school-textbook-grant',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Textbook grant test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- YOUTH & SPORTS FORMS (Ministry of Youth, Sports and Community Empowerment)
-- ============================================================================

-- JobStart Plus Programme
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'jobstart-plus-programme',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: JobStart Plus test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Community Sports Programme
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'community-sports-registration',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Community sports test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Project Protege Mentor
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'project-protege-mentor',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Project Protege mentor test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- TRANSPORT & LICENSING FORMS
-- ============================================================================

-- Conductor Licence
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'apply-for-conductor-licence',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Conductor licence test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- ENVIRONMENTAL & PLANNING FORMS
-- ============================================================================

-- Permission to Remove Tree
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'permission-to-remove-tree',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Tree removal permission test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Sell Goods/Services at Beach or Park
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'sell-goods-services-beach-park',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Beach/park vendor test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- EMERGENCY SERVICES FORMS
-- ============================================================================

-- Fire Service Inspection
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'request-a-fire-service-inspection',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Fire inspection test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- FEEDBACK & SURVEYS
-- ============================================================================

-- Simple Feedback Form
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'simple-feedback-form',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Feedback test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Exit Survey
INSERT INTO form_configs (form_id, key, value, description)
VALUES (
    'exit-survey',
    'admin_email',
    'laron.maughn@govtech.bb',
    'SANDBOX: Exit survey test submissions'
) ON CONFLICT (form_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify all configurations were inserted correctly
SELECT 
    form_id,
    key,
    value,
    description,
    created_at
FROM form_configs
ORDER BY form_id, key;
