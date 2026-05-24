import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface FormInstruction {
  id: number;
  text: string;
  order: number;
}

interface InstructionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructions: FormInstruction[];
  onSave: (instructions: FormInstruction[]) => void;
}

export function InstructionsModal({ open, onOpenChange, instructions, onSave }: InstructionsModalProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<FormInstruction[]>(() =>
    [...instructions].sort((a, b) => a.order - b.order)
  );
  const [newText, setNewText] = useState("");

  // Sync local state when modal opens with fresh data
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setItems([...instructions].sort((a, b) => a.order - b.order));
      setNewText("");
    }
    onOpenChange(val);
  };

  const addItem = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      toast({ title: "Too long", description: "Instruction must be under 500 characters.", variant: "destructive" });
      return;
    }
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems(prev => [...prev, { id: newId, text: trimmed, order: prev.length }]);
    setNewText("");
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id).map((i, idx) => ({ ...i, order: idx })));
  };

  const updateText = (id: number, text: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, text } : i));
  };

  const handleSave = () => {
    const invalid = items.find(i => !i.text.trim());
    if (invalid) {
      toast({ title: "Empty instruction", description: "Please fill in all instructions or remove empty ones.", variant: "destructive" });
      return;
    }
    onSave(items.map((i, idx) => ({ ...i, order: idx })));
    onOpenChange(false);
    toast({ title: "Instructions saved", description: `${items.length} instruction(s) saved.` });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            Pre-Form Instructions
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            These instructions will be shown to beneficiaries before they start filling the form. Add bullet points for required documents, important notes, etc.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
              No instructions added yet. Add your first instruction below.
            </div>
          )}
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-50" />
              <span className="text-sm text-muted-foreground w-5 flex-shrink-0">{idx + 1}.</span>
              <Input
                value={item.text}
                onChange={e => updateText(item.id, e.target.value)}
                maxLength={500}
                className="flex-1 h-9 text-sm"
                placeholder="Enter instruction..."
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add new instruction */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            maxLength={500}
            className="flex-1 h-9 text-sm"
            placeholder="Type a new instruction and press Enter or click Add..."
          />
          <Button variant="outline" size="sm" onClick={addItem} disabled={!newText.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-gradient-primary">
            <Save className="h-4 w-4 mr-2" />
            Save Instructions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
