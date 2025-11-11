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
import { format } from "date-fns";
import { Archive, ArchiveRestore, Plus, Upload, AlertCircle } from "lucide-react";
import type { Student, Oncall, SchoolMembership } from "@shared/schema";

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
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Get user's memberships to check permissions
  const { data: userMemberships = [] } = useQuery<Array<SchoolMembership & { school?: any }>>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user && !isCreator,
  });

  const currentMembership = userMemberships.find(m => m.schoolId === currentSchoolId);
  const canManageBehaviour = isCreator || currentMembership?.canManageBehaviour || false;

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

  // Fetch oncalls
  const { data: oncalls = [], isLoading: isLoadingOncalls } = useQuery<Array<Oncall & { student?: Student, requestedBy?: any, completedBy?: any }>>({
    queryKey: ["/api/schools", currentSchoolId, "oncalls"],
    enabled: !!currentSchoolId && canManageBehaviour,
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
      return apiRequest(`/api/schools/${currentSchoolId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
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
      return apiRequest(`/api/students/${studentId}/archive`, {
        method: "PATCH",
      });
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
      return apiRequest(`/api/schools/${currentSchoolId}/students/import-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Students imported successfully",
      });
      setCsvFile(null);
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
      return apiRequest(`/api/oncalls/${id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completionNotes }),
      });
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

  // Handle CSV file upload
  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast({
        title: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await csvFile.text();
      const lines = text.split("\n").filter(line => line.trim());
      const csvData: Array<{ name: string; send: boolean; pp: boolean }> = [];

      // Skip header row, parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        if (values.length >= 3) {
          csvData.push({
            name: values[0],
            send: values[1].toLowerCase() === "yes" || values[1] === "true" || values[1] === "1",
            pp: values[2].toLowerCase() === "yes" || values[2] === "true" || values[2] === "1",
          });
        }
      }

      if (csvData.length === 0) {
        toast({
          title: "No valid data found in CSV",
          variant: "destructive",
        });
        return;
      }

      importCsvMutation.mutate(csvData);
    } catch (error) {
      toast({
        title: "Failed to parse CSV file",
        description: "Please ensure the file is valid",
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
    return format(dateObj, "dd/MM/yyyy HH:mm");
  };

  if (!canManageBehaviour) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              You do not have permission to access the Behaviour Management page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please contact your school administrator if you believe you should have access.
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Students from CSV</DialogTitle>
                    <DialogDescription>
                      Upload a CSV file with student data. The file should have three columns: Name, SEND, PP.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-md">
                      <p className="text-sm font-medium mb-2">CSV Format Example:</p>
                      <pre className="text-xs">
{`Name,SEND,PP
John Smith,Yes,No
Jane Doe,No,Yes
Bob Johnson,No,No`}
                      </pre>
                    </div>
                    <div>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                        data-testid="input-csv-file"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setImportCsvDialogOpen(false);
                        setCsvFile(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCsvUpload}
                      disabled={!csvFile || importCsvMutation.isPending}
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
                <CardTitle>Students</CardTitle>
                <CardDescription>
                  {students.length} student{students.length !== 1 ? "s" : ""} in the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStudents ? (
                  <div className="text-center py-8 text-muted-foreground">Loading students...</div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No students found. Add a student to get started.
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
                      {students.map((student) => (
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
                  <Select defaultValue="week">
                    <SelectTrigger className="w-48" data-testid="select-date-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>On-Calls by Teacher</CardTitle>
                  <CardDescription>Most on-calls raised by staff member</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p>Analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Students with Most On-Calls</CardTitle>
                  <CardDescription>Frequently involved students</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p>Analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Time of Day Distribution</CardTitle>
                  <CardDescription>When incidents occur most frequently</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p>Analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Day of Week Distribution</CardTitle>
                  <CardDescription>Incident patterns throughout the week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p>Analytics coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
