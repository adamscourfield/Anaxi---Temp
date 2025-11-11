import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSchool } from "@/hooks/use-school";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Archive, ArchiveRestore, Plus, Upload, AlertCircle, ShieldX, Search } from "lucide-react";
import { useMemo } from "react";
import type { Student, Oncall, SchoolMembership } from "@shared/schema";
import { CsvColumnMapper } from "@/components/csv-column-mapper";

const addStudentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  send: z.boolean().default(false),
  pp: z.boolean().default(false),
});

type AddStudentFormValues = z.infer<typeof addStudentSchema>;

const completeOncallSchema = z.object({
  completionNotes: z.string().min(1, "Completion notes are required"),
});

type CompleteOncallFormValues = z.infer<typeof completeOncallSchema>;

export default function BehaviourManagementPage() {
  const { currentSchool, currentSchoolId } = useSchool();
  const { user, isCreator } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("students");
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [importCsvDialogOpen, setImportCsvDialogOpen] = useState(false);
  const [completeOncallDialogOpen, setCompleteOncallDialogOpen] = useState(false);
  const [selectedOncallId, setSelectedOncallId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"week" | "month" | "year" | "custom">("week");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][]; mappings: Record<string, string> } | null>(null);
  const [isCsvValid, setIsCsvValid] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Get user's memberships to check permissions
  const { data: userMemberships = [] } = useQuery<Array<SchoolMembership & { school?: any }>>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user && !isCreator,
  });

  const currentMembership = userMemberships.find(m => m.schoolId === currentSchoolId);
  const canManageBehaviour = isCreator || currentMembership?.canManageBehaviour || false;
  
  // Check if school has behaviour feature enabled
  const hasBehaviourFeature = currentSchool?.enabled_features?.includes("behaviour") || false;

  // Handle deep linking from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oncallId = params.get("oncall_id");
    if (oncallId) {
      setActiveTab("oncalls");
      setSelectedOncallId(oncallId);
      setCompleteOncallDialogOpen(true);
    }
  }, []);

  // Fetch students
  const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/schools", currentSchoolId, "students"],
    enabled: !!currentSchoolId && canManageBehaviour,
  });

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students;
    
    const query = studentSearchQuery.toLowerCase();
    return students.filter(student => 
      student.name.toLowerCase().includes(query)
    );
  }, [students, studentSearchQuery]);

  // Fetch oncalls
  const { data: oncalls = [], isLoading: isLoadingOncalls } = useQuery<Array<Oncall & { student?: Student, requestedBy?: any, completedBy?: any }>>({
    queryKey: ["/api/schools", currentSchoolId, "oncalls"],
    enabled: !!currentSchoolId && canManageBehaviour,
  });

  // Calculate date range for analytics using Europe/London timezone
  const { startDate, endDate } = useMemo(() => {
    const timezone = "Europe/London";
    const now = new Date();
    const londonNow = toZonedTime(now, timezone);
    
    let daysToSubtract: number;
    switch (dateRange) {
      case "week":
        daysToSubtract = 7;
        break;
      case "month":
      case "custom": // For now, custom uses month logic
        daysToSubtract = 30;
        break;
      case "year":
        daysToSubtract = 365;
        break;
      default:
        daysToSubtract = 7;
    }
    
    const start = startOfDay(subDays(londonNow, daysToSubtract));
    const end = endOfDay(londonNow);
    
    // Convert back to UTC for API
    const startUTC = fromZonedTime(start, timezone);
    const endUTC = fromZonedTime(end, timezone);
    
    return {
      startDate: startUTC.toISOString(),
      endDate: endUTC.toISOString(),
    };
  }, [dateRange]);

  // Fetch analytics data
  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery<{
    byCompleter: Array<{ name: string; count: number; userId: string }>;
    byStudent: Array<{ name: string; open: number; completed: number }>;
    timeOfDay: Array<{ hour: number; count: number }>;
    dayOfWeek: Array<{ day: string; count: number }>;
    totalOncalls: number;
    openOncalls: number;
    completedOncalls: number;
  }>({
    queryKey: ["/api/schools", currentSchoolId, "oncalls", "analytics", startDate, endDate],
    queryFn: async () => {
      const url = `/api/schools/${currentSchoolId}/oncalls/analytics?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!currentSchoolId && canManageBehaviour && activeTab === "analytics",
  });

  // Form for adding student
  const addStudentForm = useForm<AddStudentFormValues>({
    resolver: zodResolver(addStudentSchema),
    defaultValues: {
      name: "",
      send: false,
      pp: false,
    },
  });

  // Form for completing oncall
  const completeOncallForm = useForm<CompleteOncallFormValues>({
    resolver: zodResolver(completeOncallSchema),
    defaultValues: {
      completionNotes: "",
    },
  });

  // Add student mutation
  const addStudentMutation = useMutation({
    mutationFn: async (data: AddStudentFormValues) => {
      return apiRequest("POST", `/api/schools/${currentSchoolId}/students`, data);
    },
    onSuccess: () => {
      toast({
        title: "Student added successfully",
      });
      addStudentForm.reset();
      setAddStudentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "students"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add student",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Archive/Unarchive student mutation
  const archiveStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return apiRequest("PATCH", `/api/students/${studentId}/archive`);
    },
    onSuccess: () => {
      toast({
        title: "Student status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "students"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update student status",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Import CSV mutation
  const importCsvMutation = useMutation({
    mutationFn: async (csvData: Array<{ name: string; send: boolean; pp: boolean }>) => {
      return apiRequest("POST", `/api/schools/${currentSchoolId}/students/import-csv`, { csvData });
    },
    onSuccess: () => {
      toast({
        title: "Students imported successfully",
      });
      setCsvData(null);
      setIsCsvValid(false);
      setImportCsvDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "students"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to import students",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Complete oncall mutation
  const completeOncallMutation = useMutation({
    mutationFn: async ({ id, completionNotes }: { id: string; completionNotes: string }) => {
      return apiRequest("PATCH", `/api/oncalls/${id}/complete`, { completionNotes });
    },
    onSuccess: () => {
      toast({
        title: "On-Call completed successfully",
      });
      completeOncallForm.reset();
      setCompleteOncallDialogOpen(false);
      setSelectedOncallId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "oncalls"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete On-Call",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Handle CSV file upload with column mapping
  const handleCsvUpload = () => {
    if (!csvData || !isCsvValid) {
      toast({
        title: "Please upload and map a valid CSV file",
        variant: "destructive",
      });
      return;
    }

    try {
      const { rows, mappings } = csvData;
      
      // Helper function to normalize boolean values
      const parseBoolean = (value: string): boolean => {
        if (!value) return false;
        const normalized = value.trim().toLowerCase().replace(/['"]/g, '');
        return ['yes', 'true', '1', 'y'].includes(normalized);
      };

      // Build the student data from mapped columns
      const studentData: Array<{ name: string; send: boolean; pp: boolean }> = rows.map(row => {
        const getColumnValue = (fieldKey: string): string => {
          const headerName = mappings[fieldKey];
          if (!headerName) return '';
          const headerIndex = csvData.headers.indexOf(headerName);
          return headerIndex >= 0 ? (row[headerIndex] || '') : '';
        };

        return {
          name: getColumnValue('name').trim(),
          send: parseBoolean(getColumnValue('send')),
          pp: parseBoolean(getColumnValue('pp')),
        };
      }).filter(student => student.name); // Only include rows with a name

      if (studentData.length === 0) {
        toast({
          title: "No valid data found in CSV",
          description: "Please ensure at least one row has a student name",
          variant: "destructive",
        });
        return;
      }

      importCsvMutation.mutate(studentData);
    } catch (error) {
      toast({
        title: "Failed to process CSV file",
        description: "Please ensure the file is properly mapped",
        variant: "destructive",
      });
    }
  };

  const onAddStudent = (data: AddStudentFormValues) => {
    addStudentMutation.mutate(data);
  };

  const onCompleteOncall = (data: CompleteOncallFormValues) => {
    if (selectedOncallId) {
      completeOncallMutation.mutate({
        id: selectedOncallId,
        completionNotes: data.completionNotes,
      });
    }
  };

  const formatDateTime = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const londonTime = toZonedTime(dateObj, "Europe/London");
    return format(londonTime, "dd/MM/yyyy HH:mm");
  };

  if (!hasBehaviourFeature || !canManageBehaviour) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5" />
              Access Restricted
            </CardTitle>
            <CardDescription>
              {!hasBehaviourFeature 
                ? "Behaviour management is not enabled for this school."
                : "You do not have permission to access the Behaviour Management page."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {!hasBehaviourFeature
                ? "Please contact your school administrator to enable this feature."
                : "Please contact your school administrator if you believe you should have access."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentSchool) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Behaviour Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage students and behaviour incidents for {currentSchool.name}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="students" data-testid="tab-students">Students</TabsTrigger>
            <TabsTrigger value="oncalls" data-testid="tab-oncalls">On-Calls</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            <div className="flex gap-3">
              <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-student">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Student</DialogTitle>
                    <DialogDescription>
                      Add a new student to the behaviour management system.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...addStudentForm}>
                    <form onSubmit={addStudentForm.handleSubmit(onAddStudent)} className="space-y-4">
                      <FormField
                        control={addStudentForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter student name..." {...field} data-testid="input-student-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addStudentForm.control}
                        name="send"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-send"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>SEND (Special Educational Needs and Disabilities)</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addStudentForm.control}
                        name="pp"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-pp"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>PP (Pupil Premium)</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAddStudentDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={addStudentMutation.isPending}
                          data-testid="button-confirm-add-student"
                        >
                          {addStudentMutation.isPending ? "Adding..." : "Add Student"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Dialog open={importCsvDialogOpen} onOpenChange={setImportCsvDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-import-csv">
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Import Students from CSV</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file and map the columns to import student data. Required field: Student Name. Optional fields: SEND, PP.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <CsvColumnMapper
                      requiredFields={[
                        { key: "name", label: "Student Name", required: true },
                        { key: "send", label: "SEND", required: false },
                        { key: "pp", label: "PP (Pupil Premium)", required: false },
                      ]}
                      onFileLoad={(data) => setCsvData(data)}
                      onValidationChange={(isValid) => setIsCsvValid(isValid)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setImportCsvDialogOpen(false);
                        setCsvData(null);
                        setIsCsvValid(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCsvUpload}
                      disabled={!isCsvValid || importCsvMutation.isPending}
                      data-testid="button-confirm-import-csv"
                    >
                      {importCsvMutation.isPending ? "Importing..." : "Import"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Students</CardTitle>
                    <CardDescription>
                      {filteredStudents.length} {filteredStudents.length !== students.length ? `of ${students.length}` : ""} student{students.length !== 1 ? "s" : ""} 
                      {filteredStudents.length !== students.length && " (filtered)"}
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search students..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-students"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingStudents ? (
                  <div className="text-center py-8 text-muted-foreground">Loading students...</div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No students found. Add a student to get started.
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No students match your search query.
                  </div>
                ) : (
                  <Table data-testid="table-students">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>SEND</TableHead>
                        <TableHead>PP</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>
                            {student.send ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.pp ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.isArchived ? (
                              <Badge variant="secondary">Archived</Badge>
                            ) : (
                              <Badge variant="default">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => archiveStudentMutation.mutate(student.id)}
                              disabled={archiveStudentMutation.isPending}
                              data-testid={`button-archive-student-${student.id}`}
                            >
                              {student.isArchived ? (
                                <>
                                  <ArchiveRestore className="h-4 w-4 mr-2" />
                                  Unarchive
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="oncalls" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>On-Call Incidents</CardTitle>
                <CardDescription>
                  {oncalls.length} incident{oncalls.length !== 1 ? "s" : ""} recorded
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingOncalls ? (
                  <div className="text-center py-8 text-muted-foreground">Loading on-calls...</div>
                ) : oncalls.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No on-call incidents recorded yet.
                  </div>
                ) : (
                  <Table data-testid="table-oncalls">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created At</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Completed By</TableHead>
                        <TableHead>Completed At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oncalls.map((oncall) => (
                        <TableRow key={oncall.id}>
                          <TableCell>{formatDateTime(oncall.createdAt)}</TableCell>
                          <TableCell>{oncall.student?.name || "Unknown"}</TableCell>
                          <TableCell>{oncall.location}</TableCell>
                          <TableCell className="max-w-xs truncate">{oncall.description}</TableCell>
                          <TableCell>
                            {oncall.requestedBy
                              ? `${oncall.requestedBy.first_name} ${oncall.requestedBy.last_name}`
                              : "Unknown"}
                          </TableCell>
                          <TableCell>
                            {oncall.status === "open" ? (
                              <Badge variant="destructive">Open</Badge>
                            ) : (
                              <Badge variant="default">Completed</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {oncall.completedBy
                              ? `${oncall.completedBy.first_name} ${oncall.completedBy.last_name}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {oncall.completedAt ? formatDateTime(oncall.completedAt) : "-"}
                          </TableCell>
                          <TableCell>
                            {oncall.status === "open" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOncallId(oncall.id);
                                  setCompleteOncallDialogOpen(true);
                                }}
                                data-testid={`button-complete-oncall-${oncall.id}`}
                              >
                                Mark as Complete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Dialog open={completeOncallDialogOpen} onOpenChange={setCompleteOncallDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Complete On-Call</DialogTitle>
                  <DialogDescription>
                    Add notes about how this incident was resolved.
                  </DialogDescription>
                </DialogHeader>
                <Form {...completeOncallForm}>
                  <form onSubmit={completeOncallForm.handleSubmit(onCompleteOncall)} className="space-y-4">
                    <FormField
                      control={completeOncallForm.control}
                      name="completionNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Completion Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe how the incident was resolved..."
                              className="min-h-[120px]"
                              {...field}
                              data-testid="textarea-completion-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCompleteOncallDialogOpen(false);
                          setSelectedOncallId(null);
                          completeOncallForm.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={completeOncallMutation.isPending}
                        data-testid="button-confirm-complete"
                      >
                        {completeOncallMutation.isPending ? "Completing..." : "Complete"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Filter</CardTitle>
                <CardDescription>Select a date range to view analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Select value={dateRange} onValueChange={(value) => setDateRange(value as typeof dateRange)}>
                    <SelectTrigger className="w-48" data-testid="select-date-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                      <SelectItem value="year">Last 365 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {isLoadingAnalytics ? (
              <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid gap-6 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total On-Calls</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="stat-total-oncalls">
                        {analyticsData?.totalOncalls || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-muted-foreground">Open On-Calls</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="stat-open-oncalls">
                        {analyticsData?.openOncalls || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-muted-foreground">Completed On-Calls</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="stat-completed-oncalls">
                        {analyticsData?.completedOncalls || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Visualizations */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* On-Calls by Teacher */}
                  <Card>
                    <CardHeader>
                      <CardTitle>On-Calls by Teacher</CardTitle>
                      <CardDescription>Top 10 teachers who completed on-calls</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!analyticsData?.byCompleter || analyticsData.byCompleter.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground" data-testid="empty-by-teacher">
                          No completed on-calls in this period
                        </div>
                      ) : (
                        <Table data-testid="table-by-teacher">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Teacher Name</TableHead>
                              <TableHead className="text-right">Completed On-Calls</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analyticsData.byCompleter.slice(0, 10).map((teacher, index) => (
                              <TableRow key={teacher.userId || index} data-testid={`row-teacher-${index}`}>
                                <TableCell className="font-medium">{teacher.name}</TableCell>
                                <TableCell className="text-right">{teacher.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Students with Most On-Calls */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Students with Most On-Calls</CardTitle>
                      <CardDescription>Top 10 students by total on-calls</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!analyticsData?.byStudent || analyticsData.byStudent.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground" data-testid="empty-by-student">
                          No on-calls in this period
                        </div>
                      ) : (
                        <Table data-testid="table-by-student">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student Name</TableHead>
                              <TableHead className="text-right">Open</TableHead>
                              <TableHead className="text-right">Completed</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analyticsData.byStudent.slice(0, 10).map((student, index) => {
                              const total = student.open + student.completed;
                              return (
                                <TableRow key={index} data-testid={`row-student-${index}`}>
                                  <TableCell className="font-medium">{student.name}</TableCell>
                                  <TableCell className="text-right">{student.open}</TableCell>
                                  <TableCell className="text-right">{student.completed}</TableCell>
                                  <TableCell className="text-right font-medium">{total}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Time of Day Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Time of Day Distribution</CardTitle>
                      <CardDescription>When incidents occur most frequently</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!analyticsData?.timeOfDay || analyticsData.timeOfDay.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground" data-testid="empty-time-of-day">
                          No on-calls in this period
                        </div>
                      ) : (
                        <div className="space-y-2" data-testid="chart-time-of-day">
                          <div className="flex items-end justify-between gap-1 h-40">
                            {Array.from({ length: 24 }, (_, hour) => {
                              const data = analyticsData.timeOfDay.find(d => d.hour === hour);
                              const count = data?.count || 0;
                              const maxCount = Math.max(...analyticsData.timeOfDay.map(d => d.count), 1);
                              const heightPercent = (count / maxCount) * 100;
                              
                              return (
                                <div key={hour} className="flex flex-col items-center flex-1 gap-1">
                                  <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                                    {count > 0 && (
                                      <div
                                        className="w-full bg-primary rounded-t"
                                        style={{ height: `${heightPercent}%` }}
                                        title={`${hour}:00 - ${count} on-calls`}
                                      />
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{hour}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground text-center pt-2">Hour of Day (0-23)</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Day of Week Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Day of Week Distribution</CardTitle>
                      <CardDescription>Incident patterns throughout the week</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!analyticsData?.dayOfWeek || analyticsData.dayOfWeek.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground" data-testid="empty-day-of-week">
                          No on-calls in this period
                        </div>
                      ) : (
                        <div className="space-y-2" data-testid="chart-day-of-week">
                          <div className="flex items-end justify-between gap-2 h-40">
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                              const data = analyticsData.dayOfWeek.find(d => d.day === day);
                              const count = data?.count || 0;
                              const maxCount = Math.max(...analyticsData.dayOfWeek.map(d => d.count), 1);
                              const heightPercent = (count / maxCount) * 100;
                              
                              return (
                                <div key={day} className="flex flex-col items-center flex-1 gap-1">
                                  <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                                    {count > 0 && (
                                      <div
                                        className="w-full bg-primary rounded-t"
                                        style={{ height: `${heightPercent}%` }}
                                        title={`${day} - ${count} on-calls`}
                                      />
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{day.substring(0, 3)}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground text-center pt-2">Day of Week</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
