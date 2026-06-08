/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Allocation, Exam, Room } from "../types";

export function normalizeId(id: string | null | undefined): string {
  return String(id ?? "").trim();
}

export function examIncludesRoom(exam: Exam, roomId: string): boolean {
  return (exam.roomIds ?? []).some(id => normalizeId(id) === normalizeId(roomId));
}

export function formatExamLabel(exam: Exam): string {
  const parts = [exam.name, exam.date, exam.time];
  if (exam.variant) parts.push(`var. ${exam.variant}`);
  if (exam.code) parts.push(`cód. ${exam.code}`);
  if (exam.modality) parts.push(exam.modality);
  if (exam.phase) parts.push(`fase ${exam.phase}`);
  return parts.join(" · ");
}

/**
 * Resolves an allocation for an exam room, tolerating ID drift after reimports
 * (e.g. room UUID changed but room name stayed the same).
 */
export function findAllocationForExamRoom(
  allocations: Allocation[],
  examId: string,
  roomId: string,
  rooms: Room[] = []
): Allocation | undefined {
  const eId = normalizeId(examId);
  const rId = normalizeId(roomId);

  const direct = allocations.find(
    a => normalizeId(a.examId) === eId && normalizeId(a.roomId) === rId
  );
  if (direct) return direct;

  const byCompositeId = allocations.find(a => normalizeId(a.id) === `${eId}_${rId}`);
  if (byCompositeId) return byCompositeId;

  const targetRoomName = rooms.find(r => normalizeId(r.id) === rId)?.name;
  if (!targetRoomName) return undefined;

  return allocations.find(a => {
    if (normalizeId(a.examId) !== eId) return false;
    const allocRoom = rooms.find(r => normalizeId(r.id) === normalizeId(a.roomId));
    return allocRoom?.name === targetRoomName;
  });
}

export function hasAssignedTeacher(teacherId: string | null | undefined): boolean {
  const id = normalizeId(teacherId);
  return id !== "" && id.toLowerCase() !== "null";
}
