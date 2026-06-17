# HealingNet Paystack Integration Guide

## Overview

This documentation covers the Paystack payment integration for online consultations in HealingNet. The system implements an **escrow model** where funds are held and released to doctors after consultations are completed.

## Payment Flow

### 1. **Consultation Creation** (Hospital Staff)
- Hospital staff creates a consultation request for a patient
- System fetches doctor's virtual consultation fee from `doctor_marketplace.external_virtual_fee`
- Fee is displayed to the hospital staff during creation
- Consultation created with `fee_agreed` field populated

### 2. **Payment Initiation** (Doctor Accepts)
- Doctor reviews and accepts the consultation request
- System initiates Paystack payment:
  - Creates payment record in `consultation_payments` table
  - Generates authorization URL with Paystack
  - Payment status: `pending`
- Patient receives payment link (in your UI, you'd display this or send via email)

### 3. **Payment Verification** (After Patient Pays)
- System verifies payment with Paystack API
- On successful verification:
  - `payment_status` → `paid`
  - `charged_at` timestamp recorded
  - Funds held by Paystack (escrow)

### 4. **Consultation Completed** (Doctor Marks Complete)
- Doctor completes consultation and adds notes
- `call_ended_at` timestamp recorded
- System initiates transfer to doctor:
  - Creates transfer recipient with doctor's bank details
  - Initiates Paystack transfer
  - `transfer_status` → `completed`
  - Doctor receives funds

### 5. **Refund Scenarios**
**Cancellation before call starts:**
- System processes refund via Paystack
- `payment_status` → `refunded`
- `refund_reason` → `cancelled_before_call`

**Doctor no-show:**
- System processes refund via Paystack
- `payment_status` → `refunded`
- `refund_reason` → `doctor_no_show`

## Database Schema

### consultation_payments Table
```sql
- id: UUID (primary key)
- consultation_id: UUID (unique, references consultation_requests)
- patient_id: UUID
- doctor_id: UUID
- amount: DECIMAL(10,2) - Consultation fee in Naira
- currency: VARCHAR(3) - Always 'NGN'

-- Paystack Payment References
- paystack_reference: VARCHAR(255) - Unique payment reference
- paystack_auth_url: TEXT - Authorization URL sent to patient
- paystack_access_code: VARCHAR(255) - Access code for verification

-- Payment Status
- payment_status: VARCHAR(50) - pending | paid | failed | refunded
- transfer_status: VARCHAR(50) - pending | completed | failed

-- Transfer Tracking
- transfer_reference: VARCHAR(255)
- transfer_amount: DECIMAL(10,2)
- transfer_recipient_code: VARCHAR(255)

-- Refund Tracking
- refund_reason: VARCHAR(255) - cancelled_before_call | doctor_no_show
- refunded_at: TIMESTAMP
- refund_amount: DECIMAL(10,2)
- refund_reference: VARCHAR(255)

-- Timestamps
- charged_at: TIMESTAMP
- transferred_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## API Integration

### Services (`src/services/paystack.ts`)

#### 1. Initialize Payment
```typescript
await paystackService.initializePayment({
  email: "patient@example.com",
  amount: 500000, // in kobo (₦5,000)
  reference: "CONS-abc123-1234567890",
  metadata: {
    consultation_id: "...",
    patient_id: "...",
    doctor_id: "...",
    type: "consultation",
  },
});
// Returns: { authorization_url, access_code, reference }
```

#### 2. Verify Payment
```typescript
await paystackService.verifyPayment({
  reference: "CONS-abc123-1234567890",
});
// Returns: { status, amount, paid_at, customer }
```

#### 3. Create Transfer Recipient
```typescript
await paystackService.createTransferRecipient({
  type: "nuban",
  account_number: "0123456789",
  bank_code: "058", // Check Paystack bank list
  name: "Dr. John Doe",
});
// Returns: { recipient_code, account_number, bank_code }
```

#### 4. Initiate Transfer
```typescript
await paystackService.initiateTransfer({
  amount: 500000, // in kobo
  recipient: "RCP_...", // recipient_code from step 3
  reference: "TRANS-abc123-1234567890",
  reason: "Consultation payment to Dr. John Doe",
});
// Returns: { transfer_code, reference, status }
```

## React Hooks (`src/hooks/useConsultationPayment.ts`)

### useInitializeConsultationPayment()
Initiates payment when doctor accepts consultation.
```typescript
const mutation = useInitializeConsultationPayment();
await mutation.mutateAsync({
  email: "patient@example.com",
  amount: 5000, // in Naira
  consultation_id: "...",
  patient_id: "...",
  doctor_id: "...",
});
```

### useConsultationPaymentStatus()
Queries payment status for a consultation.
```typescript
const { data: payment } = useConsultationPaymentStatus(consultationId);
// Returns: { payment_status, transfer_status, amount, ... }
```

### useRefundConsultationPayment()
Refunds a consultation payment.
```typescript
const mutation = useRefundConsultationPayment();
await mutation.mutateAsync({
  consultation_id: "...",
  reason: "cancelled_before_call", // or "doctor_no_show"
});
```

### useCompleteConsultationTransfer()
Transfers funds to doctor after consultation.
```typescript
const mutation = useCompleteConsultationTransfer();
await mutation.mutateAsync({
  consultation_id: "...",
  doctor_bank_account: "0123456789",
  doctor_bank_code: "058",
  doctor_name: "Dr. John Doe",
});
```

## Environment Variables

Add to `.env`:
```env
VITE_PAYSTACK_PUBLIC_KEY=pk_test_...
VITE_PAYSTACK_SECRET_KEY=sk_test_...
```

**Production:**
```env
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
VITE_PAYSTACK_SECRET_KEY=sk_live_...
```

## Implementation in Components

### Doctor Consultations Page
The system automatically:
1. **On Accept**: Initiates patient payment
2. **On Complete**: Prepares for transfer to doctor (requires bank details)

### Create Consultation Dialog
- Fetches and displays doctor's consultation fee
- Shows fee to hospital staff during creation
- Stores fee in `fee_agreed` field

## Testing

### Test Scenario 1: Successful Payment
1. Create consultation (fee: ₦5,000)
2. Doctor accepts → Payment initiated
3. Verify payment status → Should show "paid"
4. Doctor completes → Transfer initiated
5. Verify transfer → Should show "completed"

### Test Scenario 2: Refund Before Call
1. Create consultation
2. Doctor accepts → Payment initiated
3. Patient pays
4. Before consultation starts → Initiate refund
5. Verify refund → Should show "refunded"

### Test Scenario 3: Doctor No-Show
1. Create consultation
2. Doctor accepts & payment processed
3. Consultation marked complete without call starting
4. Refund triggered for "doctor_no_show"
5. Patient refunded automatically

## Key Considerations

### 1. **Bank Details Storage**
Currently, doctor bank details are required for transfers. You should:
- Add bank account fields to `doctors` table or `doctor_settings`
- Collect during doctor onboarding
- Validate bank codes with Paystack API

### 2. **Email Notifications**
Implement email notifications at each stage:
- Payment link sent to patient
- Payment confirmed
- Doctor assigned
- Consultation completed
- Funds transferred to doctor

### 3. **Error Handling**
Common errors:
- **Invalid bank code**: Verify against Paystack's bank list
- **Transfer recipient creation fails**: Bank account may not exist
- **Insufficient balance**: Platform needs Paystack balance for transfers
- **Payment verification timeout**: Implement polling

### 4. **Reconciliation**
Periodically verify Paystack data:
- Payment status matches Paystack records
- Transfer status matches actual transfers
- Handle orphaned records

### 5. **Security**
- Never expose secret keys in frontend
- Validate all amounts server-side
- Use webhooks for payment verification (future enhancement)
- Log all payment transactions for audit

## Future Enhancements

1. **Webhook Implementation**: Listen to Paystack webhooks instead of polling
2. **Automated Refunds**: Auto-refund if consultation cancelled
3. **Dispute Handling**: Handle payment disputes through Paystack
4. **Multi-currency**: Support other currencies beyond NGN
5. **Payment History**: Add payment tracking dashboard for admins
6. **Invoice Generation**: Auto-generate invoices for consultations

## Testing Paystack in Development

### Test Card Numbers
- Visa: 4111 1111 1111 1111
- MasterCard: 5555 5555 5555 4444
- Use any future expiry date and CVC

### Amount Constraints
- Use amounts like 50000 (₦500) for testing
- Any amount works in test mode

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Payment not initializing | Check patient email is valid |
| Transfer fails | Verify doctor bank details and codes |
| Payment status not updating | Check Paystack API keys in .env |
| Refund fails | Ensure payment was actually "paid" status |

## Support

For Paystack API questions, visit: https://paystack.com/developers
For integration help, check: https://paystack.com/docs/payments/
