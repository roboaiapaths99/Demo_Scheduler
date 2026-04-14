/**
 * BOOKING WORKFLOW DOCUMENTATION
 * Complete end-to-end booking flow for Tutors and Sales
 * with Conflict Prevention and Real-time Synchronization
 */

// ============================================================================
// PART 1: BOOKING LIFECYCLE & STATUS FLOW
// ============================================================================

/*
AVAILABILITY STATUS FLOW (Tutor Side):
┌─────────────┐
│  available  │  ← Tutor creates slot here
└──────┬──────┘
       │ (Sales books)
       ↓
┌─────────────┐
│   booked    │  ← Slot is locked, no other sales can book
└──────┬──────┘
       │ (Tutor confirms or rejects)
       ├─────────────────────────┐
       ↓                         ↓
┌─────────────┐         ┌──────────────────┐
│ confirmed   │         │   cancelled      │
└─────────────┘         └──────────────────┘
   (Session OK)              (Undo booking)

BOOKING STATUS FLOW (Booking Model):
┌──────────┐         ┌───────────┐
│ pending  │ ← created with default status
└────┬─────┘
     │ (Tutor confirms)
     ├──────────────────┬──────────────────┐
     │                  │                  │
     ↓                  ↓ (Tutor rejects)  ↓ (Auto-cancel)
┌───────────┐   ┌──────────────┐    ┌──────────────┐
│ confirmed │   │  cancelled   │    │  no-show     │
└───────────┘   └──────────────┘    └──────────────┘
     │
     ├────── (Session completed)──────┐
     ↓                                 ↓
┌───────────┐                  ┌──────────────┐
│ completed │                  │  rescheduled │
└───────────┘                  └──────────────┘
*/

// ============================================================================
// PART 2: CONFLICT PREVENTION MECHANISMS
// ============================================================================

/*
DOUBLE-BOOKING PREVENTION:
═════════════════════════════

Mechanism 1: DATABASE UNIQUE CONSTRAINT
───────────────────────────────────────
Model: Availability.js
  availabilityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    unique: true,  ← CRITICAL: Only ONE booking per availability slot
    index: true
  }

Result: 
  - If 2 sales try to book same slot simultaneously
  - FIRST booking succeeds
  - SECOND booking gets unique constraint error
  ✅ No double-booking possible

Mechanism 2: STATUS LOCK BEFORE TRANSACTION
───────────────────────────────────────────
BookingController.createBooking():

  1. Find availability slot
  2. CHECK: if (availability.status !== 'available') → REJECT
  3. SET: availability.status = 'booked'  ← IMMEDIATE LOCK
  4. START MongoDB Transaction
  5. CREATE booking record
  6. COMMIT transaction

Result:
  - Even if 2 requests reach simultaneously
  - First one sets status to 'booked'
  - Second one sees status !== 'available' → REJECTED
  ✅ Status prevents double-booking

Mechanism 3: MONGODB TRANSACTIONS
────────────────────────────────
const session = await mongoose.startSession();
session.startTransaction();
  
  // All these operations are ATOMIC
  availability.status = 'booked';
  booking.save({ session });
  availability.bookingId = booking._id;
  
session.commitTransaction();

Result:
  - Either ALL operations succeed or ALL roll back
  - If any step fails, entire booking is aborted
  - NO partial bookings possible
  ✅ ACID compliance

Mechanism 4: PAST DATE PREVENTION
────────────────────────────────
BookingController.createBooking():

  if (availability.date <= new Date()) {
    return res.status(400).json({
      message: 'Cannot book slots in the past.'
    });
  }

Result:
  - Only future slots can be booked
  - Cannot create double-booking with past meetings
  ✅ Future-only slots
*/

// ============================================================================
// PART 3: COMPLETE BOOKING WORKFLOW
// ============================================================================

