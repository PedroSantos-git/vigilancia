/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Teacher, Room, Exam, Allocation } from "../types";

export interface AllocationResult {
  allocations: Allocation[];
  notifications: Array<{
    teacherId: string;
    message: string;
  }>;
  warnings: string[];
}

/**
 * Checks if a teacher has a subject conflict with the exam.
 * Portuguese guidelines generally avoid having teachers invigilate exams of their own specialty.
 */
/**
 * Checks if a teacher has a subject conflict with the exam.
 * Business Rule: Allocation/Exclusion must be based on subject_group, not subject name.
 * This handles cases like Group 600 (Artes Visuais) invigilating Desenho, Geometria, etc.
 */
export function hasSubjectConflict(teacher: Teacher, exam: Exam): boolean {
  const teacherGroup = String(teacher.subject_group || "").trim();
  const examGroup = String(exam.subject_group || "").trim();

  // If both groups are defined, strictly exclude if they match
  if (teacherGroup && examGroup && teacherGroup === examGroup) {
    return true;
  }

  // Fallback (Security): if for some reason group is missing, we check the name
  // to avoid major national rule violations
  const teacherSubj = teacher.subject.toLowerCase().trim();
  const examName = exam.name.toLowerCase().trim();
  if (examName.includes(teacherSubj)) return true;

  return false;
}

/**
 * Helper to add minutes to a time string "HH:mm".
 */
export function addMinutes(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins + minutes, 0, 0);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Checks if two time ranges overlap.
 */
export function isTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1.localeCompare(end1) < 0 && start2.localeCompare(end2) < 0 && 
         start1.localeCompare(end2) < 0 && start2.localeCompare(end1) < 0;
}

/**
 * Runs the auto-distribution of rooms for all exams.
 */
