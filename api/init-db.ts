import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 0. Ensure extension for UUID exists
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    // 1. Drop existing tables if needed (ONLY if mode=reset is provided)
    const mode = req.query.mode;
    if (mode === 'reset') {
      await sql`DROP TABLE IF EXISTS allocations CASCADE`;
      await sql`DROP TABLE IF EXISTS exams CASCADE`;
      await sql`DROP TABLE IF EXISTS teachers CASCADE`;
      await sql`DROP TABLE IF EXISTS rooms CASCADE`;
      await sql`DROP TABLE IF EXISTS teacher_roles CASCADE`;
    }

    // 1b. Migration/Repair (Always run to ensure columns exist)
    await sql`ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 120`;
    await sql`ALTER TABLE exams ADD COLUMN IF NOT EXISTS tolerance INTEGER NOT NULL DEFAULT 30`;
    await sql`ALTER TABLE exams ADD COLUMN IF NOT EXISTS rooms_needed INTEGER NOT NULL DEFAULT 1`;
    await sql`ALTER TABLE exams ADD COLUMN IF NOT EXISTS room_ids JSONB DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0`;

    if (mode === 'repair') {
      return res.status(200).json({ message: 'Database schema repaired successfully' });
    }

    // 2. Create teacher_roles FIRST (no dependencies)
    await sql`
      CREATE TABLE IF NOT EXISTS teacher_roles (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name TEXT UNIQUE NOT NULL
      );
    `;

    // 3. Inserir roles iniciais
    const initialRoles = [
      'Coordenador', 'Juri de PAP', 'Classificadores Básico', 'Classificadores Secundário', 
      'Direção', 'Inventário Mediateca', 'Matriculas', 'Bibliotecária', 
      'Receção de Portáteis', 'AP', 'Manuais', 'Turmas', 'Atestado Médico', 
      'Coordenadora de curso', 'Avaliação Interna', 'Técnica esp.', 'P.I.R', 
      'Enes', 'TE', 'Secretariado', 'Out', 'Horários', 'EE', 'Agrupamento'
    ];

    const roleMap = new Map<string, string>();

    for (const roleName of initialRoles) {
      const { rows } = await sql`
        INSERT INTO teacher_roles (name)
        VALUES (${roleName})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      roleMap.set(roleName, rows[0].id);
    }

    // 4. Create AuthorizedUsers (no dependencies)
    await sql`
      CREATE TABLE IF NOT EXISTS AuthorizedUsers ( 
        id SERIAL PRIMARY KEY, 
        email TEXT UNIQUE NOT NULL, 
        name TEXT, 
        role TEXT DEFAULT 'admin', 
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() 
      );
    `;

    // 5. Create teachers (NO foreign key constraint for now to avoid initialization errors)
    await sql`
      CREATE TABLE IF NOT EXISTS teachers (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name TEXT NOT NULL,
          subject_group TEXT NOT NULL,
          subject TEXT NOT NULL,
          role TEXT,
          email TEXT UNIQUE,
          phone TEXT,
          available BOOLEAN DEFAULT TRUE,
          unavailabilities JSONB DEFAULT '[]'::jsonb
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name TEXT UNIQUE NOT NULL,
          capacity INTEGER NOT NULL DEFAULT 15,
          floor TEXT,
          priority INTEGER DEFAULT 0
      );
    `;

    const defaultRooms = [
      'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17',
      'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27'
    ];

    for (let i = 0; i < defaultRooms.length; i++) {
      const roomName = defaultRooms[i];
      await sql`
        INSERT INTO rooms (name, capacity, floor, priority)
        VALUES (${roomName}, 15, ${roomName.startsWith('B1') ? '1' : '2'}, ${i + 1})
        ON CONFLICT (name) DO UPDATE SET capacity = EXCLUDED.capacity, floor = EXCLUDED.floor, priority = EXCLUDED.priority
      `;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS exams (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name TEXT NOT NULL,
          variant TEXT,
          subject_group TEXT NOT NULL,
          year TEXT NOT NULL,
          code TEXT,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          shift TEXT,
          modality TEXT,
          phase TEXT NOT NULL,
          duration INTEGER NOT NULL DEFAULT 120,
          tolerance INTEGER NOT NULL DEFAULT 30,
          rooms_needed INTEGER NOT NULL DEFAULT 1,
          room_ids JSONB DEFAULT '[]'::jsonb
      );
    `;

    // 7. Insert Initial Exams (1ª and 2ª Phase 2026)
    const initialExams = [
      // 1ª FASE
      { name: 'Português', variant: null, subject_group: '300', year: '12', code: '639', date: '2026-06-16', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Português', variant: null, subject_group: '300', year: '12', code: '527', date: '2026-06-16', time: '08:45', shift: null, modality: 'LO', phase: '1' },
      { name: 'Português', variant: null, subject_group: '300', year: '12', code: '639', date: '2026-06-16', time: '08:45', shift: null, modality: 'SP', phase: '1' },
      { name: 'Economia', variant: 'A', subject_group: '430', year: '11', code: '712', date: '2026-06-16', time: '13:15', shift: null, modality: null, phase: '1' },
      
      { name: 'Português', variant: null, subject_group: '300', year: '9', code: '91', date: '2026-06-17', time: '08:45', shift: 'T1', modality: null, phase: '1' },
      { name: 'Português', variant: null, subject_group: '300', year: '9', code: '91', date: '2026-06-17', time: '11:15', shift: 'T2', modality: null, phase: '1' },
      { name: 'Português', variant: 'LNM', subject_group: '300', year: '9', code: '93', date: '2026-06-17', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Português', variant: null, subject_group: '300', year: '11', code: '81', date: '2026-06-17', time: '11:15', shift: null, modality: null, phase: '1' },
      { name: 'Geometria Descritiva', variant: 'A', subject_group: '600', year: '12', code: '708', date: '2026-06-17', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Espanhol', variant: null, subject_group: '350', year: '11', code: '547', date: '2026-06-17', time: '13:15', shift: null, modality: 'SP', phase: '1' },
      { name: 'Espanhol', variant: null, subject_group: '350', year: '11', code: '721', date: '2026-06-17', time: '13:15', shift: null, modality: null, phase: '1' },

      { name: 'Biologia e Geologia', variant: null, subject_group: '520', year: '11', code: '702', date: '2026-06-18', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Biologia e Geologia', variant: null, subject_group: '520', year: '11', code: '702', date: '2026-06-18', time: '08:45', shift: null, modality: 'EE', phase: '1' },
      { name: 'Cidadania e Desenvolvimento', variant: null, subject_group: '910', year: '9', code: '96', date: '2026-06-18', time: '08:45', shift: null, modality: 'oral', phase: '1' },

      { name: 'Geografia', variant: 'A', subject_group: '420', year: '11', code: '719', date: '2026-06-19', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Geografia', variant: 'A', subject_group: '420', year: '11', code: '825', date: '2026-06-19', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Geografia', variant: null, subject_group: '420', year: '9', code: '18', date: '2026-06-19', time: '08:45', shift: null, modality: null, phase: '1' },

      { name: 'Matemática', variant: null, subject_group: '500', year: '9', code: '92', date: '2026-06-22', time: '08:45', shift: 'T1', modality: null, phase: '1' },
      { name: 'Matemática', variant: null, subject_group: '500', year: '9', code: '92', date: '2026-06-22', time: '11:15', shift: 'T2', modality: null, phase: '1' },
      { name: 'Matemática', variant: null, subject_group: '500', year: '12', code: '82', date: '2026-06-22', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'História', variant: 'A', subject_group: '400', year: '12', code: '226', date: '2026-06-22', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'História', variant: 'A', subject_group: '400', year: '12', code: '623', date: '2026-06-22', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'História da Cultura e das Artes', variant: null, subject_group: '600', year: '11', code: '724', date: '2026-06-22', time: '08:45', shift: null, modality: null, phase: '1' },

      { name: 'Inglês', variant: null, subject_group: '330', year: '9', code: '21', date: '2026-06-23', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Matemática', variant: 'A', subject_group: '500', year: '12', code: '635', date: '2026-06-23', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Matemática', variant: 'B', subject_group: '500', year: '11', code: '735', date: '2026-06-23', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'MACS', variant: null, subject_group: '500', year: '12', code: '835', date: '2026-06-23', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Inglês', variant: null, subject_group: '330', year: '11', code: '550', date: '2026-06-23', time: '13:15', shift: null, modality: null, phase: '1' },

      { name: 'Educação Visual', variant: null, subject_group: '600', year: '9', code: '14', date: '2026-06-24', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Física e Química', variant: 'A', subject_group: '510', year: '11', code: '715', date: '2026-06-25', time: '08:45', shift: null, modality: null, phase: '1' },

      { name: 'Desenho', variant: 'A', subject_group: '600', year: '12', code: '521', date: '2026-06-26', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Francês', variant: null, subject_group: '320', year: '11', code: '16', date: '2026-06-26', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Desenho', variant: 'A', subject_group: '600', year: '12', code: '706', date: '2026-06-26', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'Filosofia', variant: null, subject_group: '410', year: '11', code: '714', date: '2026-06-26', time: '13:15', shift: null, modality: null, phase: '1' },
      { name: 'Filosofia', variant: null, subject_group: '410', year: '11', code: '225', date: '2026-06-26', time: '13:15', shift: null, modality: null, phase: '1' },

      { name: 'Ciências Naturais', variant: null, subject_group: '520', year: '9', code: '10', date: '2026-06-29', time: '10:00', shift: null, modality: null, phase: '1' },
      { name: 'Ciências Naturais', variant: null, subject_group: '520', year: '9', code: '10', date: '2026-06-29', time: '10:00', shift: null, modality: 'NE', phase: '1' },
      { name: 'Ciências Naturais', variant: null, subject_group: '520', year: '9', code: '10', date: '2026-06-29', time: '10:00', shift: null, modality: 'LO', phase: '1' },
      { name: 'Ciências Naturais', variant: null, subject_group: '520', year: '9', code: '10', date: '2026-06-29', time: '10:00', shift: null, modality: 'SA', phase: '1' },

      { name: 'História', variant: null, subject_group: '400', year: '9', code: '19', date: '2026-06-30', time: '08:45', shift: null, modality: null, phase: '1' },
      { name: 'TIC', variant: null, subject_group: '550', year: '9', code: '24', date: '2026-07-01', time: '08:45', shift: null, modality: null, phase: '1' },

      // 2ª FASE
      { name: 'Português', variant: null, subject_group: '300', year: '12', code: '639', date: '2026-07-16', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Português', variant: 'LNM', subject_group: '300', year: '12', code: '839', date: '2026-07-16', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Português', variant: null, subject_group: '300', year: '12', code: '639', date: '2026-07-16', time: '08:45', shift: null, modality: 'EE', phase: '2' },
      { name: 'Português', variant: null, subject_group: '300', year: '9', code: '91', date: '2026-07-16', time: '08:45', shift: 'T1', modality: null, phase: '2' },
      { name: 'Português', variant: null, subject_group: '300', year: '9', code: '91', date: '2026-07-16', time: '08:45', shift: 'T1', modality: 'LO', phase: '2' },
      { name: 'Português', variant: null, subject_group: '300', year: '9', code: '81', date: '2026-07-16', time: '08:45', shift: 'T1', modality: 'NE', phase: '2' },
      { name: 'Português', variant: 'LNM', subject_group: '300', year: '9', code: '93', date: '2026-07-16', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Geografia', variant: 'A', subject_group: '420', year: '11', code: '719', date: '2026-07-16', time: '13:15', shift: null, modality: null, phase: '2' },
      { name: 'Geografia', variant: 'A', subject_group: '420', year: '11', code: '719', date: '2026-07-16', time: '13:15', shift: null, modality: 'EE', phase: '2' },

      { name: 'Física e Química', variant: 'A', subject_group: '510', year: '11', code: '715', date: '2026-07-17', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Economia', variant: 'A', subject_group: '430', year: '11', code: '712', date: '2026-07-17', time: '13:15', shift: null, modality: null, phase: '2' },
      { name: 'História da Cultura e das Artes', variant: null, subject_group: '600', year: '11', code: '724', date: '2026-07-17', time: '13:15', shift: null, modality: null, phase: '2' },

      { name: 'Matemática', variant: null, subject_group: '500', year: '9', code: '92', date: '2026-07-20', time: '08:45', shift: 'T1', modality: null, phase: '2' },
      { name: 'Matemática', variant: null, subject_group: '500', year: '9', code: '92', date: '2026-07-20', time: '08:15', shift: 'T1', modality: 'LO', phase: '2' },
      { name: 'Matemática', variant: null, subject_group: '500', year: '9', code: '92', date: '2026-07-20', time: '08:15', shift: 'T1', modality: 'NE', phase: '2' },
      { name: 'Matemática', variant: 'A', subject_group: '500', year: '12', code: '635', date: '2026-07-20', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Matemática', variant: 'A', subject_group: '500', year: '12', code: '635', date: '2026-07-20', time: '08:45', shift: null, modality: 'NE', phase: '2' },
      { name: 'Matemática', variant: 'B', subject_group: '500', year: '12', code: '735', date: '2026-07-20', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'MACS', variant: null, subject_group: '500', year: '12', code: '835', date: '2026-07-20', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Filosofia', variant: null, subject_group: '410', year: '11', code: '714', date: '2026-07-20', time: '13:15', shift: null, modality: null, phase: '2' },

      { name: 'Inglês', variant: null, subject_group: '330', year: '11', code: '21', date: '2026-07-21', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Inglês', variant: null, subject_group: '330', year: '11', code: '21', date: '2026-07-21', time: '08:45', shift: null, modality: 'LO', phase: '2' },
      { name: 'História', variant: 'A', subject_group: '400', year: '12', code: '623', date: '2026-07-21', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Biologia e Geologia', variant: null, subject_group: '520', year: '11', code: '702', date: '2026-07-21', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'TIC', variant: null, subject_group: '550', year: '9', code: '24', date: '2026-07-21', time: '13:15', shift: null, modality: null, phase: '2' },
      { name: 'TIC', variant: null, subject_group: '550', year: '9', code: '24', date: '2026-07-21', time: '13:15', shift: null, modality: 'LO', phase: '2' },
      { name: 'Geometria Descritiva', variant: 'A', subject_group: '600', year: '12', code: '708', date: '2026-07-21', time: '13:15', shift: null, modality: null, phase: '2' },
      { name: 'Espanhol', variant: null, subject_group: '350', year: '11', code: '547', date: '2026-07-21', time: '13:15', shift: null, modality: null, phase: '2' },

      { name: 'Desenho', variant: 'A', subject_group: '600', year: '12', code: '706', date: '2026-07-22', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Francês', variant: null, subject_group: '320', year: '11', code: '16', date: '2026-07-22', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'Francês', variant: null, subject_group: '320', year: '11', code: '16', date: '2026-07-22', time: '08:45', shift: null, modality: 'LO', phase: '2' },
      { name: 'Francês', variant: null, subject_group: '320', year: '11', code: '16', date: '2026-07-22', time: '08:45', shift: null, modality: 'NE', phase: '2' },
      { name: 'Inglês', variant: null, subject_group: '330', year: '11', code: '550', date: '2026-07-22', time: '13:15', shift: null, modality: null, phase: '2' },
      { name: 'Ciências Naturais', variant: null, subject_group: '520', year: '9', code: '10', date: '2026-07-22', time: '13:15', shift: null, modality: null, phase: '2' },

      { name: 'História', variant: null, subject_group: '400', year: '9', code: '19', date: '2026-07-25', time: '08:45', shift: null, modality: null, phase: '2' },
      { name: 'História', variant: null, subject_group: '400', year: '9', code: '19', date: '2026-07-25', time: '08:45', shift: null, modality: 'LO', phase: '2' },
      { name: 'Geografia', variant: null, subject_group: '420', year: '9', code: '18', date: '2026-07-25', time: '13:15', shift: null, modality: null, phase: '2' }
    ];

    for (const ex of initialExams) {
      let duration = 120;
      let tolerance = 30;
      if (ex.year === '9') duration = 90;
      if (ex.name.toLowerCase().includes('matemática')) duration = 150;

      await sql`
        INSERT INTO exams (name, variant, subject_group, year, code, date, time, shift, modality, phase, duration, tolerance, rooms_needed)
        VALUES (${ex.name}, ${ex.variant}, ${ex.subject_group}, ${ex.year}, ${ex.code}, ${ex.date}, ${ex.time}, ${ex.shift}, ${ex.modality}, ${ex.phase}, ${duration}, ${tolerance}, 1)
      `;
    }

    // 8. Insert Initial Teachers
    const initialTeachers = [
      { g: "290", s: "Educação Moral e Religiosa Católica", n: "Maria Teresa do Couto Marques Ganço", r: null },
      { g: "300", s: "Português", n: "Ana Maria Forreta Sancho", r: "Secretariado" },
      { g: "300", s: "Português", n: "Ana Paula Moreira Cardoso Castro Neves", r: "Direção" },
      { g: "300", s: "Português", n: "Ana Teresa Papa", r: "Matriculas" },
      { g: "300", s: "Português", n: "Anabela da Cândida Vieira", r: "Matriculas" },
      { g: "300", s: "Português", n: "Arcângela Maria Neves Carvalho", r: null },
      { g: "300", s: "Português", n: "Cláudia Isabel Gaspar Mendes Tavares", r: null },
      { g: "300", s: "Português", n: "Helena Cristina Viana dos Santos", r: null },
      { g: "300", s: "Português", n: "Inês Teixeira Sampaio", r: null },
      { g: "300", s: "Português", n: "Isabel Maria Silva Sousa Gomes", r: null },
      { g: "300", s: "Português", n: "Josete Maria dos Santos Perdigão", r: null },
      { g: "300", s: "Português", n: "Luísa Maria Vargas Rodrigues Silva", r: null },
      { g: "300", s: "Português", n: "Maria João Serrinha Reis", r: null },
      { g: "300", s: "Português", n: "Maria Júlia Rosa Batista Barroso", r: null },
      { g: "300", s: "Português", n: "Nuno Henrique Caeiro Silva Sousa", r: "Matriculas" },
      { g: "300", s: "Português", n: "Paula Cristina Domingues Marques Gonçalves", r: "Matriculas" },
      { g: "300", s: "Português", n: "Salomé de Fátima Raposo", r: "Bibliotecária" },
      { g: "320", s: "Francês", n: "Ana Margarida Ramos Reynaud Pereira Libório", r: null },
      { g: "320", s: "Francês", n: "Ana Paula Bento Duarte", r: "Avaliação Interna" },
      { g: "320", s: "Francês", n: "Pedro Miguel da Conceição Rodrigues", r: "Secretariado" },
      { g: "330", s: "Inglês", n: "Ana Paula Cabrita Matos Pereira", r: null },
      { g: "330", s: "Inglês", n: "Ana Paula Palhas Botelho Pereira", r: null },
      { g: "330", s: "Inglês", n: "Darlene do Rosário", r: "Agrupamento" },
      { g: "330", s: "Inglês", n: "Elisabete Correia Anastácio", r: null },
      { g: "330", s: "Inglês", n: "Inês Patrícia dos Santos Teixeira", r: null },
      { g: "330", s: "Inglês", n: "Ivone Maria da Conceição Espada", r: null },
      { g: "330", s: "Inglês", n: "Maria Esperança Silva Cruz", r: null },
      { g: "330", s: "Inglês", n: "Maria Helena Calado Santos", r: null },
      { g: "330", s: "Inglês", n: "Maria Lurdes Lopes Monteiro", r: null },
      { g: "330", s: "Inglês", n: "Ramiro Augusto Caeiro Silva Sousa", r: null },
      { g: "350", s: "Espanhol", n: "Manuel Francisco Falé Saúde", r: null },
      { g: "350", s: "Espanhol", n: "Sandra Cristina Rodrigues Dias", r: "Out" },
      { g: "350", s: "Espanhol", n: "Sandra Marisa Santos de Melo", r: null },
      { g: "400", s: "História", n: "Diogo José Morais da Costa Figueiredo Arôcha", r: null },
      { g: "400", s: "História", n: "Isabel Maria Pinto Sarmento Caldeira", r: "Secretariado" },
      { g: "400", s: "História", n: "Luís Henrique Silva de Lima Duque", r: null },
      { g: "400", s: "História", n: "Maria Manuela Andrade Gomes de Passos Pedreira", r: null },
      { g: "400", s: "História", n: "Maria Manuela Garcia Carvalho Freitas", r: null },
      { g: "400", s: "História", n: "Natércia Vilares Gouveia", r: null },
      { g: "410", s: "Filosofia", n: "Beatriz Jorge Oliveira Fonseca Alcobia", r: null },
      { g: "410", s: "Filosofia", n: "Carlos Mario Fernandes Mateus", r: "Coordenador" },
      { g: "410", s: "Filosofia", n: "Francisco José Graça Marreiros", r: null },
      { g: "410", s: "Filosofia", n: "Maria Teresa Marques Miranda", r: null },
      { g: "410", s: "Filosofia", n: "Nuno Pedro Andrade Neto Ferreira", r: "Receção de Portáteis" },
      { g: "420", s: "Geografia", n: "Afonso Maria Simões Fernandes Braz Teixeira", r: null },
      { g: "420", s: "Geografia", n: "Ana Bell Grangeia Reis", r: "Turmas" },
      { g: "420", s: "Geografia", n: "Carla Maria Batista Remédios Morgado", r: null },
      { g: "420", s: "Geografia", n: "Cláudio António Tavares Chaparro", r: "Atestado Médico" },
      { g: "420", s: "Geografia", n: "Cristina Isabel Charepe Vargas", r: null },
      { g: "420", s: "Geografia", n: "Dora Cristina Charrua Carapinha Moraes", r: null },
      { g: "420", s: "Geografia", n: "Luís Miguel Antunes Brás", r: null },
      { g: "420", s: "Geografia", n: "Paula Maria Simona Ferreira", r: "Secretariado" },
      { g: "420", s: "Geografia/História", n: "Paulo Jorge Martins da Brázia", r: null },
      { g: "420", s: "Geografia", n: "Rute Maria Ramos de Sousa", r: "Agrupamento" },
      { g: "430", s: "Economia e Contabilidade", n: "Carla Maria Silva Feliciano Soares", r: null },
      { g: "430", s: "Economia e Contabilidade", n: "Júlia Maria Gonçalves Branco de Araújo Brás", r: null },
      { g: "430", s: "Economia e Contabilidade", n: "Luísa Margarida Silva Fuzeta", r: "Direção" },
      { g: "500", s: "Matemática", n: "António Francisco Limão Salema", r: null },
      { g: "500", s: "Matemática", n: "Arlindo Paulo Ferreira Fernandes Pereira", r: "Avaliação Interna" },
      { g: "500", s: "Matemática", n: "Carlos Henrique Luz Brito Pimenta", r: "Out" },
      { g: "500", s: "Matemática", n: "Cláudia Sofia Tavares Marques Duarte Matos", r: null },
      { g: "500", s: "Matemática", n: "Dulce Monteiro Rei", r: "Horários" },
      { g: "500", s: "Matemática", n: "Helena Maria Gaudino Raposo", r: null },
      { g: "500", s: "Matemática", n: "Isabel Francisca Gil Serote Nunes Martins Cruz", r: "Manuais" },
      { g: "500", s: "Matemática", n: "José Carlos Branco Alves", r: null },
      { g: "500", s: "Matemática", n: "José Paulo Lopes Costa", r: "Turmas" },
      { g: "500", s: "Matemática", n: "Maria João Afonso Carvalho Vacas", r: "Avaliação Interna" },
      { g: "500", s: "Matemática", n: "Martim Tomé Cardoso", r: null },
      { g: "500", s: "Matemática", n: "Patrícia Moreira Vieira Caniço", r: "Horários" },
      { g: "500", s: "Matemática", n: "Rosália Rocha Candeias Custódio", r: "Enes" },
      { g: "500", s: "Matemática", n: "Rui Manuel Pesado Alberto", r: "Avaliação Interna" },
      { g: "510", s: "Física e Química", n: "Alexandra Maria Santos Galhoz Cohen", r: "Turmas" },
      { g: "510", s: "Física e Química", n: "Ana Isabel da Silveira Pires Mercier Lopes", r: "Manuais" },
      { g: "510", s: "Física e Química", n: "Elsa Cristina Marques Alexandre", r: null },
      { g: "510", s: "Física e Química", n: "Maria Celeste Novalhas Marques", r: null },
      { g: "510", s: "Física e Química", n: "Maria Helena Milheiras da Rosa", r: null },
      { g: "510", s: "Física e Química", n: "Maria Lurdes Peralta Ferrão Belo", r: null },
      { g: "510", s: "Física e Química", n: "Maria Margarida Pimentel de Vasconcelos", r: "Secretariado" },
      { g: "510", s: "Física e Química", n: "Maria Teresa Ventura Lopes de Carvalho", r: "Turmas" },
      { g: "510", s: "Física e Química", n: "Paulo Miguel Borba Gonçalves Gomes Martins", r: null },
      { g: "510", s: "Física e Química", n: "Pedro Manuel Oliveira Pereira Vilela Cabrita", r: "Enes" },
      { g: "520", s: "Biologia e Geologia", n: "Ana Cristina Camarinha Pereira Teles", r: null },
      { g: "520", s: "Biologia e Geologia", n: "Ana Helena Serronha Ribeiro", r: null },
      { g: "520", s: "Biologia e Geologia", n: "Ana Paula Santos Almeida", r: "Secretariado" },
      { g: "520", s: "Biologia e Geologia", n: "Maria Fernanda Almeida Matos Teixeira", r: "Turmas" },
      { g: "520", s: "Biologia e Geologia", n: "Maria Josefa Freitas Rodrigues", r: "Secretariado" },
      { g: "520", s: "Biologia e Geologia", n: "Maria Madalena Neves Santos Alves", r: "Direção" },
      { g: "520", s: "Biologia e Geologia", n: "Paula Alexandra Silva Bravo Silva", r: null },
      { g: "520", s: "Biologia e Geologia", n: "Rui Paulo Ruivo Soares Cerdeira", r: null },
      { g: "520", s: "Biologia e Geologia", n: "Sara Filipa Nunes Serras Carvalho Rodrigues", r: "Horários" },
      { g: "520", s: "Biologia e Geologia", n: "Tiago Miguel Mota Parreira", r: null },
      { g: "530", s: "Educação Tecnológica", n: "Margarida Silva Pinto de Sousa Magalhães", r: null },
      { g: "550", s: "Informática", n: "Amélia Luísa de Almeida Silva Santos Pereira Sousa", r: null },
      { g: "550", s: "Informática", n: "Pedro Miguel Freitas dos Santos", r: null },
      { g: "550", s: "Informática", n: "Stephane Gustave Edmond Antoine J. Marie G. Simonet", r: "Direção" },
      { g: "550", s: "Informática", n: "Teresa Maria Rodrigues Ganhão Pereira", r: null },
      { g: "560", s: "Ciências Agro-Pecuárias", n: "Margarida Rosa Fernandes Bilé", r: null },
      { g: "600", s: "Artes Visuais", n: "Ana Cristina Alonso Carlos", r: null },
      { g: "600", s: "Artes Visuais", n: "Ana Cristina Rocha O'Neill", r: null },
      { g: "600", s: "Artes Visuais", n: "Armando Jorge Pais Jesus", r: null },
      { g: "600", s: "Artes Visuais", n: "Eurico Mario Santos Silva Coelho", r: null },
      { g: "600", s: "Artes Visuais", n: "Helena Maria Vitorino Nogueira", r: "Manuais" },
      { g: "600", s: "Artes Visuais", n: "José Manuel Martins Trindade", r: "Direção" },
      { g: "600", s: "Artes Visuais", n: "Joseph Rodrigues", r: null },
      { g: "600", s: "Artes Visuais", n: "Lucília Maria Parreira Pereira", r: null },
      { g: "600", s: "Artes Visuais", n: "Margarida Maria dos Santos Santana Ferra", r: null },
      { g: "620", s: "Educação Física", n: "Adelaide Teresa Lopes Santos Botelho", r: "Secretariado" },
      { g: "620", s: "Educação Física", n: "Áurea Maria Batista Silva Miguel", r: "Enes" },
      { g: "620", s: "Educação Física", n: "Francília Maria Carvalho Santos Neto", r: "Matriculas" },
      { g: "620", s: "Educação Física", n: "Helder Pereira da Costa", r: null },
      { g: "620", s: "Educação Física", n: "Joana Isabel Correia Frazão Marçal Lopes", r: "Secretariado" },
      { g: "620", s: "Educação Física", n: "Luís Francisco de Castro Vicente Ferreira Monteiro", r: "Matriculas" },
      { g: "620", s: "Educação Física", n: "Madalena Maria Martins dos Santos", r: "Coordenador" },
      { g: "620", s: "Educação Física", n: "Maria João Inácio Gomes", r: "Horários" },
      { g: "620", s: "Educação Física", n: "Miguel Ângelo Silva Dinis", r: "Secretariado" },
      { g: "620", s: "Educação Física", n: "Paula Cristina Ferreira Gonçalves", r: "Enes" },
      { g: "620", s: "Educação Física", n: "Tiago Manuel Cordeiro Silva", r: null },
      { g: "910", s: "Educação Especial 1", n: "Maria João Mendes Pissarra Ribeiro Correia", r: "Secretariado" },
      { g: "910", s: "Educação Especial 1", n: "Mónica Sofia Lino Oliveira", r: null },
      { g: "910", s: "Educação Especial 1", n: "Silvana Regina Gomes Vicente Lagarto", r: null },
      { g: "910", s: "Educação Especial 1", n: "Sofia Margarida Vaia Narciso", r: null },
      { g: "910", s: "Educação Especial 1", n: "Susana Trevidic Alves Ferreira", r: null },
      { g: "910", s: "Educação Especial 1", n: "Vanda Sofia Ferro Gamito", r: null }
    ];

    for (const t of initialTeachers) {
      const roleId = t.r ? roleMap.get(t.r) : null;
      await sql`
        INSERT INTO teachers (name, subject_group, subject, role, available)
        VALUES (${t.n}, ${t.g}, ${t.s}, ${roleId}, true)
      `;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS allocations (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
          room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
          invigilator1_id TEXT,
          invigilator2_id TEXT,
          substitute_id TEXT
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          timestamp TEXT NOT NULL,
          recipient_email TEXT,
          recipient_name TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          sent_via TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE
      );
    `;

    return res.status(200).json({ message: 'Database initialized successfully with automatic UUIDs and new rooms' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to initialize database' });
  }
}
