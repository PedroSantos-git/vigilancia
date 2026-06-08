import * as XLSX from 'xlsx';
import { Teacher, Exam, Room, Language } from '../types';

export const exportToExcel = (
  teachers: Teacher[],
  exams: Exam[],
  rooms: Room[],
  roles: { id: string, name: string }[]
) => {
  const wb = XLSX.utils.book_new();

  // 1. Teachers Sheet
  const teachersData = teachers.map(t => ({
    Nome: t.name,
    Grupo_Disciplinar: t.subject_group,
    Disciplina: t.subject,
    Cargo: roles.find(r => r.id === t.role)?.name || t.role || '',
    Email: t.email || '',
    Disponivel: t.available ? 'SIM' : 'NÃO',
    EE: t.EE ? 'SIM' : 'NÃO',
    PISO_ZERO: t.PISO_ZERO ? 'SIM' : 'NÃO'
  }));
  const wsTeachers = XLSX.utils.json_to_sheet(teachersData);
  XLSX.utils.book_append_sheet(wb, wsTeachers, "Docentes");

  // 2. Exams Sheet
  const examsData = exams.map(e => ({
    Nome: e.name,
    Variante: e.variant || '',
    Grupo_Disciplinar: e.subject_group,
    Ano: e.year,
    Codigo: e.code || '',
    Data: e.date,
    Hora: e.time,
    Turno: e.shift || '',
    Modalidade: e.modality || '',
    Fase: e.phase,
    N_Inscritos: e.registrationsCount || 0,
    EE: e.EE ? 'SIM' : 'NÃO'
  }));
  const wsExams = XLSX.utils.json_to_sheet(examsData);
  XLSX.utils.book_append_sheet(wb, wsExams, "Exames");

  // 3. Rooms Sheet
  const roomsData = rooms.map(r => ({
    Nome: r.name,
    Capacidade: r.capacity,
    Floor: r.floor || '',
    priority: r.priority
  }));
  const wsRooms = XLSX.utils.json_to_sheet(roomsData);
  XLSX.utils.book_append_sheet(wb, wsRooms, "Salas");

  // 4. Roles Sheet
  const rolesData = roles.map(r => ({
    Nome: r.name
  }));
  const wsRoles = XLSX.utils.json_to_sheet(rolesData);
  XLSX.utils.book_append_sheet(wb, wsRoles, "Cargos");

  // Save File
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Backup_Vigilancias_${dateStr}.xlsx`);
};

export const importFromExcel = async (
  file: File,
  roles: { id: string, name: string }[]
): Promise<{
  teachers: Partial<Teacher>[],
  exams: Partial<Exam>[],
  rooms: Partial<Room>[],
  roles: { name: string }[]
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const getSheetData = (name: string) => {
          const ws = workbook.Sheets[name];
          return ws ? XLSX.utils.sheet_to_json(ws) : [];
        };

        // 1. Roles
        const rawRoles = getSheetData("Cargos") as any[];
        const importedRoles = rawRoles.map(r => ({ name: r.Nome }));

        // 2. Rooms
        const rawRooms = getSheetData("Salas") as any[];
        const importedRooms = rawRooms.map(r => ({
        name: String(r.Nome),
        capacity: Number(r.Capacidade) || 15,
        floor: r.Floor ? String(r.Floor) : undefined,
        priority: Number(r.priority) || 0
      }));

        // 3. Teachers
        const rawTeachers = getSheetData("Docentes") as any[];
        const importedTeachers = rawTeachers.map(t => ({
          name: String(t.Nome),
          subject_group: String(t.Grupo_Disciplinar || '300'),
          subject: String(t.Disciplina || 'Geral'),
          role: String(t.Cargo || ''), // Will be mapped to ID in the API/Handler
          email: t.Email ? String(t.Email) : null,
          available: String(t.Disponivel).toUpperCase() === 'SIM',
          EE: String(t.EE || 'NÃO').toUpperCase() === 'SIM',
          PISO_ZERO: String(t.PISO_ZERO || 'NÃO').toUpperCase() === 'SIM'
        }));

        // 4. Exams
        const rawExams = getSheetData("Exames") as any[];
        const importedExams = rawExams.map(e => ({
          name: String(e.Nome),
          variant: e.Variante ? String(e.Variante) : null,
          subject_group: String(e.Grupo_Disciplinar || '300'),
          year: String(e.Ano || '12'),
          code: e.Codigo ? String(e.Codigo) : null,
          date: String(e.Data),
          time: String(e.Hora),
          shift: e.Turno ? String(e.Turno) : null,
          modality: e.Modalidade ? String(e.Modalidade) : null,
          phase: String(e.Fase || '1'),
          registrationsCount: Number(e.N_Inscritos || 0),
          EE: String(e.EE || 'NÃO').toUpperCase() === 'SIM'
        }));

        resolve({
          teachers: importedTeachers,
          exams: importedExams,
          rooms: importedRooms,
          roles: importedRoles
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};
