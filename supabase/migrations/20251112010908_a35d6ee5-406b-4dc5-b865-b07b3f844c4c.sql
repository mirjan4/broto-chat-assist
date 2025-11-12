-- Create storage bucket for ticket attachments (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can view files from accessible tickets
CREATE POLICY "Users can view files from accessible tickets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ticket-attachments' AND (
    EXISTS (
      SELECT 1 FROM public.messages
      JOIN public.tickets ON messages.ticket_id = tickets.id
      JOIN public.media_assets ON media_assets.message_id = messages.id
      WHERE media_assets.storage_path = storage.objects.name
      AND (tickets.student_id = auth.uid() OR has_role(auth.uid(), 'staff'))
    )
  )
);

-- Storage RLS: Users can upload files for their messages
CREATE POLICY "Users can upload files for their messages"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Remove voice-messages bucket (not needed for MVP)
DELETE FROM storage.buckets WHERE id = 'voice-messages';