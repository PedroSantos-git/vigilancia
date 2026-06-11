/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Teacher, Room, Exam, Allocation, TeacherRole } from "../types";

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

const ALLOCATION_ROLES: AllocationRoleKey[] = ["invigilator1Id", "invigilator2Id", "substituteId"];

/**
 * Gets the period for room assignment (morning or afternoon).
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
 * Checks if a teacher has a subject conflict with the exam.
 */
export function hasSubjectConflict(teacher: Teacher, exam: Exam): boolean {
  const teacherGroup = String(teacher.subject_group || "").trim();
  const examGroup = String(exam.subject_group || "").trim();
  if (teacherGroup && examGroup && teacherGroup === examGroup) {
    return true;
  }

  const teacherSubj = String(teacher.subject || "").toLowerCase().trim();
  const examName = String(exam.name || "").toLowerCase().trim();
  if (teacherSubj && examName.includes(teacherSubj)) return true;

  return false;
}

/**
 * Checks if a teacher has registered restrictions for a specific exam slot.
 */
export function isTeacherUnavailableAt(teacher: Teacher, date: string, time: string, exam?: Exam): boolean {
  if (!teacher.unavailabilities || teacher.unavailabilities.length === 0) return false;
  const period = getPeriodFromTime(time);

  return teacher.unavailabilities.some(un => {
    if (un.date !== "all" && un.date !== date) return false;
    if (un.time !== "all" && un.time !== period) return false;
    if (un.year && exam && un.year !== exam.year) return false;
    if (un.subject_group && exam && un.subject_group !== exam.subject_group) return false;
    return true;
  });
}

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function hasNoSpecialRole(teacher: Teacher): boolean {
  return normalizeText(teacher.role) === "";
}

export function hasSpecialRole(teacher: Teacher): boolean {
  return !hasNoSpecialRole(teacher);
}

function buildRolePriorityMap(roles: TeacherRole[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const role of roles) {
    map.set(role.id, role.priority ?? 0);
  }
  return map;
}

function getTeacherRolePriority(teacher: Teacher, rolePriorityById: Map<string, number>): number {
  const roleId = String(teacher.role || "").trim();
  if (!roleId) return -1;
  return rolePriorityById.get(roleId) ?? 0;
}

function pickCargoTeacher(
  candidates: Teacher[],
  rolePriorityById: Map<string, number>,
  assignmentCounts: Map<string, number>
): Teacher | null {
  if (candidates.length === 0) return null;

  const priorities = [...new Set(candidates.map(t => getTeacherRolePriority(t, rolePriorityById)))].sort(
    (a, b) => b - a
  );

  for (const priority of priorities) {
    const tier = candidates.filter(t => getTeacherRolePriority(t, rolePriorityById) === priority);
    const selected = pickLeastUsedRandom(tier, assignmentCounts);
    if (selected) return selected;
  }

  return null;
}

export function isFloorZero(room: Room): boolean {
  const floor = normalizeText(room.floor);
  return floor === "0" || floor === "piso 0" || floor === "rés-do-chão" || floor === "res-do-chao";
}

