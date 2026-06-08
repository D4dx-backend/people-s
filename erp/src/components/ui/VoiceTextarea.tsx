import React, { forwardRef, useRef } from 'react';
import { Textarea } from './textarea';
import VoiceToTextButton from './VoiceToTextButton';
import { cn } from '@/lib/utils';

type TextareaProps = React.ComponentPropsWithoutRef<typeof Textarea>;

interface VoiceTextareaProps extends TextareaProps {
  /** Override to manually handle the transcript. If provided, the automatic append is skipped. */
  onVoiceTranscript?: (text: string) => void;
}

/**
 * VoiceTextarea — Textarea with an integrated VoiceToTextButton.
 *
 * Works with both controlled components and React Hook Form field spreads.
 * The voice button is automatically hidden when the textarea is disabled or readOnly.
 */
const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
  ({ onChange, value, disabled, readOnly, className, onVoiceTranscript, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);
    // Always holds the latest committed value. Updated on every render from the
    // controlled `value` prop AND synchronously whenever we append voice text.
    // This prevents rapid voice callbacks from reading a stale `value` (which
    // would cause words to overwrite each other due to React state batching).
    const latestValueRef = useRef<string>(typeof value === 'string' ? value : '');

    // Keep the ref in sync with the controlled value on each render.
    latestValueRef.current =
      typeof value === 'string' ? value : (latestValueRef.current ?? '');

    const setRef = (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const handleTranscript = (text: string) => {
      if (onVoiceTranscript) {
        onVoiceTranscript(text);
        return;
      }
      if (!onChange) return;

      const currentVal = latestValueRef.current ?? '';
      // Append with a single space separator, trimming any duplicate spacing.
      const needsSpace = currentVal && !currentVal.endsWith(' ');
      const newVal = (needsSpace ? currentVal + ' ' : currentVal) + text;

      // Update the ref immediately so the next rapid call sees the new value.
      latestValueRef.current = newVal;

      // Build a synthetic event compatible with both regular onChange handlers
      // (e.g. (e) => setState(e.target.value)) and React Hook Form field.onChange.
      const syntheticEvent = {
        target: { value: newVal },
        currentTarget: { value: newVal },
        type: 'change',
        bubbles: true,
        persist: () => {},
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>;

      onChange(syntheticEvent);
    };

    const showVoiceButton = !disabled && !readOnly;

    return (
      <div className="relative">
        <Textarea
          ref={setRef}
          value={value}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          className={cn(showVoiceButton ? 'pr-11' : '', className)}
          {...props}
        />
        {showVoiceButton && (
          <VoiceToTextButton
            onTranscript={handleTranscript}
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-60 hover:opacity-100 transition-opacity"
          />
        )}
      </div>
    );
  }
);

VoiceTextarea.displayName = 'VoiceTextarea';

export default VoiceTextarea;
