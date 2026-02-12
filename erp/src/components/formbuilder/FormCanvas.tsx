import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { FieldEditor } from "./FieldEditor";
import { AddFieldPopover } from "./AddFieldPopover";

interface Field {
  id: number;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  options?: string[];
  validation?: string;
  columns?: number;
  columnTitles?: string[];
  rows?: number;
  rowTitles?: string[];
  conditionalLogic?: {
    field: number;
    operator: string;
    value: string;
  };
  pageId?: number;
}

interface Page {
  id: number;
  title: string;
  fields: Field[];
}

interface FormCanvasProps {
  pages: Page[];
  onUpdatePages: (pages: Page[]) => void;
  onAddField: (pageId: number, field: Field) => void;
}

export function FormCanvas({ pages, onUpdatePages, onAddField }: FormCanvasProps) {
  const [activePage, setActivePage] = useState(0);

  const addPage = () => {
    const newPage: Page = {
      id: Math.max(...pages.map(p => p.id), 0) + 1,
      title: `Page ${pages.length + 1}`,
      fields: []
    };
    onUpdatePages([...pages, newPage]);
  };

  const deletePage = (pageId: number) => {
    if (pages.length === 1) return; // Don't delete the last page
    onUpdatePages(pages.filter(p => p.id !== pageId));
  };

  const updateField = (pageId: number, updatedField: Field) => {
    const newPages = pages.map(page => {
      if (page.id === pageId) {
        return {
          ...page,
          fields: page.fields.map(f => f.id === updatedField.id ? updatedField : f)
        };
      }
      return page;
    });
    onUpdatePages(newPages);
  };

  const deleteField = (pageId: number, fieldId: number) => {
    const newPages = pages.map(page => {
      if (page.id === pageId) {
        return {
          ...page,
          fields: page.fields.filter(f => f.id !== fieldId)
        };
      }
      return page;
    });
    onUpdatePages(newPages);
  };

  const moveField = (pageId: number, fieldId: number, direction: 'up' | 'down') => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    const index = page.fields.findIndex(f => f.id === fieldId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === page.fields.length - 1)) return;

    const newFields = [...page.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];

    const newPages = pages.map(p => {
      if (p.id === pageId) {
        return { ...p, fields: newFields };
      }
      return p;
    });
    onUpdatePages(newPages);
  };

  const addFieldAtPosition = (pageId: number, fieldType: string, afterFieldId?: number) => {
    const newField: Field = {
      id: Math.max(...pages.flatMap(p => p.fields.map(f => f.id)), 0) + 1,
      label: `New ${fieldType} Field`,
      type: fieldType,
      required: false,
      enabled: true,
      pageId,
      ...(['select', 'radio', 'checkbox', 'dropdown', 'multiselect'].includes(fieldType) ? {
        options: [
          { label: 'Option 1', value: 'option_1' },
          { label: 'Option 2', value: 'option_2' }
        ]
      } : {}),
      ...(fieldType === 'row' ? {
        columns: 2,
        columnTitles: ['', ''],
        rows: 3,
        rowTitles: ['', '', '']
      } : {})
    };

    const newPages = pages.map(page => {
      if (page.id === pageId) {
        if (afterFieldId !== undefined) {
          const index = page.fields.findIndex(f => f.id === afterFieldId);
          const newFields = [...page.fields];
          newFields.splice(index + 1, 0, newField);
          return { ...page, fields: newFields };
        } else {
          return { ...page, fields: [...page.fields, newField] };
        }
      }
      return page;
    });
    onUpdatePages(newPages);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activePage.toString()} onValueChange={(v) => setActivePage(parseInt(v))}>
        <div className="flex items-center justify-between">
          <TabsList>
            {pages.map((page, idx) => (
              <TabsTrigger key={page.id} value={idx.toString()}>
                {page.title}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button size="sm" variant="outline" onClick={addPage}>
            <Plus className="h-4 w-4 mr-2" />
            Add Page
          </Button>
        </div>

        {pages.map((page, idx) => (
          <TabsContent key={page.id} value={idx.toString()} className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={page.title}
                  onChange={(e) => {
                    const newPages = pages.map(p => 
                      p.id === page.id ? { ...p, title: e.target.value } : p
                    );
                    onUpdatePages(newPages);
                  }}
                  className="text-lg font-semibold bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
                />
                {pages.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deletePage(page.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {page.fields.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No fields added yet</p>
                    <AddFieldPopover onAddField={(type) => addFieldAtPosition(page.id, type)} />
                  </div>
                ) : (
                  <>
                    {page.fields.map((field, fieldIdx) => (
                      <div key={field.id} className="space-y-2">
                        <FieldEditor
                          field={field}
                          onUpdate={(f) => updateField(page.id, f)}
                          onDelete={(id) => deleteField(page.id, id)}
                          onMoveUp={fieldIdx > 0 ? () => moveField(page.id, field.id, 'up') : undefined}
                          onMoveDown={fieldIdx < page.fields.length - 1 ? () => moveField(page.id, field.id, 'down') : undefined}
                          availableFields={pages.flatMap(p => p.fields).filter(f => f.id !== field.id)}
                        />
                        <AddFieldPopover onAddField={(type) => addFieldAtPosition(page.id, type, field.id)} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