function randomPick<T>(list: T[]): T {
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function allocationKey(examId: string, roomId: string): string {
  return `${examId}::${roomId}`;
}

function getAssignmentCount(assignmentCounts: Map<string, number>, teacherId: string): number {
  return assignmentCounts.get(teacherId) || 0;
}

function getSortedPairs(exams: Exam[], rooms: Room[]): Array<{ exam: Exam; room: Room }> {
  const roomById = new Map(rooms.map(room => [room.id, room]));

  const sortedExams = [...exams].sort((a, b) => {
    if (a.EE !== b.EE) return a.EE ? -1 : 1;
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

function canAssignTeacherToSlot(
  teacher: Teacher,
  exam: Exam,
  room: Room,
  alloc: Allocation,
  dayBusy: Set<string>,
  assignmentCounts: Map<string, number>,
  maxAssignmentsPerTeacher: number
): boolean {
  const period = getPeriodFromTime(exam.time);
  const alreadyInRoom = new Set([alloc.invigilator1Id, alloc.invigilator2Id, alloc.substituteId]);

  if (alreadyInRoom.has(teacher.id)) return false;
  if (hasSubjectConflict(teacher, exam)) return false;
  if (isTeacherUnavailableAt(teacher, exam.date, exam.time, exam)) return false;
  if (dayBusy.has(`${teacher.id}@@${exam.date}@@${period}`)) return false;
  if (teacher.PISO_ZERO && !isFloorZero(room)) return false;
  if (getAssignmentCount(assignmentCounts, teacher.id) >= maxAssignmentsPerTeacher) return false;
  return true;
}

function prioritizePisoZero(candidates: Teacher[], room: Room): Teacher[] {
  if (!isFloorZero(room)) {
    return candidates.filter(teacher => !teacher.PISO_ZERO);
  }
  const pisoZeroCandidates = candidates.filter(teacher => teacher.PISO_ZERO);
  return pisoZeroCandidates.length > 0 ? pisoZeroCandidates : candidates;
}

function pickLeastUsedRandom(candidates: Teacher[], assignmentCounts: Map<string, number>): Teacher | null {
  if (candidates.length === 0) return null;
  const minCount = Math.min(...candidates.map(teacher => getAssignmentCount(assignmentCounts, teacher.id)));
  const leastUsed = candidates.filter(teacher => getAssignmentCount(assignmentCounts, teacher.id) === minCount);
  return randomPick(leastUsed);
}

function assignTeacherToSlot(
  teacher: Teacher,
  alloc: Allocation,
  role: AllocationRoleKey,
  exam: Exam,
  room: Room,
  dayBusy: Set<string>,
  assignmentCounts: Map<string, number>,
  notifications: Array<{ teacherId: string; message: string }>,
  labelSuffix = ""
): void {
  alloc[role] = teacher.id;
  const period = getPeriodFromTime(exam.time);
  dayBusy.add(`${teacher.id}@@${exam.date}@@${period}`);
  assignmentCounts.set(teacher.id, getAssignmentCount(assignmentCounts, teacher.id) + 1);
  notifications.push({
    teacherId: teacher.id,
    message: `${ROLE_LABEL_PT[role]}${labelSuffix} em ${room.name} - ${exam.name} (${exam.date}).`
  });
}

function assignEeTeachersToExams(
  pairs: Array<{ exam: Exam; room: Room }>,
  eeTeachers: Teacher[],
  targetAllocationByKey: Map<string, Allocation>,
  dayBusy: Set<string>,
  assignmentCounts: Map<string, number>,
  maxAssignmentsPerTeacher: number,
  warnings: string[],
  notifications: Array<{ teacherId: string; message: string }>
): void {
  const eeExamIds = [...new Set(pairs.filter(pair => pair.exam.EE).map(pair => pair.exam.id))];
  if (eeExamIds.length === 0 || eeTeachers.length === 0) return;

  let eeTeacherCursor = 0;

  const pickNextEeTeacher = (
    exam: Exam,
    room: Room,
    alloc: Allocation,
    excludeIds: Set<string | null>
  ): Teacher | null => {
    const pool = prioritizePisoZero(eeTeachers, room);
    for (let attempt = 0; attempt < pool.length; attempt++) {
      const teacher = pool[(eeTeacherCursor + attempt) % pool.length];
      if (excludeIds.has(teacher.id)) continue;
      if (!canAssignTeacherToSlot(teacher, exam, room, alloc, dayBusy, assignmentCounts, maxAssignmentsPerTeacher)) {
        continue;
      }
      eeTeacherCursor = (eeTeacherCursor + attempt + 1) % pool.length;
      return teacher;
    }
    return null;
  };

  const firstRoomByExamId = new Map<string, { exam: Exam; room: Room }>();
  for (const examId of eeExamIds) {
    const firstRoomPair = pairs.find(pair => pair.exam.id === examId);
    if (firstRoomPair) {
      firstRoomByExamId.set(examId, { exam: firstRoomPair.exam, room: firstRoomPair.room });
    }
  }

  // Passo 1: um vigilante EE por exame (primeira sala), em rodízio entre docentes EE
  for (const examId of eeExamIds) {
    const firstRoom = firstRoomByExamId.get(examId);
    if (!firstRoom) continue;

    const key = allocationKey(examId, firstRoom.room.id);
    const alloc = targetAllocationByKey.get(key);
    if (!alloc || alloc.invigilator1Id) continue;

    const selected = pickNextEeTeacher(firstRoom.exam, firstRoom.room, alloc, new Set());
    if (!selected) {
      warnings.push(`Sem docente EE disponível para vigilância no exame ${firstRoom.exam.name} (${firstRoom.exam.date}).`);
    } else {
      assignTeacherToSlot(
        selected,
        alloc,
        "invigilator1Id",
        firstRoom.exam,
        firstRoom.room,
        dayBusy,
        assignmentCounts,
        notifications,
        " (EE)"
      );
    }
  }

  // Passo 2 (opcional): suplente EE na primeira sala, se houver docente disponível
  for (const examId of eeExamIds) {
    const firstRoom = firstRoomByExamId.get(examId);
    if (!firstRoom) continue;

    const key = allocationKey(examId, firstRoom.room.id);
    const alloc = targetAllocationByKey.get(key);
    if (!alloc || alloc.substituteId) continue;

    const excludeIds = new Set([alloc.invigilator1Id, alloc.invigilator2Id, alloc.substituteId]);
    const selected = pickNextEeTeacher(firstRoom.exam, firstRoom.room, alloc, excludeIds);
    if (selected) {
      assignTeacherToSlot(
        selected,
        alloc,
        "substituteId",
        firstRoom.exam,
        firstRoom.room,
        dayBusy,
        assignmentCounts,
        notifications,
        " (EE)"
      );
    }
  }
}

function assignRestrictedTeachers(
  pairs: Array<{ exam: Exam; room: Room }>,
  restrictedTeachers: Teacher[],
  targetAllocationByKey: Map<string, Allocation>,
  dayBusy: Set<string>,
  assignmentCounts: Map<string, number>,
  maxAssignmentsPerTeacher: number,
  notifications: Array<{ teacherId: string; message: string }>
): void {
  for (const teacher of restrictedTeachers) {
    const remainingSlots = maxAssignmentsPerTeacher - getAssignmentCount(assignmentCounts, teacher.id);
    if (remainingSlots <= 0) continue;

    let assignmentsDone = 0;
    let roleIndex = 0;
    let safetyCounter = 0;
    const maxSafety = pairs.length * ALLOCATION_ROLES.length * 4;

    while (assignmentsDone < remainingSlots && safetyCounter < maxSafety) {
      safetyCounter++;
      const currentRole = ALLOCATION_ROLES[roleIndex % ALLOCATION_ROLES.length];
      const candidatePairs = shuffle(pairs).filter(pair => {
        const alloc = targetAllocationByKey.get(allocationKey(pair.exam.id, pair.room.id));
        if (!alloc || alloc[currentRole]) return false;
        return canAssignTeacherToSlot(
          teacher,
          pair.exam,
          pair.room,
          alloc,
          dayBusy,
          assignmentCounts,
          maxAssignmentsPerTeacher
        );
      });

      if (candidatePairs.length === 0) {
        roleIndex++;
        continue;
      }

      const pair = randomPick(candidatePairs);
      const alloc = targetAllocationByKey.get(allocationKey(pair.exam.id, pair.room.id))!;
      assignTeacherToSlot(
        teacher,
        alloc,
        currentRole,
        pair.exam,
        pair.room,
        dayBusy,
        assignmentCounts,
        notifications
      );
      assignmentsDone++;
      roleIndex++;
    }
  }
}

function assignCargoTeachers(
  pairs: Array<{ exam: Exam; room: Room }>,
  cargoPool: Teacher[],
  rolePriorityById: Map<string, number>,
  targetAllocationByKey: Map<string, Allocation>,
  dayBusy: Set<string>,
  assignmentCounts: Map<string, number>,
  maxAssignmentsPerTeacher: number,
  warnings: string[],
  notifications: Array<{ teacherId: string; message: string }>
): void {
  for (const role of ALLOCATION_ROLES) {
    let usedInRound = new Set<string>();

    for (const pair of pairs) {
      const key = allocationKey(pair.exam.id, pair.room.id);
      const alloc = targetAllocationByKey.get(key);
      if (!alloc || alloc[role]) continue;

      let candidates = cargoPool.filter(teacher =>
        canAssignTeacherToSlot(
          teacher,
          pair.exam,
          pair.room,
          alloc,
          dayBusy,
          assignmentCounts,
          maxAssignmentsPerTeacher
        )
      );

      candidates = prioritizePisoZero(candidates, pair.room);

      let pool = candidates.filter(teacher => !usedInRound.has(teacher.id));
      if (pool.length === 0) {
        usedInRound = new Set<string>();
        pool = candidates;
      }

      const selected = pickCargoTeacher(pool, rolePriorityById, assignmentCounts);
      if (!selected) continue;

      assignTeacherToSlot(
        selected,
        alloc,
        role,
        pair.exam,
        pair.room,
        dayBusy,
        assignmentCounts,
        notifications,
        " (cargo)"
      );
      usedInRound.add(selected.id);
    }
  }

  for (const pair of pairs) {
    const key = allocationKey(pair.exam.id, pair.room.id);
    const alloc = targetAllocationByKey.get(key);
    if (!alloc) continue;

    for (const role of ALLOCATION_ROLES) {
      if (!alloc[role]) {
        warnings.push(
          `Sem docente elegível para ${ROLE_LABEL_PT[role]} em ${pair.room.name} (${pair.exam.name}, ${pair.exam.date}), mesmo após recurso a docentes com cargo.`
        );
      }
    }
  }
}

function assignGenericTeachers(
  pairs: Array<{ exam: Exam; room: Room }>,
  genericPool: Teacher[],
  targetAllocationByKey: Map<string, Allocation>,
  dayBusy: Set<string>,
  assignmentCounts: Map<string, number>,
  maxAssignmentsPerTeacher: number,
  warnings: string[],
  notifications: Array<{ teacherId: string; message: string }>
): void {
  for (const role of ALLOCATION_ROLES) {
    let usedInRound = new Set<string>();

    for (const pair of pairs) {
      const key = allocationKey(pair.exam.id, pair.room.id);
      const alloc = targetAllocationByKey.get(key);
      if (!alloc || alloc[role]) continue;

      let candidates = genericPool.filter(teacher =>
        canAssignTeacherToSlot(
          teacher,
          pair.exam,
          pair.room,
          alloc,
          dayBusy,
          assignmentCounts,
          maxAssignmentsPerTeacher
        )
      );

      candidates = prioritizePisoZero(candidates, pair.room);

      let pool = candidates.filter(teacher => !usedInRound.has(teacher.id));
      if (pool.length === 0) {
        usedInRound = new Set<string>();
        pool = candidates;
      }

      const selected = pickLeastUsedRandom(pool, assignmentCounts);
      if (!selected) continue;

      assignTeacherToSlot(
        selected,
        alloc,
        role,
        pair.exam,
        pair.room,
        dayBusy,
        assignmentCounts,
        notifications
      );
      usedInRound.add(selected.id);
    }
  }
}

/**
 * Runs the auto-distribution of rooms for all exams.
 */
export function autoAllocateRooms(
  exams: Exam[],
  rooms: Room[]
): Exam[] {
  const sortedRooms = [...rooms].sort((a, b) => a.priority - b.priority);

  const sortedExams = [...exams].sort((a, b) => {
    const isSpecialA = (a.variant || "").includes("LNM") || (a.modality && a.modality !== "");
    const isSpecialB = (b.variant || "").includes("LNM") || (b.modality && b.modality !== "");

    if (isSpecialA !== isSpecialB) return isSpecialA ? 1 : -1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const updatedExams = [...exams];

  sortedExams.forEach(exam => {
    const registrationsNeeded = exam.registrationsCount || 0;
    const currentRooms = exam.roomIds || [];

    const roomById = new Map(rooms.map(room => [room.id, room]));
    let currentCapacity = currentRooms.reduce((sum, roomId) => sum + (roomById.get(roomId)?.capacity || 0), 0);

    if (currentCapacity >= registrationsNeeded) return;

    const roomsToAssign: string[] = [...currentRooms];
    const currentPeriod = getPeriodFromTime(exam.time);

    for (const room of sortedRooms) {
      if (currentCapacity >= registrationsNeeded) break;
      if (roomsToAssign.includes(room.id)) continue;

      const isAvailable = updatedExams.every(otherEx => {
        if (!otherEx.roomIds?.includes(room.id) || otherEx.date !== exam.date || otherEx.id === exam.id) return true;
        const otherPeriod = getPeriodFromTime(otherEx.time);
        return otherPeriod !== currentPeriod;
      });

      if (isAvailable) {
        roomsToAssign.push(room.id);
        currentCapacity += room.capacity;
      }
    }

    const idx = updatedExams.findIndex(e => e.id === exam.id);
    if (idx !== -1) {
      updatedExams[idx] = { ...updatedExams[idx], roomIds: roomsToAssign };
    }
  });

  return updatedExams;
}

/**
 * Main auto-allocation function implementing all detailed rules.
 */
export function autoAllocateAll(
  exams: Exam[],
  rooms: Room[],
  teachers: Teacher[],
  roles: TeacherRole[] = [],
  existingAllocations: Allocation[] = []
): AllocationResult {
  const pairs = getSortedPairs(exams, rooms);
  const targetAllocationByKey = new Map<string, Allocation>();
  const warnings: string[] = [];
  const notifications: Array<{ teacherId: string; message: string }> = [];
  const examById = new Map(exams.map(e => [e.id, e]));
  const dayBusy = new Set<string>();
  const assignmentCounts = new Map<string, number>();

  // Initialize from existing allocations
  existingAllocations.forEach(alloc => {
    const ex = examById.get(alloc.examId);
    if (!ex) return;
    const period = getPeriodFromTime(ex.time);
    if (alloc.invigilator1Id) {
      dayBusy.add(`${alloc.invigilator1Id}@@${ex.date}@@${period}`);
      assignmentCounts.set(alloc.invigilator1Id, (assignmentCounts.get(alloc.invigilator1Id) || 0) + 1);
    }
    if (alloc.invigilator2Id) {
      dayBusy.add(`${alloc.invigilator2Id}@@${ex.date}@@${period}`);
      assignmentCounts.set(alloc.invigilator2Id, (assignmentCounts.get(alloc.invigilator2Id) || 0) + 1);
    }
    if (alloc.substituteId) {
      dayBusy.add(`${alloc.substituteId}@@${ex.date}@@${period}`);
      assignmentCounts.set(alloc.substituteId, (assignmentCounts.get(alloc.substituteId) || 0) + 1);
    }
  });

  const rolePriorityById = buildRolePriorityMap(roles);
  const basePool = teachers.filter(teacher => teacher.available && hasNoSpecialRole(teacher));
  const cargoPool = teachers.filter(teacher => teacher.available && hasSpecialRole(teacher));
  teachers.filter(t => t.available).forEach(teacher => {
    if (!assignmentCounts.has(teacher.id)) {
      assignmentCounts.set(teacher.id, 0);
    }
  });

  for (const pair of pairs) {
    const key = allocationKey(pair.exam.id, pair.room.id);
    const existingAlloc = existingAllocations.find(a => a.examId === pair.exam.id && a.roomId === pair.room.id);
    targetAllocationByKey.set(key, {
      id: `${pair.exam.id}_${pair.room.id}`,
      examId: pair.exam.id,
      roomId: pair.room.id,
      invigilator1Id: existingAlloc?.invigilator1Id || null,
      invigilator2Id: existingAlloc?.invigilator2Id || null,
      substituteId: existingAlloc?.substituteId || null
    });
  }

  // Calculate remaining slots to fill
  let existingAssignedCount = 0;
  for (const pair of pairs) {
    const key = allocationKey(pair.exam.id, pair.room.id);
    const alloc = targetAllocationByKey.get(key)!;
    if (alloc.invigilator1Id) existingAssignedCount++;
    if (alloc.invigilator2Id) existingAssignedCount++;
    if (alloc.substituteId) existingAssignedCount++;
  }
  const totalAssignmentsNeeded = pairs.length * 3;
  const remainingSlots = totalAssignmentsNeeded - existingAssignedCount;
  const availableTeachersCount = Math.max(basePool.length, 1);
  const maxExisting = existingAssignedCount > 0 ? Math.max(0, ...Array.from(assignmentCounts.values())) : 0;
  const maxAssignmentsPerTeacher = Math.ceil(remainingSlots / availableTeachersCount) + maxExisting;
  warnings.push(
    `Máximo de vigilâncias por docente: ${maxAssignmentsPerTeacher} (${totalAssignmentsNeeded} vagas totais, ${existingAssignedCount} já atribuídas, ${remainingSlots} restantes para ${basePool.length} docentes elegíveis).`
  );

  const eeTeachers = basePool
    .filter(teacher => teacher.EE)
    .sort((a, b) => getAssignmentCount(assignmentCounts, a.id) - getAssignmentCount(assignmentCounts, b.id));

  const restrictedTeacherIds = new Set(
    basePool
      .filter(teacher => teacher.unavailabilities && teacher.unavailabilities.length > 0)
      .map(teacher => teacher.id)
  );
  const restrictedTeachers = basePool.filter(teacher => restrictedTeacherIds.has(teacher.id));
  const genericPool = basePool.filter(teacher => !restrictedTeacherIds.has(teacher.id));

  // Fase 1: EE por exame (Vigilante 1 EE obrigatório na 1.ª sala; suplente EE opcional)
  assignEeTeachersToExams(
    pairs,
    eeTeachers,
    targetAllocationByKey,
    dayBusy,
    assignmentCounts,
    maxAssignmentsPerTeacher,
    warnings,
    notifications
  );

  // Fase 2: docentes com indisponibilidades/restrições
  assignRestrictedTeachers(
    pairs,
    restrictedTeachers,
    targetAllocationByKey,
    dayBusy,
    assignmentCounts,
    maxAssignmentsPerTeacher,
    notifications
  );

  // Fase 3: atribuição genérica (Vigilante 1 -> Vigilante 2 -> Suplente)
  assignGenericTeachers(
    pairs,
    genericPool,
    targetAllocationByKey,
    dayBusy,
    assignmentCounts,
    maxAssignmentsPerTeacher,
    warnings,
    notifications
  );

  // Fase 4: docentes com cargo (available), por ordem de prioridade do cargo (maior primeiro)
  if (cargoPool.length > 0) {
    assignCargoTeachers(
      pairs,
      cargoPool,
      rolePriorityById,
      targetAllocationByKey,
      dayBusy,
      assignmentCounts,
      maxAssignmentsPerTeacher,
      warnings,
      notifications
    );
  } else {
    for (const pair of pairs) {
      const alloc = targetAllocationByKey.get(allocationKey(pair.exam.id, pair.room.id));
      if (!alloc) continue;
      for (const role of ALLOCATION_ROLES) {
        if (!alloc[role]) {
          warnings.push(
            `Sem docente elegível para ${ROLE_LABEL_PT[role]} em ${pair.room.name} (${pair.exam.name}, ${pair.exam.date}).`
          );
        }
      }
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
 * Runs the auto-distribution for a single exam.
 */
export function autoAllocate(
  exam: Exam,
  rooms: Room[],
  teachers: Teacher[],
  allAllocations: Allocation[],
  currentExamAllocations: Allocation[],
  allExams: Exam[],
  roles: TeacherRole[] = []
): AllocationResult {
  const pairs = getSortedPairs([exam], rooms);
  const targetAllocationByKey = new Map<string, Allocation>();
  const warnings: string[] = [];
  const notifications: Array<{ teacherId: string; message: string }> = [];
  const examById = new Map(allExams.map(e => [e.id, e]));

  const dayBusy = new Set<string>();
  allAllocations.forEach(alloc => {
    const ex = examById.get(alloc.examId);
    if (!ex) return;
    const period = getPeriodFromTime(ex.time);
    if (alloc.invigilator1Id) dayBusy.add(`${alloc.invigilator1Id}@@${ex.date}@@${period}`);
    if (alloc.invigilator2Id) dayBusy.add(`${alloc.invigilator2Id}@@${ex.date}@@${period}`);
    if (alloc.substituteId) dayBusy.add(`${alloc.substituteId}@@${ex.date}@@${period}`);
  });

  const assignmentCounts = new Map<string, number>();
  allAllocations.forEach(alloc => {
    if (alloc.invigilator1Id) {
      assignmentCounts.set(alloc.invigilator1Id, (assignmentCounts.get(alloc.invigilator1Id) || 0) + 1);
    }
    if (alloc.invigilator2Id) {
      assignmentCounts.set(alloc.invigilator2Id, (assignmentCounts.get(alloc.invigilator2Id) || 0) + 1);
    }
    if (alloc.substituteId) {
      assignmentCounts.set(alloc.substituteId, (assignmentCounts.get(alloc.substituteId) || 0) + 1);
    }
  });

  const rolePriorityById = buildRolePriorityMap(roles);
  const basePool = teachers.filter(teacher => teacher.available && hasNoSpecialRole(teacher));
  const cargoPool = teachers.filter(teacher => teacher.available && hasSpecialRole(teacher));
  teachers.filter(t => t.available).forEach(teacher => {
    if (!assignmentCounts.has(teacher.id)) {
      assignmentCounts.set(teacher.id, 0);
    }
  });

  let assignedCount = 0;
  for (const pair of pairs) {
    const existingAlloc = currentExamAllocations.find(a => a.roomId === pair.room.id);
    const key = allocationKey(pair.exam.id, pair.room.id);
    targetAllocationByKey.set(key, {
      id: `${pair.exam.id}_${pair.room.id}`,
      examId: pair.exam.id,
      roomId: pair.room.id,
      invigilator1Id: existingAlloc?.invigilator1Id || null,
      invigilator2Id: existingAlloc?.invigilator2Id || null,
      substituteId: existingAlloc?.substituteId || null
    });
    const alloc = targetAllocationByKey.get(key)!;
    if (alloc.invigilator1Id) assignedCount++;
    if (alloc.invigilator2Id) assignedCount++;
    if (alloc.substituteId) assignedCount++;
  }

  const remainingSlots = (pairs.length * 3) - assignedCount;
  const maxAssignmentsPerTeacher =
    Math.ceil(remainingSlots / Math.max(basePool.length, 1)) +
    Math.max(0, ...Array.from(assignmentCounts.values()));

  const eeTeachers = basePool.filter(teacher => teacher.EE);
  const restrictedTeachers = basePool.filter(teacher => teacher.unavailabilities && teacher.unavailabilities.length > 0);
  const genericPool = basePool.filter(teacher => !restrictedTeachers.some(t => t.id === teacher.id));

  assignEeTeachersToExams(
    pairs,
    eeTeachers,
    targetAllocationByKey,
    dayBusy,
    assignmentCounts,
    maxAssignmentsPerTeacher,
    warnings,
    notifications
  );

  assignRestrictedTeachers(
    pairs,
    restrictedTeachers,
    targetAllocationByKey,
    dayBusy,
    assignmentCounts,
    maxAssignmentsPerTeacher,
    notifications
  );

  assignGenericTeachers(
    pairs,
    genericPool,
    targetAllocationByKey,
    dayBusy,
    assignmentCounts,
    maxAssignmentsPerTeacher,
    warnings,
    notifications
  );

  if (cargoPool.length > 0) {
    assignCargoTeachers(
      pairs,
      cargoPool,
      rolePriorityById,
      targetAllocationByKey,
      dayBusy,
      assignmentCounts,
      maxAssignmentsPerTeacher,
      warnings,
      notifications
    );
  } else {
    for (const pair of pairs) {
      const alloc = targetAllocationByKey.get(allocationKey(pair.exam.id, pair.room.id));
      if (!alloc) continue;
      for (const role of ALLOCATION_ROLES) {
        if (!alloc[role]) {
          warnings.push(
            `Sem docente elegível para ${ROLE_LABEL_PT[role]} em ${pair.room.name} (${pair.exam.name}, ${pair.exam.date}).`
          );
        }
      }
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
