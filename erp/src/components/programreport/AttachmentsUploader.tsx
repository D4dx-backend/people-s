import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Film, Image, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { programReports } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Attachment {
  _id: string;
  url: string;
  key: string;
  fileName: string;
  mimetype: string;
  size: number;
  kind: "image" | "video" | "pdf" | "other";
  uploadedAt: string;
}

interface AttachmentsUploaderProps {
  reportId: string;
  submissionId: string;
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  disabled?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindIcon(kind: string) {
  if (kind === "image") return <Image className="h-4 w-4" />;
  if (kind === "video") return <Film className="h-4 w-4" />;
  if (kind === "pdf") return <FileText className="h-4 w-4" />;
  return <Paperclip className="h-4 w-4" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AttachmentsUploader({
  reportId,
  submissionId,
  attachments,
  onChange,
  disabled = false,
}: AttachmentsUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      setUploadProgress(0);

      try {
        const result = await programReports.uploadAttachments(
          reportId,
          submissionId,
          files,
          (pct) => setUploadProgress(pct)
        );
        const newAttachments: Attachment[] = result.data?.attachments || result.attachments || [];
        onChange([...attachments, ...newAttachments]);
        toast({ title: `${newAttachments.length} file(s) uploaded successfully` });
      } catch (err: any) {
        toast({
          title: "Upload failed",
          description: err?.message || "Could not upload files",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
        setUploadProgress(0);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [reportId, submissionId, attachments, onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) uploadFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  };

  const handleDelete = async (att: Attachment) => {
    setDeletingIds((prev) => new Set([...prev, att._id]));
    try {
      await programReports.deleteAttachment(reportId, submissionId, att._id);
      onChange(attachments.filter((a) => a._id !== att._id));
      toast({ title: "Attachment removed" });
    } catch {
      toast({ title: "Failed to remove attachment", variant: "destructive" });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(att._id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {!disabled && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
            cursor-pointer p-6 transition-colors text-center
            ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"}
            ${uploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
              <Progress value={uploadProgress} className="w-40 h-1.5" />
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground">
                Images, videos, and PDFs — images will be auto-compressed
              </p>
            </>
          )}
        </div>
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {attachments.length} attachment{attachments.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {attachments.map((att) => (
              <div
                key={att._id}
                className="group relative rounded-lg border bg-muted/30 overflow-hidden"
              >
                {/* Preview */}
                {att.kind === "image" ? (
                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={att.url}
                      alt={att.fileName}
                      className="w-full h-24 object-cover"
                    />
                  </a>
                ) : (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-24 bg-muted hover:bg-muted/80 transition-colors"
                  >
                    <span className="text-muted-foreground">{kindIcon(att.kind)}</span>
                  </a>
                )}

                {/* Info overlay */}
                <div className="p-1.5 space-y-0.5">
                  <p className="text-xs truncate text-foreground leading-tight" title={att.fileName}>
                    {att.fileName}
                  </p>
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant="outline" className="text-[10px] capitalize py-0 h-4">
                      {att.kind}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatBytes(att.size)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                {!disabled && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleDelete(att); }}
                    disabled={deletingIds.has(att._id)}
                  >
                    {deletingIds.has(att._id) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
