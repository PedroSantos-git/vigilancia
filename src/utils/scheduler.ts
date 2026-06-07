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

type AllocationRoleKey = "invigilator1Id" | "invigilator2Id" | "substituteId";

const ROLE_LABEL_PT: Record<AllocationRoleKey, string> = {
  invigilator1Id: "Vigilante 1",
  invigilator2Id: "Vigilante 2",
  substituteId: "Suplente"
};

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function hasNoSpecialRole(teacher: Teacher): boolean {
  const role = normalizeText(teacher.role);
  return role === "" || role === "professor" || role === "teacher";
}

function isTeacherUnavailableOnDate(teacher: Teacher, date: string): boolean {
  if (!teacher.unavailabilities || teacher.unavailabilities.length === 0) return false;
  return teacher.unavailabilities.some(un => un.date === date);
}

function getSortedPairs(exams: Exam[], rooms: Room[]): Array<{ exam: Exam; room: Room }> {
  const roomById = new Map(rooms.map(room => [room.id, room]));
  const sortedExams = [...exams].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.time !== b.time) return a.time.localeCompare(b.time);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.id.localeCompare(b.id);
  });

  const pairs: Array<{ exam: Exam; room: Room }> = [];
  for (const exam of sortedExams) {
    if (!Array.isArray(exam.roomIds) || exam.roomIds.length === 0) continue;
    const examRooms = exam.roomIds
      .map(roomId => roomById.get(roomId))
      .filter((room): room is Room => Boolean(room))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });

    for (const room of examRooms) {
      pairs.push({ exam, room });
    }
  }

  return pairs;
}

function allocationKey(examId: string, roomId: string): string {
  return `${examId}::${roomId}`;
}

function buildDayBusySet(allocations: Allocation[], examById: Map<string, Exam>): Set<string> {
  const busySet = new Set<string>();
  for (const alloc of allocations) {
    const exam = examById.get(alloc.examId);
    if (!exam) continue;

    const assigned = [alloc.invigilator1Id, alloc.invigilator2Id, alloc.substituteId];
    for (const teacherId of assigned) {
      if (teacherId) busySet.add(`${teacherId}@@${exam.date}`);
    }
  }
  return busySet;
}

function markAllocationBusy(
  allocation: Allocation,
  exam: Exam,
  dayBusy: Set<string>
): void {
  const assigned = [allocation.invigilator1Id, allocation.invigilator2Id, allocation.substituteId];
  for (const teacherId of assigned) {
    if (!teacherId) continue;
    dayBusy.add(`${teacherId}@@${exam.date}`);
  }
}