/*
STEP 1: TUTOR CREATES AVAILABILITY
═══════════════════════════════════

Endpoint: POST /api/availability
Tutor Action: "My Availability" → Add Slot

Request:
{
  date: "2026-04-20",
  startTime: "10:00",
  endTime: "11:00",
  notes: "Online via Zoom"
}

Database State BEFORE:
  Availability: { status: "available", tutorId: "tutor123" }

Database State AFTER:
  Availability: { 
    status: "available",  ← Ready to be booked
    tutorId: "tutor123",
    date: "2026-04-20",
    startTime: "10:00",
    endTime: "11:00",
    bookingId: null
  }

Visibility:
  ✅ Tutor can see it in "My Availability" page
  ❌ Sales cannot see it YET        

───────────────────────────────────────────────────────────

STEP 2: SALES SEES AVAILABLE TUTORS
═══════════════════════════════════

Endpoint: GET /api/data/sales/available-tutors
Sales Action: "Book Tutor" → Browse Tutors

Middleware Check:
  authorize('sales', 'admin') ✅ PASS

Query:
  SELECT tutors WHERE role = 'tutor'
  FOR EACH tutor:
    COUNT availableSlots WHERE tutorId = tutor AND status = 'available'
    COUNT upcomingBookings WHERE tutorId = tutor AND status IN ['pending','confirmed']

Response:
{
  data: [
    {
      _id: "tutor123",
      name: "John Smith",
      specialization: "Math",
      rating: 4.8,
      availableSlots: 5,        ← Tutor's availability count
      upcomingBookings: 2
    }
  ]
}

Visibility:
  ✅ Sales can see ALL tutors and their slot counts
  ✅ Sales can see busy/free status
  ❌ Tutor cannot see this data

───────────────────────────────────────────────────────────

STEP 3: SALES VIEWS TUTOR'S AVAILABLE SLOTS
════════════════════════════════════════════

Endpoint: GET /api/data/sales/tutor/:tutorId/availability
Sales Action: Click on tutor → "Book Now"

Middleware Check:
  authorize('sales', 'admin') ✅ PASS

Query:
  SELECT slots FROM Availability
  WHERE tutorId = {tutorId}
    AND status = 'available'
    AND date >= TODAY()
  ORDER BY date, startTime

Response:
{
  success: true,
  data: [
    {
      _id: "avail123",
      date: "2026-04-20",
      startTime: "10:00",
      endTime: "11:00",
      notes: "Online via Zoom"
    },
    {
      _id: "avail124",
      date: "2026-04-20",
      startTime: "11:00",
      endTime: "12:00",
      notes: "Online via Zoom"
    }
  ]
}

Visibility:
  ✅ Sales can see ALL available slots for this tutor
  ❌ Tutor sees "booked" slots only (not available anymore)

───────────────────────────────────────────────────────────

STEP 4: SALES BOOKS A SLOT (CRITICAL POINT - CONFLICT CHECK)
═════════════════════════════════════════════════════════════

Endpoint: POST /api/bookings
Sales Action: Select slot + Enter client details → Click "Confirm Booking"

Request:
{
  availabilityId: "avail123",
  clientName: "Alice Johnson",
  clientEmail: "alice@company.com",
  clientPhone: "+1234567890",
  clientNotes: "Needs help with calculus"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ CONFLICT PREVENTION ━━━━━━━━━━━━━━━━━━━━━━

Processing (All within MongoDB Transaction):
  
  1. FIND availability slot
  2. CHECK STATUS:
     if (availability.status !== 'available')
       → ABORT ❌ "This slot is no longer available"
  
  3. CHECK DATE:
     if (availability.date <= NOW)
       → ABORT ❌ "Cannot book past slots"
  
  4. LOCK SLOT:
     availability.status = 'booked'  ← Prevents other sales from booking
     await save()
  
  5. CREATE BOOKING:
     booking = {
       tutorId: availability.tutorId,
       salesId: "sales456",
       availabilityId: "avail123",
       clientName: "Alice Johnson",
       clientEmail: "alice@company.com",
       clientPhone: "+1234567890",
       status: "pending"  ← Waiting for tutor's response
     }
     await booking.save()
  
  6. LINK RECORDS:
     availability.bookingId = booking._id
     await save()
  
  7. COMMIT ✅ Transaction succeeds

Database State AFTER:
  
  Availability:
  {
    _id: "avail123",
    tutorId: "tutor123",
    status: "booked",      ← Locked, no more sales can book this
    bookingId: "booking789"  ← Links to booking record
  }
  
  Booking:
  {
    _id: "booking789",
    tutorId: "tutor123",
    salesId: "sales456",
    availabilityId: "avail123",
    status: "pending",     ← Tutor hasn't responded yet
    clientName: "Alice Johnson"
  }

Response to Sales:
{
  success: true,
  message: "Booking created successfully",
  data: {
    bookingId: "booking789",
    tutorName: "John Smith",
    clientName: "Alice Johnson",
    scheduledAt: "2026-04-20 10:00",
    status: "pending"
  }
}

Visibility NOW:
  ✅ Sales sees booking with status "pending"
  ✅ Tutor gets notification of new booking
  ✅ Slot no longer appears in available list
  ✅ Both can see booking but with different contexts

───────────────────────────────────────────────────────────

STEP 5: TUTOR SEES PENDING BOOKING
═══════════════════════════════════

Endpoint: GET /api/data/tutor/my-bookings
Tutor Action: "My Bookings" → View pending

Middleware Check:
  authenticate() ✅ Token valid
  authorize('tutor', 'admin') ✅ Tutor role
  roleBasedDataVisibility ✅ Applied

Query:
  SELECT FROM Booking
  WHERE tutorId = req.user._id  ← Only their own bookings
    AND status IN ['pending', 'confirmed', 'completed']
  POPULATE salesId, availabilityId

Response:
{
  success: true,
  data: {
    bookings: [
      {
        _id: "booking789",
        clientName: "Alice Johnson",
        clientEmail: "alice@company.com",
        clientPhone: "+1234567890",
        scheduledAt: "2026-04-20",
        startTime: "10:00",
        endTime: "11:00",
        status: "pending",     ← Tutor must respond
        salesName: "Jane Sales"   ← Who made the booking
      }
    ]
  }
}

Visibility:
  ✅ Tutor sees ONLY bookings where they are tutorId
  ❌ Tutor cannot see other tutors' bookings
  ❌ Tutor cannot see all sales' bookings (only when booked to them)

───────────────────────────────────────────────────────────

STEP 6A: TUTOR CONFIRMS BOOKING
════════════════════════════════

Endpoint: PUT /api/bookings/:bookingId/confirm
Tutor Action: "Confirm" button on booking

Request:
{
  bookingId: "booking789"
}

Processing:
  1. FIND booking (must belong to req.user._id as tutorId)
  2. UPDATE booking.status = "confirmed"
  3. UPDATE booking.tutorResponse = "accepted"
  4. UPDATE availability status? → NO (stays 'booked')
  5. SEND notification to sales
  6. RETURN confirmation

Database State AFTER:
  
  Booking:
  {
    status: "confirmed",
    tutorResponse: "accepted",
    updatedAt: NOW
  }
  
  Availability: (unchanged)
  {
    status: "booked",
    bookingId: "booking789"
  }

Response:
{
  success: true,
  message: "Booking confirmed",
  data: {
    bookingId: "booking789",
    status: "confirmed"
  }
}

Visibility NOW:
  ✅ Tutor sees "confirmed" instead of "pending"
  ✅ Sales sees status change to "confirmed" in real-time
  ✅ Both sides now show "confirmed"

───────────────────────────────────────────────────────────

STEP 6B: TUTOR REJECTS BOOKING (ALTERNATIVE)
═════════════════════════════════════════════

Endpoint: PUT /api/bookings/:bookingId/reject
Tutor Action: "Reject" button on booking

Request:
{
  bookingId: "booking789",
  reason: "Not available for calculus" (optional)
}

Processing (ATOMIC TRANSACTION):
  1. FIND booking
  2. UPDATE booking.status = "cancelled"
  3. UPDATE booking.tutorResponse = "rejected"
  4. FIND availability by bookingId
  5. UPDATE availability.status = "available"  ← UNLOCK SLOT
  6. CLEAR availability.bookingId = null
  7. CLEAR availability.clientInfo = null
  8. COMMIT transaction
  9. SEND notification to sales

Database State AFTER:
  
  Booking:
  {
    status: "cancelled",
    tutorResponse: "rejected",
    updatedAt: NOW
  }
  
  Availability: (RESET)
  {
    status: "available",     ← Back to available!
    bookingId: null,
    clientInfo: null
  }

Response:
{
  success: true,
  message: "Booking rejected",
  data: {
    bookingId: "booking789",
    status: "cancelled",
    slotReleased: true
  }
}

Visibility NOW:
  ✅ Tutor sees "cancelled"
  ✅ Sales sees status change to "cancelled"
  ✅ Slot becomes "available" again for other sales!
  ✅ Sales gets notification: "Booking rejected by tutor"

───────────────────────────────────────────────────────────

STEP 7: SALES SEES CONFIRMATION
════════════════════════════════

Endpoint: GET /api/data/sales/my-bookings
Sales Action: "My Bookings" page (auto-refreshes)

Middleware Check:
  authorize('sales', 'admin') ✅ PASS

Query:
  SELECT FROM Booking
  WHERE salesId = req.user._id  ← Only THEIR bookings
  POPULATE tutorId

Response:
{
  success: true,
  data: {
    totalBookings: 15,
    confirmedBookings: 12,
    pendingBookings: 1,      ← Just decreased (was 2)
    cancelledBookings: 2,
    
    bookings: [
      {
        _id: "booking789",
        tutorName: "John Smith",
        clientName: "Alice Johnson",
        scheduledAt: "2026-04-20",
        startTime: "10:00",
        endTime: "11:00",
        status: "confirmed"    ← Changed from "pending"!
      }
    ]
  }
}

Visibility:
  ✅ Sales sees ONLY their own bookings
  ✅ Sales cannot see other sales' bookings
  ✅ Sales can see booking details and status

───────────────────────────────────────────────────────────

STEP 8: BOOKING COMPLETE (Finally!)
════════════════════════════════════

After the session happens, status flows to "completed":

Options:
  A) Automatic: If timestamp passes end time
  B) Manual: Tutor or system marks as completed

Final Database State:
  
  Booking:
  {
    _id: "booking789",
    tutorId: "tutor123",
    salesId: "sales456",
    status: "completed",
    updatedAt: TODAY
  }
  
  Availability:
  {
    status: "booked",  ← Stays booked (historical record)
    bookingId: "booking789"
  }

Visibility:
  ✅ Both can see completed booking in history
  ✅ Slot may remain "booked" or move to "completed"
*/

