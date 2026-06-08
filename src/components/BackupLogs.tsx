/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Database, Download, Upload, Trash2, Clock, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { api } from '../utils/api';
import { Teacher, Exam, Room, Language } from '../types';
import { exportToExcel, importFromExcel } from '../utils/excel';

interface BackupLogsProps {
  lang: Language;
}

export default function BackupLogs({ lang }: BackupLogsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roles, setRoles] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [t, e, r, rl] = await Promise.all([
          api.teachers.getAll(),
          api.exams.getAll(),
          api.rooms.getAll(),
          api.roles.getAll()
        ]);
        setTeachers(t);
        setExams(e);
        setRooms(r);
        setRoles(rl);
      } catch (err) {
        console.error('Error fetching data for backup:', err);
      }
    };
    fetchData();
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      exportToExcel(teachers, exams, rooms, roles);
      setStatus({
        type: 'success',
        message: lang === 'pt' ? 'Cópia de segurança Excel gerada com sucesso.' : 'Excel backup generated successfully.'
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message: lang === 'pt' ? 'Erro ao gerar cópia de segurança.' : 'Error generating backup.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      lang === 'pt' 
        ? 'Atenção: A importação de Excel irá substituir TODOS os dados atuais de Professores, Exames, Salas e Cargos. Deseja continuar?' 
        : 'Warning: Excel import will replace ALL current data for Teachers, Exams, Rooms and Roles. Do you want to continue?'
    );

    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    setStatus(null);

    try {
      const data = await importFromExcel(file, roles);
      const result = await api.import.bulk(data);

      if (result.error) {
        throw new Error(result.detail || result.error);
      }

      const clearedTables = result.cleared
        ? Object.entries(result.cleared)
            .filter(([, wasCleared]) => wasCleared)
            .map(([table]) => table)
            .join(', ')
        : '';

      setStatus({
        type: 'success',
        message: lang === 'pt'
          ? `Importação concluída: ${result.stats.teachers} professores, ${result.stats.exams} exames, ${result.stats.rooms} salas, ${result.stats.roles} cargos.${clearedTables ? ` Tabelas limpas: ${clearedTables}.` : ''}`
          : `Import finished: ${result.stats.teachers} teachers, ${result.stats.exams} exams, ${result.stats.rooms} rooms, ${result.stats.roles} roles.${clearedTables ? ` Cleared tables: ${clearedTables}.` : ''}`
      });
      
      // Refresh local state or force reload
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error('Import error:', err);
      setStatus({
        type: 'error',
        message: lang === 'pt' ? `Erro na importação: ${err.message}` : `Import error: ${err.message}`
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {lang === 'pt' ? 'Gestão de Dados (Excel)' : 'Data Management (Excel)'}
          </h2>
          <p className="text-slate-500 text-xs">
            {lang === 'pt' 
              ? 'Importação e exportação unificada de tabelas base via Excel.' 
              : 'Unified import and export of base tables via Excel.'}
          </p>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-lg flex items-center space-x-3 text-sm ${
          status.type === 'success' ? 'bg-blue-50 text-blue-800 border border-blue-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
        }`}>
          {status.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 text-blue-600">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Download className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-800">
              {lang === 'pt' ? 'Exportar para Excel' : 'Export to Excel'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {lang === 'pt' 
              ? 'Descarregue um ficheiro Excel (.xlsx) contendo todos os dados de Professores, Exames, Salas e Cargos. Os IDs internos são omitidos para facilitar a edição manual.' 
              : 'Download an Excel file (.xlsx) containing all Teachers, Exams, Rooms and Roles data. Internal IDs are omitted to facilitate manual editing.'}
          </p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span>{lang === 'pt' ? 'Gerar Ficheiro Excel' : 'Generate Excel File'}</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 text-indigo-600">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Upload className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-800">
              {lang === 'pt' ? 'Importar de Excel' : 'Import from Excel'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {lang === 'pt' 
              ? 'Atualize todas as tabelas base carregando um ficheiro Excel. Este processo substitui os dados atuais e limpa as distribuições existentes.' 
              : 'Update all base tables by uploading an Excel file. This process replaces current data and clears existing distributions.'}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            <span>{lang === 'pt' ? 'Carregar Ficheiro Excel' : 'Upload Excel File'}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".xlsx"
            className="hidden"
          />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-900">
            {lang === 'pt' ? 'Informação Importante' : 'Important Information'}
          </h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            {lang === 'pt' 
              ? 'Para garantir a integridade dos dados, utilize sempre o ficheiro exportado como base para as suas edições. Não altere os nomes das colunas nem das folhas do Excel.' 
              : 'To ensure data integrity, always use the exported file as a basis for your edits. Do not change the names of the columns or the Excel sheets.'}
          </p>
        </div>
      </div>
    </div>
  );
}
