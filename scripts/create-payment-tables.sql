-- Create payment tables migration
-- Based on: 1733876400000-CreatePaymentTables.ts

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR UNIQUE NOT NULL,
    process_id VARCHAR UNIQUE NOT NULL,
    payment_provider VARCHAR CHECK (payment_provider IN ('ezpay')) NOT NULL,
    payment_token VARCHAR,
    payment_url VARCHAR,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR CHECK (status IN ('pending', 'initiated', 'success', 'failed', 'cancelled', 'refunded')) DEFAULT 'pending' NOT NULL,
    customer_email VARCHAR,
    customer_name VARCHAR NOT NULL,
    payment_code VARCHAR NOT NULL,
    description VARCHAR,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create indexes for payments table
CREATE INDEX IF NOT EXISTS IDX_payments_reference_number ON payments(reference_number);
CREATE INDEX IF NOT EXISTS IDX_payments_process_id ON payments(process_id);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id VARCHAR NOT NULL,
    transaction_number VARCHAR UNIQUE NOT NULL,
    account_code VARCHAR,
    processor VARCHAR CHECK (processor IN ('Credit Card', 'Direct Debit', 'Payce', 'mMoney')),
    status VARCHAR CHECK (status IN ('Initiated', 'Success', 'Failed')) DEFAULT 'Initiated' NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date_settled TIMESTAMP,
    date_initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    details VARCHAR,
    response_data JSONB,
    callback_data JSONB,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create indexes for payment_transactions table
CREATE INDEX IF NOT EXISTS IDX_payment_transactions_transaction_number ON payment_transactions(transaction_number);
CREATE INDEX IF NOT EXISTS IDX_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS IDX_payment_transactions_status ON payment_transactions(status);

-- Create form_submission_payments table
CREATE TABLE IF NOT EXISTS form_submission_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id VARCHAR NOT NULL,
    submission_id VARCHAR NOT NULL,
    payment_id UUID NOT NULL,
    payment_required BOOLEAN DEFAULT true NOT NULL,
    payment_completed BOOLEAN DEFAULT false NOT NULL,
    notification_sent BOOLEAN DEFAULT false NOT NULL,
    form_data_deleted BOOLEAN DEFAULT false NOT NULL,
    encrypted_form_data TEXT,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL,
    CONSTRAINT FK_form_submission_payments_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- Create indexes for form_submission_payments table
CREATE UNIQUE INDEX IF NOT EXISTS IDX_form_submission_payments_form_submission ON form_submission_payments(form_id, submission_id);
CREATE INDEX IF NOT EXISTS IDX_form_submission_payments_payment_id ON form_submission_payments(payment_id);

-- Display success message
SELECT 'Payment tables created successfully!' as message;
