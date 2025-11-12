import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download } from "lucide-react";
import { Button } from "./ui/button";

interface MediaAsset {
  id: string;
  file_type: 'image' | 'pdf';
  storage_path: string;
}

export const MediaPreview = ({ asset }: { asset: MediaAsset }) => {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const getUrl = async () => {
      const { data } = await supabase.storage
        .from('ticket-attachments')
        .createSignedUrl(asset.storage_path, 3600); // 1 hour expiry
      
      if (data) {
        setUrl(data.signedUrl);
      }
    };

    getUrl();
  }, [asset.storage_path]);

  const handleDownload = () => {
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.storage_path.split('/').pop() || 'download';
      link.click();
    }
  };

  if (asset.file_type === 'image') {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img 
          src={url} 
          alt="Attachment" 
          className="max-w-full rounded-md hover:opacity-90 transition-opacity cursor-pointer"
          style={{ maxHeight: '300px' }}
        />
      </a>
    ) : (
      <div className="bg-muted rounded-md p-4 animate-pulse">Loading image...</div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-md p-3">
      <FileText className="h-5 w-5" />
      <span className="flex-1 text-sm truncate">
        {asset.storage_path.split('/').pop()}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDownload}
        disabled={!url}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
};