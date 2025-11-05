import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, ExternalLink, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  label?: string;
  "data-testid"?: string;
}

export function ObjectUploader({
  value,
  onChange,
  accept,
  label = "Upload File",
  "data-testid": dataTestId,
}: ObjectUploaderProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      // Get upload URL from backend
      const response = await fetch("/api/objects/upload", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL } = await response.json();

      // Upload file to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Set ACL policy for the uploaded file
      const aclResponse = await fetch("/api/objects/set-acl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objectURL: uploadURL,
          visibility: "private",
        }),
      });

      if (!aclResponse.ok) {
        throw new Error("Failed to set file permissions");
      }

      const { objectPath } = await aclResponse.json();
      onChange(objectPath);
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          value={value || ""}
          placeholder="No file selected"
          readOnly
          className="flex-1"
          data-testid={dataTestId}
        />
        {value && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => window.open(value, "_blank")}
              title="View file"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange("")}
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        )}
        <label htmlFor={`file-upload-${dataTestId}`}>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            asChild
          >
            <span>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : label}
            </span>
          </Button>
        </label>
        <input
          id={`file-upload-${dataTestId}`}
          type="file"
          accept={accept}
          onChange={handleUpload}
          className="sr-only"
        />
      </div>
    </div>
  );
}