function randomPick<T>(list: T[]): T {
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function getAssignmentCount(assignmentCounts: Map<string, number>, teacherId: string): number {
  return assignmentCounts.get(teacherId) || 0;
}

function incrementAssignmentCount(assignmentCounts: Map<string, number>, teacherId: string | null): void {
  if (!teacherId) return;
  if (!assignmentCounts.has(teacherId)) return;
  assignmentCounts.set(teacherId, getAssignmentCount(assignmentCounts, teacherId) + 1);
}

function pickCandidateForPhase(
  candidates: Teacher[],
  _basePool: Teacher[],
  assignmentCounts: Map<string, number>
): Teacher | null {
  if (candidates.length === 0) return null;

  const minAssignedCount = Math.min(...candidates.map(teacher => getAssignmentCount(assignmentCounts, teacher.id)));
  const leastUsedPool = candidates.filter(teacher => getAssignmentCount(assignmentCounts, teacher.id) === minAssignedCount);
  return randomPick(leastUsedPool);
}

function runAutoAllocationForPairs(
  pairs: Array<{ exam: Exam; room: Room }>,
  teachers: Teacher[],
  baselineAllocations: Allocation[],
  existingTargetAllocations: Allocation[],
  allExams: Exam[]
): AllocationResult {
  const examById = new Map(allExams.map(exam => [exam.id, exam]));
  const basePool = teachers.filter(t => t.available && hasNoSpecialRole(t));
  const targetAllocationByKey = new Map<string, Allocation>();
  const warnings: string[] = [];
  const notifications: Array<{ teacherId: string; message: string }> = [];
  const dayBusy = buildDayBusySet(baselineAllocations, examById);
  const assignmentCounts = new Map<string, number>();
  basePool.forEach(teacher => assignmentCounts.set(teacher.id, 0));

  baselineAllocations.forEach(allocation => {
    incrementAssignmentCount(assignmentCounts, allocation.invigilator1Id);
    incrementAssignmentCount(assignmentCounts, allocation.invigilator2Id);
    incrementAssignmentCount(assignmentCounts, allocation.substituteId);
  });

  for (const alloc of existingTargetAllocations) {
    targetAllocationByKey.set(allocationKey(alloc.examId, alloc.roomId), { ...alloc });
    incrementAssignmentCount(assignmentCounts, alloc.invigilator1Id);
    incrementAssignmentCount(assignmentCounts, alloc.invigilator2Id);
    incrementAssignmentCount(assignmentCounts, alloc.substituteId);
  }

  for (const pair of pairs) {
    const key = allocationKey(pair.exam.id, pair.room.id);
    if (!targetAllocationByKey.has(key)) {
      targetAllocationByKey.set(key, {
        id: `${pair.exam.id}_${pair.room.id}`,
        examId: pair.exam.id,
        roomId: pair.room.id,
        invigilator1Id: null,
        invigilator2Id: null,
        substituteId: null
      });
    }
  }

  for (const pair of pairs) {
    const key = allocationKey(pair.exam.id, pair.room.id);
    const alloc = targetAllocationByKey.get(key);
    if (!alloc) continue;
    markAllocationBusy(alloc, pair.exam, dayBusy);
  }

  const phases: AllocationRoleKey[] = ["invigilator1Id", "invigilator2Id", "substituteId"];
  for (const phase of phases) {
    for (const pair of pairs) {
      const key = allocationKey(pair.exam.id, pair.room.id);
      const alloc = targetAllocationByKey.get(key);
      if (!alloc || alloc[phase]) continue;

      const alreadyInRoom = new Set([
        alloc.invigilator1Id,
        alloc.invigilator2Id,
        alloc.substituteId
      ]);
      const dayKeySuffix = `@@${pair.exam.date}`;

      const allowedByRules = basePool.filter(teacher => {
        if (alreadyInRoom.has(teacher.id)) return false;
        if (hasSubjectConflict(teacher, pair.exam)) return false;
        if (isTeacherUnavailableOnDate(teacher, pair.exam.date)) return false;
        if (dayBusy.has(`${teacher.id}${dayKeySuffix}`)) return false;
        return true;
      });

      const selected = pickCandidateForPhase(allowedByRules, basePool, assignmentCounts);

      if (!selected) {
        warnings.push(
          `Sem docente elegível para ${ROLE_LABEL_PT[phase]} em ${pair.room.name} (${pair.exam.name}, ${pair.exam.date}).`
        );
        continue;
      }

      alloc[phase] = selected.id;
      dayBusy.add(`${selected.id}${dayKeySuffix}`);
      incrementAssignmentCount(assignmentCounts, selected.id);
      notifications.push({
        teacherId: selected.id,
        message: `${ROLE_LABEL_PT[phase]} em ${pair.room.name} - ${pair.exam.name} (${pair.exam.date}).`
      });
    }
  }

  return {
    allocations: pairs
      .map(pair => targetAllocationByKey.get(allocationKey(pair.exam.id, pair.room.id)))
      .filter((alloc): alloc is Allocation => Boolean(alloc)),
    notifications,
    warnings
  };
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
  const teacherSubj = String(teacher.subject || "").toLowerCase().trim();
  const examName = String(exam.name || "").toLowerCase().trim();
  if (teacherSubj && examName.includes(teacherSubj)) return true;

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
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });

  const examWithRooms: Exam = {
    ...exam,
    roomIds: sortedRooms.map(room => room.id)
  };

  const baselineAllocations = allAllocations.filter(a => a.examId !== exam.id);
  return runAutoAllocationForPairs(
    getSortedPairs([examWithRooms], sortedRooms),
    teachers,
    baselineAllocations,
    currentExamAllocations,
    allExams
  );
}

/**
 * Runs automatic invigilator allocation for all exams globally.
 * The fill order is strict: all Invigilator 1 slots first, then Invigilator 2, and finally Substitutes.
 */
export function autoAllocateAll(
  exams: Exam[],
  rooms: Room[],
  teachers: Teacher[]
): AllocationResult {
  return runAutoAllocationForPairs(
    getSortedPairs(exams, rooms),
    teachers,
    [],
    [],
    exams
  );
}
