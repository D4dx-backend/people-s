import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

interface SafeHtmlProps {
  html: string;
  className?: string;
}

/**
 * Renders user-authored HTML safely by sanitising it with DOMPurify
 * before injecting via dangerouslySetInnerHTML. Prevents XSS from the
 * rich-text editor / stored notification content.
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  const clean = DOMPurify.sanitize(html || '', {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form'],
  });

  return (
    <div
      className={cn('prose prose-sm max-w-none', className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export default SafeHtml;
