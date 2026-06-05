import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { translations } from '../translations';
import { UserPlus, Trash2, Mail, User, Shield, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api';

interface AuthorizedUser {
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface UserManagerProps {
  lang: Language;
}

export default function UserManager({ lang }: UserManagerProps) {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('admin');

  const t = translations[lang];

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await api.users.getAll();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(lang === 'pt' ? 'Erro ao carregar utilizadores.' : 'Error loading users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.users.save({
        email: newEmail.trim().toLowerCase(),
        name: newName.trim(),
        role: newRole
      });
      setSuccess(lang === 'pt' ? 'Utilizador autorizado com sucesso!' : 'User authorized successfully!');
      setNewEmail('');
      setNewName('');
      fetchUsers();
    } catch (err) {
      setError(lang === 'pt' ? 'Erro ao autorizar utilizador.' : 'Error authorizing user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (email.toLowerCase() === 'pedro.santos@djoaoii.com') {
      setError(lang === 'pt' ? 'Não é possível remover o administrador principal.' : 'Cannot remove the primary administrator.');
      return;
    }

    if (!window.confirm(lang === 'pt' ? `Remover acesso para ${email}?` : `Remove access for ${email}?`)) return;

    try {
      await api.users.delete(email);
      setSuccess(lang === 'pt' ? 'Utilizador removido.' : 'User removed.');
      fetchUsers();
    } catch (err) {
      setError(lang === 'pt' ? 'Erro ao remover utilizador.' : 'Error removing user.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          {lang === 'pt' ? 'Gestão de Acessos (Whitelist)' : 'Access Management (Whitelist)'}
        </h2>
        <p className="text-slate-400 text-xs">
          {lang === 'pt' 
            ? 'Apenas os emails nesta lista poderão fazer login através do Google.' 
            : 'Only emails in this list will be able to sign in via Google.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="md:col-span-1">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-600" />
              {lang === 'pt' ? 'Autorizar Novo Email' : 'Authorize New Email'}
            </h3>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">{lang === 'pt' ? 'Email Google' : 'Google Email'}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="exemplo@gmail.com"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">{lang === 'pt' ? 'Nome / Identificação' : 'Name / ID'}</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={lang === 'pt' ? 'Ex: Coordenador' : 'Ex: Coordinator'}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">{lang === 'pt' ? 'Cargo' : 'Role'}</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                >
                  <option value="admin">Admin / Coordenador</option>
                  <option value="teacher">Professor / Vigilante</option>
                </select>
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {lang === 'pt' ? 'Autorizar Acesso' : 'Authorize Access'}
              </button>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="md:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">{lang === 'pt' ? 'Utilizadores com Acesso' : 'Authorized Users'}</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                {users.length} {lang === 'pt' ? 'Total' : 'Total'}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <span className="text-xs">{lang === 'pt' ? 'A carregar lista...' : 'Loading list...'}</span>
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-xs">{lang === 'pt' ? 'Nenhum utilizador autorizado.' : 'No authorized users.'}</p>
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.email} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        user.email === 'pedro.santos@djoaoii.com' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          {user.name}
                          {user.email === 'pedro.santos@djoaoii.com' && (
                            <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">Owner</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        user.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                        {user.role}
                      </span>
                      <button
                        onClick={() => handleDeleteUser(user.email)}
                        disabled={user.email === 'pedro.santos@djoaoii.com'}
                        className={`p-2 rounded-lg transition ${
                          user.email === 'pedro.santos@djoaoii.com' 
                            ? 'text-slate-200 cursor-not-allowed' 
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
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