// ============================================================================
// PART 4: DATA VISIBILITY RULES (COMPLETE)
// ============================================================================

/*
TABLE: DATA VISIBILITY MATRIX
═════════════════════════════

┌─────────────────────────────────┬────────┬───────┬───────┐
│ Data / Action                   │ Tutor  │ Sales │ Admin │
├─────────────────────────────────┼────────┼───────┼───────┤
│ See own availability slots      │ ✅ YES │ ❌ NO │ ✅ YES│
│ See own bookings                │ ✅ YES │ ✅ YES│ ✅ YES│
│ See bookings where they are     │ ✅ YES │ -     │ ✅ YES│
│ tutor/sales                     │        │       │       │
│ See all tutors list             │ ❌ NO  │ ✅ YES│ ✅ YES│
│ See all tutors' availability    │ ❌ NO  │ ✅ YES│ ✅ YES│
│ See available slots for tutor X │ ❌ NO  │ ✅ YES│ ✅ YES│
│ See all sales                   │ ❌ NO  │ ❌ NO │ ✅ YES│
│ See other tutors' slots         │ ❌ NO  │ ❌ NO │ ✅ YES│
│ See other sales' bookings       │ ❌ NO  │ ❌ NO │ ✅ YES│
│ Create availability             │ ✅ YES │ ❌ NO │ ✅ YES│
│ Book a slot                     │ ❌ NO  │ ✅ YES│ ✅ YES│
│ Confirm booking                 │ ✅ YES │ ❌ NO │ ✅ YES│
│ Reject booking                  │ ✅ YES │ ❌ NO │ ✅ YES│
│ Cancel booking                  │ ❌ NO  │ ✅ YES│ ✅ YES│
│ Delete availability             │ ✅ YES │ ❌ NO │ ✅ YES│
└─────────────────────────────────┴────────┴───────┴───────┘
*/