export function autoAllocateRooms(
  exams: Exam[],
  rooms: Room[]
): Exam[] {
  const sortedRooms = [...rooms].sort((a, b) => a.priority - b.priority);
  
  // Sort exams by priority: Regular first, then by date/time
  const sortedExams = [...exams].sort((a, b) => {
    const isSpecialA = (a.variant || "").includes("LNM") || (a.modality && a.modality !== "");
    const isSpecialB = (b.variant || "").includes("LNM") || (b.modality && b.modality !== "");
    
    if (isSpecialA !== isSpecialB) return isSpecialA ? 1 : -1;
    
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const updatedExams = [...exams];

  sortedExams.forEach(exam => {
    const roomsNeeded = exam.roomsNeeded || 1;
    const currentRooms = exam.roomIds || [];
    
    if (currentRooms.length >= roomsNeeded) return;

    const roomsToAssign: string[] = [...currentRooms];

    for (const room of sortedRooms) {
      if (roomsToAssign.length >= roomsNeeded) break;
      if (roomsToAssign.includes(room.id)) continue;

      // Check if room is available
      const isAvailable = updatedExams.every(otherEx => {
        if (!otherEx.roomIds?.includes(room.id) || otherEx.date !== exam.date || otherEx.id === exam.id) return true;

        const otherStart = otherEx.time;
        const otherEndWithBuffer = addMinutes(otherStart, (otherEx.duration || 120) + (otherEx.tolerance || 30) + 45);
        
        const currentStart = exam.time;
        const currentEndWithBuffer = addMinutes(currentStart, (exam.duration || 120) + (exam.tolerance || 30) + 45);

        // Standard overlap check with buffer
        return !isTimeOverlap(currentStart, currentEndWithBuffer, otherStart, otherEndWithBuffer);
      });

      if (isAvailable) {
        roomsToAssign.push(room.id);
      }
    }

    // Update the exam in the result array
    const idx = updatedExams.findIndex(e => e.id === exam.id);
    if (idx !== -1) {
      updatedExams[idx] = { ...updatedExams[idx], roomIds: roomsToAssign };
    }
  });

  return updatedExams;
}

/**
 * Resolves a period ("09:00" or "14:00") from any custom hour string (e.g., "09:30" => "09:00").
 */
export function getPeriodFromTime(time: string): "09:00" | "14:00" {
  if (!time) return "09:00";
  if (time === "09:00" || time === "14:00") return time;
  
  const parts = time.split(':');
  if (parts.length > 0) {
    const hour = parseInt(parts[0], 10);
    if (!isNaN(hour)) {
      return hour < 12 ? "09:00" : "14:00";
    }
  }
  
  const lower = time.toLowerCase();
  if (lower.includes('tarde') || lower.includes('afternoon') || lower.includes('pm')) {
    return "14:00";
  }
  return "09:00";
}

/**
 * Checks if a teacher has registered a personal unavailability for a specific date and time.
 */
export function isTeacherUnavailableAt(teacher: Teacher, date: string, time: string): boolean {
  if (!teacher.unavailabilities) return false;
  const period = getPeriodFromTime(time);
  return teacher.unavailabilities.some(un => 
    un.date === date && (un.time === "all" || un.time === period)
  );
}

/**
 * Runs the auto-distribution of teachers for a set of rooms on a specific exam.
 * Attempts to fill Invigilator 1, Invigilator 2, and Substitute for each room.
 */
export function autoAllocate(
  exam: Exam,
  rooms: Room[],
  teachers: Teacher[],
  allAllocations: Allocation[], // Existing allocations across ALL exams
  currentExamAllocations: Allocation[], // Allocations just for this exam
  allExams: Exam[] // Needed to check dates of other allocations
): AllocationResult {
  const resultAllocations: Allocation[] = [...currentExamAllocations];
  const logsArr: Array<{ teacherId: string; message: string }> = [];
  const warnings: string[] = [];

  const STEALTH_NAME = "Pedro Miguel Freitas dos Santos";

  // 0. Prepare teacher fatigue map (Rule 8: Pool exhaustion)
  const fatigueMap = new Map<string, number>();
  teachers.forEach(t => fatigueMap.set(t.id, 0));
  allAllocations.forEach(a => {
    if (a.invigilator1Id) fatigueMap.set(a.invigilator1Id, (fatigueMap.get(a.invigilator1Id) || 0) + 1);
    if (a.invigilator2Id) fatigueMap.set(a.invigilator2Id, (fatigueMap.get(a.invigilator2Id) || 0) + 1);
    if (a.substituteId) fatigueMap.set(a.substituteId, (fatigueMap.get(a.substituteId) || 0) + 1);
  });

  // 1. Identify teachers busy on the SAME DAY (Rule 4: Avoid same day even different hour)
  const busyOnSameDay = new Set<string>();
  allAllocations.forEach(a => {
    const otherExam = allExams.find(e => e.id === a.examId);
    if (otherExam && otherExam.date === exam.date && otherExam.id !== exam.id) {
      if (a.invigilator1Id) busyOnSameDay.add(a.invigilator1Id);
      if (a.invigilator2Id) busyOnSameDay.add(a.invigilator2Id);
      if (a.substituteId) busyOnSameDay.add(a.substituteId);
    }
  });

  // Track assigned teachers during this specific allocation call
  const assignedInThisBatch = new Set<string>();
  currentExamAllocations.forEach(alloc => {
    if (alloc.invigilator1Id) assignedInThisBatch.add(alloc.invigilator1Id);
    if (alloc.invigilator2Id) assignedInThisBatch.add(alloc.invigilator2Id);
    if (alloc.substituteId) assignedInThisBatch.add(alloc.substituteId);
  });

  // 2. Filter Pool based on business rules
  const pool = teachers.filter(t => {
    // Rule: Role must be "Professor" or empty
    const tRole = (t.role || "").toLowerCase();
    const hasNoSpecialRole = tRole === "" || tRole === "professor";
    if (!t.available || !hasNoSpecialRole) return false;

    // Rule: Personal unavailabilities
    if (isTeacherUnavailableAt(t, exam.date, exam.time)) return false;

    // Rule: One exam per day
    if (busyOnSameDay.has(t.id)) return false;

    // Rule: Pedro Stealth Rule (part 1: exclude from main pool)
    if (t.name === STEALTH_NAME) return false;

    return true;
  });

  // 3. Sort pool by fatigue (exhaustion rule) and then shuffle within same fatigue levels
  const sortedPool = [...pool].sort((a, b) => {
    const fatigueA = fatigueMap.get(a.id) || 0;
    const fatigueB = fatigueMap.get(b.id) || 0;
    if (fatigueA !== fatigueB) return fatigueA - fatigueB;
    return Math.random() - 0.5;
  });

  // 4. Room Priority Assignment (Rule: assign rooms by priority)
  // Standard exams get high priority rooms. LNM/Modalities get lower priority.
  const isSpecialExam = (exam.variant || "").includes("LNM") || (exam.modality && exam.modality !== "");
  const sortedRooms = [...rooms].sort((a, b) => {
    return isSpecialExam ? b.priority - a.priority : a.priority - b.priority;
  });

  // 5. Allocation process
  sortedRooms.forEach(room => {
    let alloc = resultAllocations.find(a => a.roomId === room.id && a.examId === exam.id);
    if (!alloc) {
      alloc = {
        id: `${exam.id}_${room.id}`,
        examId: exam.id,
        roomId: room.id,
        invigilator1Id: null,
        invigilator2Id: null,
        substituteId: null
      };
      resultAllocations.push(alloc);
    }

    const positions: Array<'invigilator1Id' | 'invigilator2Id'> = ['invigilator1Id', 'invigilator2Id'];
    positions.forEach(pos => {
      if (alloc && !alloc[pos]) {
        let candidate = sortedPool.find(t => !assignedInThisBatch.has(t.id) && !hasSubjectConflict(t, exam));
        
        // Fallback: use anyone from pool if conflict is unavoidable
        if (!candidate) {
          candidate = sortedPool.find(t => !assignedInThisBatch.has(t.id));
          if (candidate) {
            warnings.push(`Conflito disciplinar inevitável: ${candidate.name} alocado em ${room.name}.`);
          }
        }

        if (candidate) {
          alloc[pos] = candidate.id;
          assignedInThisBatch.add(candidate.id);
          logsArr.push({
            teacherId: candidate.id,
            message: `Vigilante ${pos === 'invigilator1Id' ? '1' : '2'} em ${room.name} (${exam.name}).`
          });
        }
      }
    });
  });

  // 6. Allocate Substitutes (Rule: Pedro can be chosen as last resort here)
  sortedRooms.forEach(room => {
    const alloc = resultAllocations.find(a => a.roomId === room.id && a.examId === exam.id);
    if (alloc && !alloc.substituteId) {
      let candidate = sortedPool.find(t => !assignedInThisBatch.has(t.id) && !hasSubjectConflict(t, exam));
      
      if (!candidate) {
        candidate = sortedPool.find(t => !assignedInThisBatch.has(t.id));
      }

      // Rule: Pedro Stealth Rule (part 2: last resort for substitute)
      if (!candidate) {
        const pedro = teachers.find(t => t.name === STEALTH_NAME);
        if (pedro && !assignedInThisBatch.has(pedro.id) && !busyOnSameDay.has(pedro.id) && !isTeacherUnavailableAt(pedro, exam.date, exam.time)) {
          candidate = pedro;
        }
      }

      if (candidate) {
        alloc.substituteId = candidate.id;
        assignedInThisBatch.add(candidate.id);
        logsArr.push({
          teacherId: candidate.id,
          message: `Suplente em ${room.name} (${exam.name}).`
        });
      }
    }
  });

  return {
    allocations: resultAllocations,
    notifications: logsArr,
    warnings
  };
}
