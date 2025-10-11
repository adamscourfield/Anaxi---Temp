import { useParams, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Users } from "lucide-react";
import { useState } from "react";
import { TeacherObservationsPanel } from "@/components/teacher-observations-panel";
import { ObservationDetailsPanel } from "@/components/observation-details-panel";

interface Teacher {
  id: string;
  name: string;
  initials: string;
  totalObservations: number;
  weeklyObservations: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  maxScore: number;
}

interface TeachingGroup {
  id: string;
  name: string;
  groupLead: {
    name: string;
    initials: string;
  };
  teachers: Teacher[];
}

export default function TeachingGroupDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);

  const teachingGroups: TeachingGroup[] = [
    {
      id: "1",
      name: "English Department",
      groupLead: {
        name: "Sarah Mitchell",
        initials: "SM",
      },
      teachers: [
        {
          id: "t1",
          name: "Sarah Mitchell",
          initials: "SM",
          totalObservations: 12,
          weeklyObservations: 3,
          avgScore: 4.5,
          highestScore: 5.0,
          lowestScore: 4.0,
          maxScore: 5,
        },
        {
          id: "t2",
          name: "David Brown",
          initials: "DB",
          totalObservations: 8,
          weeklyObservations: 2,
          avgScore: 4.2,
          highestScore: 4.8,
          lowestScore: 3.5,
          maxScore: 5,
        },
        {
          id: "t3",
          name: "Jennifer Lee",
          initials: "JL",
          totalObservations: 10,
          weeklyObservations: 2,
          avgScore: 4.7,
          highestScore: 5.0,
          lowestScore: 4.2,
          maxScore: 5,
        },
        {
          id: "t4",
          name: "Michael Taylor",
          initials: "MT",
          totalObservations: 6,
          weeklyObservations: 1,
          avgScore: 3.8,
          highestScore: 4.5,
          lowestScore: 3.0,
          maxScore: 5,
        },
        {
          id: "t5",
          name: "Amy Wilson",
          initials: "AW",
          totalObservations: 9,
          weeklyObservations: 2,
          avgScore: 4.4,
          highestScore: 4.9,
          lowestScore: 3.8,
          maxScore: 5,
        },
      ],
    },
    {
      id: "2",
      name: "Mathematics",
      groupLead: {
        name: "James Chen",
        initials: "JC",
      },
      teachers: [
        {
          id: "t6",
          name: "James Chen",
          initials: "JC",
          totalObservations: 10,
          weeklyObservations: 2,
          avgScore: 4.3,
          highestScore: 4.9,
          lowestScore: 3.7,
          maxScore: 5,
        },
        {
          id: "t7",
          name: "Rachel Green",
          initials: "RG",
          totalObservations: 7,
          weeklyObservations: 1,
          avgScore: 4.0,
          highestScore: 4.6,
          lowestScore: 3.4,
          maxScore: 5,
        },
        {
          id: "t8",
          name: "Tom Harris",
          initials: "TH",
          totalObservations: 9,
          weeklyObservations: 2,
          avgScore: 4.1,
          highestScore: 4.7,
          lowestScore: 3.5,
          maxScore: 5,
        },
        {
          id: "t9",
          name: "Lisa Martinez",
          initials: "LM",
          totalObservations: 5,
          weeklyObservations: 1,
          avgScore: 3.9,
          highestScore: 4.4,
          lowestScore: 3.2,
          maxScore: 5,
        },
      ],
    },
    {
      id: "3",
      name: "Science Team",
      groupLead: {
        name: "Emily Rodriguez",
        initials: "ER",
      },
      teachers: [
        {
          id: "t10",
          name: "Emily Rodriguez",
          initials: "ER",
          totalObservations: 11,
          weeklyObservations: 3,
          avgScore: 4.6,
          highestScore: 5.0,
          lowestScore: 4.1,
          maxScore: 5,
        },
        {
          id: "t11",
          name: "Brian Johnson",
          initials: "BJ",
          totalObservations: 8,
          weeklyObservations: 2,
          avgScore: 4.2,
          highestScore: 4.8,
          lowestScore: 3.6,
          maxScore: 5,
        },
        {
          id: "t12",
          name: "Nina Patel",
          initials: "NP",
          totalObservations: 10,
          weeklyObservations: 2,
          avgScore: 4.5,
          highestScore: 4.9,
          lowestScore: 3.9,
          maxScore: 5,
        },
        {
          id: "t13",
          name: "Chris Anderson",
          initials: "CA",
          totalObservations: 7,
          weeklyObservations: 1,
          avgScore: 4.0,
          highestScore: 4.5,
          lowestScore: 3.3,
          maxScore: 5,
        },
        {
          id: "t14",
          name: "Sophie Clark",
          initials: "SC",
          totalObservations: 9,
          weeklyObservations: 2,
          avgScore: 4.3,
          highestScore: 4.8,
          lowestScore: 3.7,
          maxScore: 5,
        },
        {
          id: "t15",
          name: "Mark Thompson",
          initials: "MT",
          totalObservations: 6,
          weeklyObservations: 1,
          avgScore: 3.8,
          highestScore: 4.3,
          lowestScore: 3.1,
          maxScore: 5,
        },
      ],
    },
  ];

  const allObservations = [
    {
      id: "obs1",
      teacherId: "t1",
      teacherName: "Sarah Mitchell",
      teacherInitials: "SM",
      observerName: "John Smith",
      date: new Date("2024-03-15"),
      lessonTopic: "Shakespeare's Macbeth",
      classInfo: "Year 10 English",
      categories: [
        {
          name: "Entrance & Do Now",
          score: 3,
          maxScore: 4,
          habits: [
            { text: "Clear learning objectives displayed", observed: true },
            { text: "Starter activity engages students", observed: true },
            { text: "Register taken efficiently", observed: true },
            { text: "Resources ready", observed: false },
          ],
        },
        {
          name: "Direct Instruction",
          score: 3,
          maxScore: 3,
          habits: [
            { text: "Clear explanations", observed: true },
            { text: "Good use of examples", observed: true },
            { text: "Checks for understanding", observed: true },
          ],
        },
        {
          name: "Application",
          score: 2,
          maxScore: 3,
          habits: [
            { text: "Independent practice", observed: true },
            { text: "Differentiated tasks", observed: false },
            { text: "Time for consolidation", observed: true },
          ],
        },
      ],
      totalScore: 8,
      totalMaxScore: 10,
    },
    {
      id: "obs2",
      teacherId: "t1",
      teacherName: "Sarah Mitchell",
      teacherInitials: "SM",
      observerName: "Emily Brown",
      date: new Date("2024-03-10"),
      lessonTopic: "Creative Writing",
      classInfo: "Year 9 English",
      categories: [
        {
          name: "Entrance & Do Now",
          score: 3,
          maxScore: 4,
          habits: [
            { text: "Clear learning objectives displayed", observed: true },
            { text: "Starter activity engages students", observed: true },
            { text: "Register taken efficiently", observed: true },
            { text: "Resources ready", observed: false },
          ],
        },
        {
          name: "Checking Understanding",
          score: 4,
          maxScore: 4,
          habits: [
            { text: "Questions varied", observed: true },
            { text: "Wait time appropriate", observed: true },
            { text: "Probing questions used", observed: true },
            { text: "All students engaged", observed: true },
          ],
        },
      ],
      totalScore: 7,
      totalMaxScore: 8,
    },
    {
      id: "obs3",
      teacherId: "t2",
      teacherName: "David Brown",
      teacherInitials: "DB",
      observerName: "Sarah Mitchell",
      date: new Date("2024-03-14"),
      lessonTopic: "Poetry Analysis",
      classInfo: "Year 11 English",
      categories: [
        {
          name: "Direct Instruction",
          score: 2,
          maxScore: 3,
          habits: [
            { text: "Clear explanations", observed: true },
            { text: "Good use of examples", observed: true },
            { text: "Checks for understanding", observed: false },
          ],
        },
        {
          name: "Application",
          score: 4,
          maxScore: 5,
          habits: [
            { text: "Independent practice", observed: true },
            { text: "Differentiated tasks", observed: true },
            { text: "Time for consolidation", observed: true },
            { text: "Peer assessment", observed: true },
            { text: "Extension tasks available", observed: false },
          ],
        },
      ],
      totalScore: 6,
      totalMaxScore: 8,
    },
  ];

  const currentGroup = teachingGroups.find((g) => g.id === id);
  const selectedTeacher = selectedTeacherId
    ? currentGroup?.teachers.find(t => t.id === selectedTeacherId)
    : null;
  const teacherObservations = selectedTeacherId
    ? allObservations.filter(obs => obs.teacherId === selectedTeacherId)
    : [];
  const selectedObservation = selectedObservationId
    ? allObservations.find(obs => obs.id === selectedObservationId)
    : null;

  if (!currentGroup) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Teaching Group Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{currentGroup.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">
                  {currentGroup.groupLead.initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                Lead: {currentGroup.groupLead.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Switch Group:</span>
          <Select
            value={id}
            onValueChange={(newId) => setLocation(`/teaching-groups/${newId}`)}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teachingGroups.map((group) => (
                <SelectItem key={group.id} value={group.id} data-testid={`select-option-group-${group.id}`}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-[hsl(var(--teal)_/_0.1)] flex items-center justify-center">
              <Users className="h-4 w-4 text-[hsl(var(--teal))]" />
            </div>
            Team Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-center">Total Observations</TableHead>
                <TableHead className="text-center">This Week</TableHead>
                <TableHead className="text-center">Average Score</TableHead>
                <TableHead className="text-center">Highest Score</TableHead>
                <TableHead className="text-center">Lowest Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentGroup.teachers.map((teacher) => {
                const avgPercentage = teacher.maxScore > 0
                  ? Math.round((teacher.avgScore / teacher.maxScore) * 100)
                  : 0;
                const highPercentage = teacher.maxScore > 0
                  ? Math.round((teacher.highestScore / teacher.maxScore) * 100)
                  : 0;
                const lowPercentage = teacher.maxScore > 0
                  ? Math.round((teacher.lowestScore / teacher.maxScore) * 100)
                  : 0;

                return (
                  <TableRow 
                    key={teacher.id} 
                    data-testid={`row-teacher-${teacher.id}`}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedTeacherId(teacher.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {teacher.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{teacher.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-total-obs-${teacher.id}`}>
                      {teacher.totalObservations}
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-weekly-obs-${teacher.id}`}>
                      {teacher.weeklyObservations}
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-avg-score-${teacher.id}`}>
                      <Badge
                        variant="secondary"
                        className={`${
                          avgPercentage >= 80
                            ? "bg-[hsl(var(--success)_/_0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)_/_0.2)]"
                            : ""
                        }`}
                      >
                        {avgPercentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-high-score-${teacher.id}`}>
                      <Badge
                        variant="secondary"
                        className={`${
                          highPercentage >= 80
                            ? "bg-[hsl(var(--success)_/_0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)_/_0.2)]"
                            : ""
                        }`}
                      >
                        {highPercentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-low-score-${teacher.id}`}>
                      <Badge variant="secondary">
                        {lowPercentage}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TeacherObservationsPanel
        isOpen={selectedTeacherId !== null}
        onClose={() => setSelectedTeacherId(null)}
        teacherName={selectedTeacher?.name || ""}
        observations={teacherObservations}
        onObservationClick={(obsId) => {
          setSelectedTeacherId(null);
          setSelectedObservationId(obsId);
        }}
      />

      <ObservationDetailsPanel
        isOpen={selectedObservationId !== null}
        onClose={() => setSelectedObservationId(null)}
        observation={selectedObservation}
      />
    </div>
  );
}