// ============================================================================
// PART 5: REAL-TIME SYNCHRONIZATION
// ============================================================================

/*
HOW BOTH SIDES STAY IN SYNC
═══════════════════════════

Mechanism 1: DATABASE SINGLE SOURCE OF TRUTH
─────────────────────────────────────────────
- All changes written to MongoDB
- Both sides fetch from same database
- No cached/stale data needed

Mechanism 2: AUTOMATIC PAGE REFRESH
────────────────────────────────────
Code in tutor-bookings.html:
  
  // Refresh every 10 seconds
  setInterval(async () => {
    const response = await fetch('/api/data/tutor/my-bookings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    this.allBookings = result.data.bookings;
    this.renderBookings(this.allBookings);
  }, 10000);  ← Every 10 seconds

Code in sales-bookings.html:
  
  // Same refresh pattern
  setInterval(async () => {
    const response = await fetch('/api/data/sales/my-bookings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // Re-render with latest data
  }, 10000);

Result:
  - Both pages update every 10 seconds automatically
  - When tutor confirms, sales sees change within 10 seconds
  - When tutor rejects, slot shows available again within 10 seconds
  ✅ NEAR REAL-TIME SYNC

Mechanism 3: UNIQUE CONSTRAINTS PREVENT CONFLICTS
──────────────────────────────────────────────────

If 2 sales somehow book the same slot simultaneously:

Request 1: POST /api/bookings { availabilityId: "avail123" }
Request 2: POST /api/bookings { availabilityId: "avail123" }

Database unique constraint on availabilityId in Booking collection:
  
  Request 1:
    → Status check: "available" ✅ PASS
    → Update status to "booked" ✅
    → Create booking record ✅
    → Commit ✅
  
  Request 2:
    → Status check: "booked" ❌ FAIL
    → Error: "This slot is no longer available"
    → Return 400 error to sales 2

Result:
  ✅ Sales 1 gets booking
  ❌ Sales 2 gets error
  ✅ NO conflict, NO double booking
*/

