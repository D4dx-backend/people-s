import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Type, AlignLeft, Hash, Mail, Phone, Calendar, 
  CheckSquare, List, Circle, Upload, Heading1,
  Code, Users, Table, Layout
} from "lucide-react";

interface AddFieldPopoverProps {
  onAddField: (fieldType: string) => void;
}

const fieldTypes = [
  { type: "text", label: "Text", icon: Type },
  { type: "textarea", label: "Long Text", icon: AlignLeft },
  { type: "number", label: "Number", icon: Hash },
  { type: "email", label: "Email", icon: Mail },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "date", label: "Date", icon: Calendar },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "select", label: "Dropdown", icon: List },
  { type: "radio", label: "Radio", icon: Circle },
  { type: "file", label: "File Upload", icon: Upload },
  { type: "title", label: "Title", icon: Heading1 },
  // { type: "html", label: "HTML", icon: Code },
  // { type: "group", label: "Group", icon: Users },
  { type: "row", label: "Row/Column", icon: Table },
];

export function AddFieldPopover({ onAddField }: AddFieldPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full border-dashed hover:border-primary hover:bg-primary/5"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="center">
        <div className="grid grid-cols-3 gap-1">
          {fieldTypes.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className="h-auto flex-col gap-1 p-2 hover:bg-primary/10"
              onClick={() => onAddField(type)}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
