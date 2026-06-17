-- Create consultation_payments table for Paystack payment tracking
CREATE TABLE IF NOT EXISTS consultation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL UNIQUE REFERENCES consultation_requests(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',

  -- Paystack references
  paystack_reference VARCHAR(255) UNIQUE,
  paystack_auth_url TEXT,
  paystack_access_code VARCHAR(255),

  -- Payment flow status
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
  transfer_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed

  -- Transfer tracking (when releasing to doctor)
  transfer_reference VARCHAR(255),
  transfer_amount DECIMAL(10,2),
  transfer_recipient_code VARCHAR(255),

  -- Refund tracking
  refund_reason VARCHAR(255), -- cancelled_before_call, doctor_no_show, patient_request
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_amount DECIMAL(10,2),
  refund_reference VARCHAR(255),

  -- Timestamps
  charged_at TIMESTAMP WITH TIME ZONE,
  transferred_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT amount_positive CHECK (amount > 0),
  CONSTRAINT refund_amount_positive CHECK (refund_amount IS NULL OR refund_amount > 0)
);

-- Indexes for faster queries
CREATE INDEX idx_consultation_payments_consultation_id ON consultation_payments(consultation_id);
CREATE INDEX idx_consultation_payments_patient_id ON consultation_payments(patient_id);
CREATE INDEX idx_consultation_payments_doctor_id ON consultation_payments(doctor_id);
CREATE INDEX idx_consultation_payments_status ON consultation_payments(payment_status);
CREATE INDEX idx_consultation_payments_transfer_status ON consultation_payments(transfer_status);
CREATE INDEX idx_consultation_payments_reference ON consultation_payments(paystack_reference);