// ============================================================================
// PART 6: ERROR SCENARIOS & RECOVERY
// ============================================================================

/*
SCENARIO 1: SALES TRIES TO BOOK ALREADY-BOOKED SLOT
════════════════════════════════════════════════════

Sales 1 books slot ✅
Sales 2 tries to book same slot

Error Response:
{
  success: false,
  message: "This slot is no longer available.",
  statusCode: 400
}

User Experience:
  Sales 2 sees: "Unable to book - This slot was just taken"
  Sales can either:
    A) Refresh page to see available slots
    B) Choose different time slot
    C) Choose different tutor

Recovery: ✅ Automatic - slot no longer shown in available list


SCENARIO 2: TUTOR REJECTS BOOKING
═══════════════════════════════════

Booking in "pending" status
Tutor clicks "Reject"

Server Actions:
  1. Change booking.status = "cancelled"
  2. Change availability.status = "available"
  3. Clear links/client info

Database Updates (Transaction ensures all or nothing):
  ✅ Booking cancelled
  ✅ Slot released back to "available"

User Experience:
  
  Tutor sees:
    - Booking disappears from "pending" list
    - Moves to "cancelled" section
  
  Sales sees:
    - Booking status change to "cancelled"
    - Notification: "Tutor rejected your booking"
    - Can immediately:
      A) Book different slot with same tutor
      B) Try different tutor
      C) Book same time with different tutor

Recovery: ✅ Slot reusable immediately


SCENARIO 3: NETWORK ERROR DURING BOOKING
══════════════════════════════════════════

Sales clicks "Book" → Network fails

Frontend:
  setTimeout waits for response
  → Timeout after 30 seconds
  → Show error: "Booking failed - please try again"

Database:
  Transaction rolled back
  Availability.status stays "available"  ← Automatic rollback
  Booking not created
  availabilityId stays available for others

User Experience:
  Sales sees error and can retry
  ✅ Slot not locked if request failed

Recovery: ✅ Automatic transaction rollback prevents hanging locks


SCENARIO 4: DUPLICATE REJECTION REQUEST
═════════════════════════════════════════

Tutor clicks "Reject" twice quickly

Server receives:
  Request 1: PUT /api/bookings/booking789/reject
  Request 2: PUT /api/bookings/booking789/reject

Processing:
  Request 1:
    → booking.status = "pending" ✅
    → Update to "cancelled" ✅
    → Commit ✅
  
  Request 2:
    → booking.status = "cancelled" (not "pending") ❌
    → Error: "Booking is already cancelled"
    → Return 400

Response to Request 2:
{
  success: false,
  message: "Booking is already cancelled or not found."
}

User Experience:
  Minor error message but booking still rejected
  ✅ No double-rejection, no conflicts

Recovery: ✅ Idempotent operation handling
*/

// ============================================================================
// PART 7: IMPLEMENTATION CHECKLIST
// ============================================================================

/*
✅ CONFLICT PREVENTION:
  ✅ Unique constraint on availabilityId in Booking
  ✅ Status check before booking
  ✅ MongoDB transactions for atomic operations
  ✅ Date validation (future dates only)
  ✅ Stock/lock mechanism (status: 'booked')

✅ DATA VISIBILITY:
  ✅ RBAC middleware (authorize by role)
  ✅ roleBasedDataVisibility middleware
  ✅ Query filtering by tutorId/salesId ownership
  ✅ Tutor only sees own availability
  ✅ Sales only sees their own bookings
  ✅ Sales can see all tutors' available slots

✅ SYNCHRONIZATION:
  ✅ Single source of truth (MongoDB)
  ✅ Automatic page refresh (10 second intervals)
  ✅ Status updates reflected on both sides
  ✅ Real-time slot availability

✅ ERROR HANDLING:
  ✅ Transaction rollback on error
  ✅ Proper error messages to users
  ✅ Idempotent operations (no double-reject)
  ✅ Network error recovery
  ✅ Validation before operations

✅ USER EXPERIENCE:
  ✅ Clear booking flow for sales
  ✅ Clear confirmation flow for tutors
  ✅ Rejection with slot reuse
  ✅ Status filters for bookings
  ✅ Tutor ratings and availability display
*/

module.exports = {
  workflowDocumentation: true
};
