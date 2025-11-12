import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Send, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const NewTicket = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 5 * 1024 * 1024;
      
      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an image or PDF`,
          variant: "destructive",
        });
      }
      if (!isValidSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
      }
      
      return isValidType && isValidSize;
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !subject.trim() || !message.trim()) return;

    setIsLoading(true);

    try {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          student_id: user.id,
          subject: subject.trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create first message
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          message_type: 'text',
          content: message.trim(),
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Upload files if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${messageData.id}/${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket-attachments')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Create media asset record
          const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';
          const { error: mediaError } = await supabase
            .from('media_assets')
            .insert({
              message_id: messageData.id,
              file_type: fileType,
              storage_path: fileName
            });

          if (mediaError) throw mediaError;
        }
      }

      toast({
        title: 'Ticket created!',
        description: 'Your complaint has been submitted successfully.',
      });

      navigate(`/ticket/${ticket.id}`);
    } catch (error: any) {
      toast({
        title: 'Error creating ticket',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Complaint</CardTitle>
            <CardDescription>
              Describe your issue and our staff will help you as soon as possible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Provide details about your issue..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={8}
                  className="resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  Be as detailed as possible to help us understand your issue
                </p>
              </div>

              {/* File attachments */}
              <div className="space-y-2">
                <Label>Attachments (optional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="new-ticket-files"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Files
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Images and PDFs only (max 5MB each)
                  </span>
                </div>
                
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md">
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isLoading || !subject.trim() || !message.trim()}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Complaint
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default NewTicket;