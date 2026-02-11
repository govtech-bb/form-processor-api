# EZPay Payment Integration - Architecture and Data Management

## Table of Contents
1. [Overview](#overview)
2. [Solution Architecture](#solution-architecture)
3. [Payment Flow](#payment-flow)
4. [Data Retention and PII Management](#data-retention-and-pii-management)
5. [Data Cleanup Mechanisms](#data-cleanup-mechanisms)
6. [Security Considerations](#security-considerations)
7. [API Endpoints](#api-endpoints)
8. [Configuration](#configuration)

---

## Overview

The EZPay integration enables secure payment processing for form submissions. The system is designed with **privacy-first principles** where Personally Identifiable Information (PII) is encrypted, temporarily stored, and automatically deleted after successful payment processing.

### Key Features
- Multi-department support with separate API keys
- Webhook-based payment status updates with verification
- Automatic PII cleanup after successful payment
- Abandoned payment cleanup for failed/incomplete transactions
- Automated payment reconciliation every 5 minutes
- Support for multiple payment processors (Credit Card, Direct Debit, Payce, mMoney)

---

## Solution Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Form Submission Layer                       │
│  (User submits form with payment-required flag)                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Payment Service Layer                       │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐    │
│  │ EZPay        │  │ Payment Webhook │  │ Reconciliation   │    │
│  │ Service      │◄─┤ Service         │◄─┤ Service          │    │
│  └──────┬───────┘  └────────┬────────┘  └──────────────────┘    │
│         │                   │                                   │
└─────────┼───────────────────┼───────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Database Layer                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────┐  ┌──────────────┐   │
│  │ Payment      │  │ FormSubmissionPayment│  │ Transaction  │   │
│  │ (metadata)   │  │ (encrypted PII)      │  │ (audit)      │   │
│  └──────────────┘  └──────────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cleanup Layer (Cron Jobs)                   │
│                                                                 │
│  ┌──────────────────────────┐  ┌────────────────────────────┐   │
│  │ Abandoned Payment        │  │ Payment Reconciliation     │   │
│  │ Cleanup (Daily 2AM)      │  │ (Every 5 Minutes)          │   │
│  │ - TTL: 72 hours          │  │ - Sync with EZPay          │   │
│  │ - Deletes PII            │  │ - Trigger workflows        │   │
│  └──────────────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Services

#### 1. **EZPayService**
Core integration service responsible for:
- Creating payment sessions with EZPay
- Generating secure payment tokens and URLs
- Verifying payment status via EZPay API
- Querying transactions by date range
- Multi-department API key routing and management

#### 2. **PaymentWebhookService**
Webhook processing service that:
- Receives and processes EZPay webhook callbacks
- Verifies webhook authenticity by cross-checking with EZPay API
- Updates payment and transaction records
- Triggers post-payment workflows (email notifications)
- **Deletes encrypted PII after successful email delivery**

#### 3. **PaymentReconciliationService**
Automated reconciliation service that:
- Runs every 5 minutes via scheduled job
- Queries EZPay for today's transactions across all departments
- Synchronizes payment statuses between systems
- Triggers webhook workflows for missed/late updates
- Ensures no payment updates are lost

#### 4. **AbandonedPaymentCleanupService**
Scheduled cleanup service that:
- Runs daily at 2:00 AM via cron job
- Identifies abandoned payments (PENDING/INITIATED > 72 hours)
- **Deletes encrypted PII from abandoned submissions**
- Marks payments as CANCELLED for record-keeping

---

## Payment Flow

### 1. Payment Initiation
```
User Submits Form → API Creates Payment Record → EZPay Session Created
                                                          ↓
                    Encrypted PII Stored ← Payment URL Returned
```

**Data Stored:**
- Payment metadata: customer identifiers, reference numbers, amount
- Form submission data: **encrypted full form data** (PII)

**Reference Number Format:** `DEPARTMENT|formId|submissionId`
Example: `EDUCATION|form123|sub456`

### 2. User Makes Payment
```
User Redirected to EZPay → User Completes Payment → EZPay Processes
```

### 3. Webhook Processing (Primary Path)
```
EZPay Webhook Received → Verify with EZPay API → Update Payment Status
                                                           ↓
                    Email Notifications Sent ← Decrypt Form Data
                                  ↓
                    **PII DELETED IMMEDIATELY**
```

**Critical Security Step:** Once emails are successfully sent to admins and users, the encrypted form data is permanently deleted from the database.

### 4. Reconciliation (Backup Path)
```
Cron Job (Every 5 min) → Query EZPay Transactions → Find Missing/Updated
                                                              ↓
                              Manual Verification → Same Workflow as Webhook
```

This ensures no payments are missed even if webhook delivery fails.

---

## Data Retention and PII Management

### What PII is Stored?

#### **Payment Table**
Stores **minimal identifying information** (NOT full form data):
- Customer email and name
- Reference number (DEPARTMENT|formId|submissionId format)
- Payment amount and status
- Payment provider details
- Retention: **Permanent** (audit trail for financial transactions)

#### **FormSubmissionPayment Table**
Stores **encrypted full form submission data** (PII):
- Encrypted form data containing all submitted fields
- Deletion status tracking flag
- Notification status flag
- Retention: **Temporary** (see deletion mechanisms below)

**Encryption Method:**
- Algorithm: AES-256-CBC
- Key: Stored securely in environment configuration
- Data includes: All form fields submitted by the user

### How Long is PII Retained?

| Scenario | Retention Period | Deletion Trigger |
|----------|-----------------|------------------|
| **Successful Payment** | Until email delivery | Immediate deletion after emails sent (typically < 1 minute) |
| **Failed Payment** | 72 hours (3 days) | Abandoned payment cleanup cron job |
| **Abandoned Payment** (PENDING/INITIATED) | 72 hours (3 days) | Abandoned payment cleanup cron job |

**Configuration:**
- Default retention: 72 hours (3 days)
- Configurable via environment variable: `PAYMENTS_ABANDONED_PAYMENT_TTL_HOURS`

---

## Data Cleanup Mechanisms

### 1. **Immediate Cleanup (Successful Payments)**

**Trigger:** After successful payment and email delivery

**Process:**
1. Payment status confirmed as successful
2. Form data decrypted for email processing
3. Admin emails sent (full form data + payment info)
4. User emails sent (payment confirmation only, no PII)
5. Encrypted form data permanently deleted from database
6. Deletion flag set to prevent reprocessing

**Idempotency Protection:**
- Notification tracking prevents duplicate emails
- Deletion flag prevents processing after data removal
- System ensures cleanup only occurs once per payment

### 2. **Scheduled Cleanup (Abandoned Payments)**

**Schedule:** Daily at 2:00 AM via automated cron job

**Criteria for Cleanup:**
- Payment status: PENDING or INITIATED (not completed)
- Created more than **72 hours** ago (configurable)
- Form data not already deleted

**Process:**
1. Calculate cutoff date based on configured TTL
2. Query database for abandoned payments matching criteria
3. For each abandoned payment:
   - Delete encrypted form data from database
   - Set deletion flag to true
   - Update payment status to CANCELLED

**Logging:**
- Total count of abandoned payments identified
- Individual deletion operations logged
- Success and error counts tracked for monitoring

### 3. **Manual Cleanup**

**API Endpoint:** `GET /payments/verify?transactionNumber=X&reference=Y`

Administrators can manually verify and update payment status, which triggers the same cleanup workflow as webhooks.

---

## Security Considerations

### 1. **Encryption at Rest**
- All form submission data encrypted using AES-256-CBC
- Encryption key stored in environment variable (not in code)
- Key rotation possible via configuration update

### 2. **Webhook Security**
- Optional signature verification when webhook secret is configured
- Cross-verification with EZPay API before processing any status changes
- Prevents unauthorized or fraudulent payment status updates
- Webhook data validated against live EZPay API response

### 3. **Data Minimization**
- Only necessary PII stored temporarily
- Payment table stores minimal metadata permanently (audit requirement)
- Full form data deleted as soon as possible

### 4. **Access Control**
- Payment endpoints require proper authentication
- Department-specific API keys isolate payment processing
- Admin vs User email separation prevents PII leakage to users

### 5. **Audit Trail**
- All payment transactions logged
- Status transitions tracked
- Deletion operations logged with timestamps

---

## API Endpoints

### Payment Endpoints

#### 1. **Webhook Handler**
- **Endpoint:** `POST /payments/ezpay/webhook`
- **Purpose:** Receives payment status updates from EZPay
- **Security:** Optional signature verification via header
- **Process:** Validates, verifies, and processes payment status changes

#### 2. **Payment Status Check**
- **Endpoint:** `GET /payments/status/:reference`
- **Purpose:** Returns current payment status for a reference number
- **Use Case:** Front-end status polling or admin verification

#### 3. **Manual Payment Verification**
- **Endpoint:** `GET /payments/verify`
- **Parameters:** `transactionNumber` and/or `reference`
- **Purpose:** Manually verifies payment with EZPay and updates status
- **Use Case:** Administrative troubleshooting or missed webhooks

#### 4. **Department Reconciliation**
- **Endpoint:** `POST /payments/reconcile/:department`
- **Parameters:** Optional `startDate` and `endDate`
- **Purpose:** Manually triggers reconciliation for specific department and date range
- **Use Case:** Administrative bulk reconciliation or recovery

---

## Configuration

### Environment Variables

```bash
# EZPay Configuration
EZPAY_BASE_URL=https://api.ezpay.com
EZPAY_API_KEY=default_api_key
EZPAY_WEBHOOK_SECRET=optional_webhook_secret

# Department-specific API Keys (optional)
EZPAY_EDUCATION_API_KEY=education_specific_key
EZPAY_HEALTH_API_KEY=health_specific_key

# Data Retention Configuration
PAYMENTS_ABANDONED_PAYMENT_TTL_HOURS=72  # Default: 72 (3 days)

# Encryption
ENCRYPTION_KEY=your_aes_256_encryption_key
```

### Cron Job Schedule

| Job | Schedule | Purpose |
|-----|----------|---------|
| Payment Reconciliation | Every 5 minutes | Sync payment statuses with EZPay |
| Abandoned Payment Cleanup | Daily at 2:00 AM | Delete PII from abandoned payments |

---

## Implementation Components

### Core Services
- **EZPayService** - EZPay API integration and payment session management
- **PaymentWebhookService** - Webhook processing and PII cleanup orchestration
- **PaymentReconciliationService** - Automated transaction reconciliation
- **AbandonedPaymentCleanupService** - Scheduled PII cleanup service

### Data Models
- **Payment Entity** - Payment metadata (permanent retention)
- **FormSubmissionPayment Entity** - Encrypted PII (temporary retention)
- **PaymentTransaction Entity** - Transaction audit trail
