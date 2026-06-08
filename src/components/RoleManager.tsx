import React, { useState, useEffect } from 'react';
import { Language, TeacherRole } from '../types';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { api } from '../utils/api';

interface RoleManagerProps {
  lang: Language;
}

export default function RoleManager({ lang }: RoleManagerProps) {
  const [roles, setRoles] = useState<TeacherRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingRole, setEditingRole] = useState<TeacherRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const data = await api.roles.getAll();
      if (Array.isArray(data)) {
        setRoles(
          data.map((role: TeacherRole) => ({
            ...role,
            priority: Number(role.priority ?? 0)
          }))
        );
      } else {
        console.error('API returned non-array for roles:', data);
        setRoles([]);
        setError(lang === 'pt' ? 'Erro ao processar dados dos cargos.' : 'Error processing roles data.');
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(lang === 'pt' ? 'Erro ao carregar cargos.' : 'Error loading roles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const sortedRoles = [...roles].sort((a, b) => a.priority - b.priority);

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.roles.save({
        id: editingRole?.id,
        name: roleName.trim(),
        priority: editingRole?.priority
      });
      setSuccess(lang === 'pt' ? 'Cargo guardado com sucesso!' : 'Role saved successfully!');
      setRoleName('');
      setEditingRole(null);
      fetchRoles();
    } catch (err) {
      setError(lang === 'pt' ? 'Erro ao guardar cargo.' : 'Error saving role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (id: string, name: string) => {
    if (!window.confirm(lang === 'pt' ? `Tem a certeza que deseja eliminar o cargo "${name}"?` : `Are you sure you want to delete role "${name}"?`)) return;

    try {
      const res = await api.roles.delete(id);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(lang === 'pt' ? 'Cargo eliminado.' : 'Role deleted.');
        fetchRoles();
      }
    } catch (err) {
      setError(lang === 'pt' ? 'Erro ao eliminar cargo. Verifique se existem professores associados.' : 'Error deleting role. Check if teachers are assigned.');
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;

    setIsSubmitting(true);
    setError('');
    const lines = importText.split('\n').filter(l => l.trim());
    let count = 0;

    try {
      for (const line of lines) {
        await api.roles.save({ name: line.trim() });
        count++;
      }
      setSuccess(lang === 'pt' ? `${count} cargos importados com sucesso!` : `${count} roles imported successfully!`);
      setImportText('');
      setShowImport(false);
      fetchRoles();
    } catch (err) {
      setError(lang === 'pt' ? 'Erro parcial na importação.' : 'Partial error during import.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveRole = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedRoles.length) return;

    const reordered = [...sortedRoles];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    const updatedRoles = reordered.map((role, idx) => ({
      ...role,
      priority: idx + 1
    }));

    setRoles(updatedRoles);

    try {
      await api.roles.updateAll(updatedRoles);
      setSuccess(lang === 'pt' ? 'Ordem dos cargos atualizada.' : 'Role order updated.');
    } catch (err) {
      console.error('Error updating role order:', err);
      setError(lang === 'pt' ? 'Erro ao guardar ordem dos cargos.' : 'Error saving role order.');
      fetchRoles();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-400" />
            {lang === 'pt' ? 'Gestão de Cargos / Funções' : 'Role / Function Management'}
          </h2>
          <p className="text-slate-400 text-xs">
            {lang === 'pt'
              ? 'Defina e ordene os cargos. Na atribuição automática, quando faltarem docentes sem cargo, entram primeiro os cargos no fim desta lista (ordem mais alta).'
              : 'Define and order roles. During auto-allocation, when teachers without roles run out, roles at the bottom of this list (highest order) are used first.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          {showImport ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                {lang === 'pt' ? 'Importação Rápida' : 'Quick Import'}
              </h3>
              <p className="text-[10px] text-slate-500 mb-3">
                {lang === 'pt' ? 'Insira um cargo por linha:' : 'Insert one role per line:'}
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={10}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition font-mono"
                placeholder="Coordenador&#10;Direção&#10;Secretariado..."
              />
              <button
                onClick={handleImport}
                disabled={isSubmitting || !importText.trim()}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {lang === 'pt' ? 'Processar Importação' : 'Process Import'}
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                {editingRole ? <Edit2 className="h-4 w-4 text-amber-500" /> : <Plus className="h-4 w-4 text-blue-600" />}
                {editingRole
                  ? (lang === 'pt' ? 'Editar Cargo' : 'Edit Role')
                  : (lang === 'pt' ? 'Novo Cargo' : 'New Role')}
              </h3>

              <form onSubmit={handleSaveRole} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                    {lang === 'pt' ? 'Nome do Cargo' : 'Role Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Ex: Coordenador"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg text-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {editingRole ? (lang === 'pt' ? 'Atualizar' : 'Update') : (lang === 'pt' ? 'Adicionar' : 'Add')}
                  </button>
                  {editingRole && (
                    <button
                      type="button"
                      onClick={() => { setEditingRole(null); setRoleName(''); }}
                      className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{lang === 'pt' ? 'Lista de Cargos' : 'Roles List'}</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {lang === 'pt'
                    ? 'Ordem de atribuição: de baixo para cima (últimos entram primeiro em vigilâncias).'
                    : 'Assignment order: bottom to top (last roles are used first for invigilation).'}
                </p>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                {roles.length} {lang === 'pt' ? 'Cargos' : 'Roles'}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <span className="text-xs">{lang === 'pt' ? 'A carregar cargos...' : 'Loading roles...'}</span>
                </div>
              ) : sortedRoles.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-xs">{lang === 'pt' ? 'Nenhum cargo definido.' : 'No roles defined.'}</p>
                </div>
              ) : (
                sortedRoles.map((role, index) => (
                  <div key={role.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold">
                        {role.priority}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-slate-700 block truncate">{role.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {lang === 'pt' ? `Ordem ${role.priority}` : `Order ${role.priority}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={index === 0}
                        onClick={() => moveRole(index, 'up')}
                        className={`p-2 rounded-lg transition ${index === 0 ? 'text-slate-200' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={lang === 'pt' ? 'Subir (menos prioritário para vigilâncias)' : 'Move up'}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        disabled={index === sortedRoles.length - 1}
                        onClick={() => moveRole(index, 'down')}
                        className={`p-2 rounded-lg transition ${index === sortedRoles.length - 1 ? 'text-slate-200' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={lang === 'pt' ? 'Descer (mais prioritário para vigilâncias)' : 'Move down'}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setEditingRole(role); setRoleName(role.name); setShowImport(false); }}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
