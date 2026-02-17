import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  Clock, 
  CheckCircle,
  DollarSign,
  Edit,
  Info
} from "lucide-react";

export default function TimelineDemo() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold">Distribution Timeline Accordion</h1>
          <p className="text-muted-foreground mt-2">
            Interactive accordion component for managing and displaying money distribution timelines
          </p>
        </div>

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Timeline Tracking</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Track payment phases with due dates and completion status
            </p>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium">Status Management</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Visual status indicators for pending, in-progress, and completed steps
            </p>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-yellow-500" />
              <span className="font-medium">Amount Calculation</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Automatic calculation of payment amounts based on percentages
            </p>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Edit className="h-5 w-5 text-purple-500" />
              <span className="font-medium">Interactive Actions</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Edit, view, and manage individual timeline steps
            </p>
          </Card>
        </div>
      </div>

      {/* Empty State - No Mock Data */}
      <EmptyState
        icon={Info}
        title="Timeline Component Demo"
        description="This component is used throughout the application to display distribution timelines for approved applications. To see it in action, navigate to an approved application with a configured distribution timeline."
      />
    </div>
  );
}
