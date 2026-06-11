import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
  Eraser,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { uploadSingleFile } from '@/utils/fileUploadHelper';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface UploadedEditorImage {
  url: string;
  key: string;
  caption?: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Called whenever an image is uploaded so the parent can track keys/urls. */
  onImageUploaded?: (image: UploadedEditorImage) => void;
  placeholder?: string;
  /** Spaces folder for uploaded images. */
  uploadFolder?: string;
  className?: string;
}

/**
 * Dependency-free rich text editor built on contentEditable.
 * Supports bold/italic/underline, headings, lists, links and image upload.
 * Emits an HTML string via onChange. The HTML is sanitised on render
 * (see SafeHtml) and on the server before persisting where appropriate.
 */
export function RichTextEditor({
  value,
  onChange,
  onImageUploaded,
  placeholder = 'Write your message…',
  uploadFolder = 'notifications',
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Initialise / sync external value without clobbering the caret while typing.
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const handleLink = () => {
    const url = window.prompt('Enter the URL (include https://)');
    if (!url) return;
    exec('createLink', url);
  };

  const handleImageButton = () => fileInputRef.current?.click();

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image.', variant: 'destructive' });
      return;
    }
    try {
      setUploading(true);
      const uploaded = await uploadSingleFile(file, { folder: uploadFolder });
      editorRef.current?.focus();
      // Insert the image at the current caret position.
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${uploaded.url}" alt="${uploaded.originalName || ''}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`,
      );
      emitChange();
      onImageUploaded?.({ url: uploaded.url, key: uploaded.key });
      toast({ title: 'Image uploaded', description: 'Image inserted into the message.' });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Could not upload image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const ToolbarButton = ({
    onClick,
    title,
    children,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input p-1">
        <ToolbarButton onClick={() => exec('bold')} title="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} title="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} title="Underline">
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton onClick={() => exec('formatBlock', '<h2>')} title="Heading">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton onClick={handleLink} title="Insert link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleImageButton} title="Insert image">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ToolbarButton onClick={() => exec('removeFormat')} title="Clear formatting">
          <Eraser className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        className={cn(
          'prose prose-sm max-w-none min-h-[180px] px-3 py-2 text-sm focus:outline-none',
          'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
        )}
        suppressContentEditableWarning
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
    </div>
  );
}

export default RichTextEditor;
