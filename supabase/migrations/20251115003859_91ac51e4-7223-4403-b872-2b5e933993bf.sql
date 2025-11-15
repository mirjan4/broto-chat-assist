-- Update ticket_status enum to include in_progress and rename resolved to completed
ALTER TYPE ticket_status RENAME TO ticket_status_old;

CREATE TYPE ticket_status AS ENUM ('pending', 'in_progress', 'completed');

-- Update the tickets table to use the new enum
ALTER TABLE tickets 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE ticket_status USING 
    CASE 
      WHEN status::text = 'resolved' THEN 'completed'::ticket_status
      ELSE status::text::ticket_status
    END,
  ALTER COLUMN status SET DEFAULT 'pending'::ticket_status;

DROP TYPE ticket_status_old;

-- Add comment for clarity
COMMENT ON TYPE ticket_status IS 'Ticket status: pending (new), in_progress (being worked on), completed (resolved)';

-- Add index for better query performance on status
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);