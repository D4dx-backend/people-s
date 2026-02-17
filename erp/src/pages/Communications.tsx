import { Plus, Send, Mail, MessageSquare, Bell, Filter, Search, Paperclip, Users, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useRBAC } from "@/hooks/useRBAC";

const conversations = [
  {
    id: 1,
    applicant: "Mohammed Farhan",
    subject: "Scholarship Application Query",
    lastMessage: "Thank you for the clarification. I will submit the documents by tomorrow.",
    unread: 2,
    timestamp: "10:30 AM",
    status: "active",
  },
  {
    id: 2,
    applicant: "Zainab Khatoon",
    subject: "Medical Assistance Status",
    lastMessage: "When can I expect the approval decision?",
    unread: 1,
    timestamp: "Yesterday",
    status: "pending",
  },
  {
    id: 3,
    applicant: "Ibrahim Ali",
    subject: "Housing Support Documentation",
    lastMessage: "All documents have been uploaded as requested.",
    unread: 0,
    timestamp: "2 days ago",
    status: "resolved",
  },
];

const notifications = [
  { id: 1, type: "email", recipient: "All Donors", subject: "Monthly Newsletter - October 2025", status: "sent", date: "2025-10-01" },
  { id: 2, type: "sms", recipient: "Pending Applicants", subject: "Document Submission Reminder", status: "sent", date: "2025-09-30" },
  { id: 3, type: "whatsapp", recipient: "Unit Admins", subject: "Meeting Schedule Update", status: "scheduled", date: "2025-10-05" },
  { id: 4, type: "email", recipient: "Project Coordinators", subject: "Budget Review Meeting", status: "draft", date: "2025-10-03" },
];

const templates = [
  { id: 1, name: "Application Received", type: "email", category: "Applicant" },
  { id: 2, name: "Document Request", type: "sms", category: "Applicant" },
  { id: 3, name: "Application Approved", type: "email", category: "Applicant" },
  { id: 4, name: "Donation Receipt", type: "email", category: "Donor" },
  { id: 5, name: "Campaign Update", type: "whatsapp", category: "Donor" },
  { id: 6, name: "Meeting Reminder", type: "sms", category: "Staff" },
];

export default function Communications() {
  const { hasPermission } = useRBAC();
  
  // Permission check
  const canSendCommunications = hasPermission('communications.send');
  
  if (!canSendCommunications) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to access communications.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Communications</h1>
          <p className="text-muted-foreground mt-1">Manage messages, notifications, and campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
          <Button className="bg-gradient-primary shadow-glow">
            <Send className="mr-2 h-4 w-4" />
            Send Message
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Chats</p>
                <p className="text-3xl font-bold">24</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread Messages</p>
                <p className="text-3xl font-bold">8</p>
              </div>
              <Bell className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sent This Month</p>
                <p className="text-3xl font-bold">156</p>
              </div>
              <Send className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Templates</p>
                <p className="text-3xl font-bold">{templates.length}</p>
              </div>
              <Mail className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="space-y-3">
                  <CardTitle>Conversations</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-8" />
                  </div>
                  <Select defaultValue="all">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conversations</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-semibold text-sm">{conv.applicant}</p>
                        {conv.unread > 0 && (
                          <Badge className="bg-destructive h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                            {conv.unread}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{conv.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                      <p className="text-xs text-muted-foreground mt-1">{conv.timestamp}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mohammed Farhan</CardTitle>
                    <p className="text-sm text-muted-foreground">Scholarship Application Query</p>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-96 border rounded-lg p-4 space-y-4 overflow-y-auto">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      MF
                    </div>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm">Hello, I have a question about the scholarship application process.</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">10:15 AM</p>
                    </div>
                  </div>

                  <div className="flex gap-3 flex-row-reverse">
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                      You
                    </div>
                    <div className="flex-1 text-right">
                      <div className="bg-primary text-primary-foreground rounded-lg p-3 inline-block">
                        <p className="text-sm">Hello! I'd be happy to help. What would you like to know?</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">10:20 AM</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      MF
                    </div>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm">What documents do I need to submit with my application?</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">10:22 AM</p>
                    </div>
                  </div>

                  <div className="flex gap-3 flex-row-reverse">
                    <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                      You
                    </div>
                    <div className="flex-1 text-right">
                      <div className="bg-primary text-primary-foreground rounded-lg p-3 inline-block">
                        <p className="text-sm">You'll need: 1) ID proof, 2) Income certificate, 3) Academic records, 4) Bank details</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">10:25 AM</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      MF
                    </div>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm">Thank you for the clarification. I will submit the documents by tomorrow.</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">10:30 AM</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input placeholder="Type your message..." />
                  <Button variant="outline" size="icon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button className="bg-gradient-primary">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Notification History</CardTitle>
                <div className="flex gap-2">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-center justify-between border rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        notification.type === 'email' ? 'bg-info/10' :
                        notification.type === 'sms' ? 'bg-warning/10' :
                        'bg-success/10'
                      }`}>
                        {notification.type === 'email' ? <Mail className="h-5 w-5 text-info" /> :
                         notification.type === 'sms' ? <MessageSquare className="h-5 w-5 text-warning" /> :
                         <MessageSquare className="h-5 w-5 text-success" />}
                      </div>
                      <div>
                        <p className="font-semibold">{notification.subject}</p>
                        <p className="text-sm text-muted-foreground">To: {notification.recipient}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline"
                        className={
                          notification.status === 'sent' ? 'bg-success/10 text-success border-success/20' :
                          notification.status === 'scheduled' ? 'bg-info/10 text-info border-info/20' :
                          'bg-muted text-muted-foreground border-muted'
                        }
                      >
                        {notification.status}
                      </Badge>
                      <Button variant="outline" size="sm">View</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compose">
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Message Type</Label>
                  <Select defaultValue="email">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="notification">In-App Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Recipient Group</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_donors">All Donors</SelectItem>
                      <SelectItem value="all_applicants">All Applicants</SelectItem>
                      <SelectItem value="pending_apps">Pending Applicants</SelectItem>
                      <SelectItem value="coordinators">Project Coordinators</SelectItem>
                      <SelectItem value="admins">All Admins</SelectItem>
                      <SelectItem value="custom">Custom List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Input placeholder="Enter message subject" />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea 
                  placeholder="Type your message here..." 
                  rows={8}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="schedule" />
                <Label htmlFor="schedule" className="text-sm">Schedule for later</Label>
              </div>

              <div className="flex gap-2">
                <Button className="bg-gradient-primary">
                  <Send className="mr-2 h-4 w-4" />
                  Send Now
                </Button>
                <Button variant="outline">
                  Save as Draft
                </Button>
                <Button variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-4 hover:shadow-elegant transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {template.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Category: {template.category}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Use Template
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
