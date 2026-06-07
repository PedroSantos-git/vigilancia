import React, { useState, useEffect } from 'react';
import { Language, EmailSettings } from '../types';
import { Mail, Save, Loader2, CheckCircle2, AlertCircle, Key, Settings } from 'lucide-react';
import { api } from '../utils/api';

interface EmailConfigManagerProps {
  lang: Language;
}

export default function EmailConfigManager({ lang }: EmailConfigManagerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [subjectPrefix, setSubjectPrefix] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [resendApiKey, setResendApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const data: EmailSettings = await api.emailConfig.get();
      setFromEmail(data.fromEmail || '');
      setFromName(data.fromName || '');
      setReplyTo(data.replyTo || '');
      setSchoolName(data.schoolName || '');
      setSubjectPrefix(data.subjectPrefix || '');
      setEnabled(data.enabled || false);
      setResendApiKey(data.resendApiKey || '');
      setHasApiKey(data.hasApiKey || false);
    } catch (err) {
      console.error('Error fetching email config:', err);
      setError(lang === 'pt' ? 'Erro ao carregar configuração de email.' : 'Error loading email configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.emailConfig.save({
        fromEmail,
        fromName,
        replyTo,
        schoolName,
        subjectPrefix,
        enabled,
        resendApiKey: resendApiKey === '••••••••' ? undefined : resendApiKey
      });
      setSuccess(lang === 'pt' ? 'Configuração guardada com sucesso!' : 'Configuration saved successfully!');
      fetchConfig();
    } catch (err) {
      setError(lang === 'pt' ? 'Erro ao guardar configuração.' : 'Error saving configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-5 w-5 text-blue-400" />
          <h2 className="text-xl font-bold tracking-tight">
            {lang === 'pt' ? 'Config Email (Resend)' : 'Email Config (Resend)'}
          </h2>
        </div>
        <p className="text-slate-400 text-xs">
          {lang === 'pt'
            ? 'Configure os dados necessários para enviar notificações de vigilância via Resend.'
            : 'Configure the settings required to send invigilation notifications via Resend.'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-800">
              {lang === 'pt' ? 'Envio de emails ativo' : 'Email sending enabled'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {lang === 'pt'
                ? 'Desative para impedir envios acidentais.'
                : 'Disable to prevent accidental sends.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative w-11 h-6 rounded-full transition ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="h-3 w-3" />
            Resend API Key
          </label>
          <input
            type="password"
            value={resendApiKey}
            onChange={e => setResendApiKey(e.target.value)}
            placeholder={hasApiKey ? '••••••••' : 're_xxxxxxxx'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-[10px] text-slate-400">
            {lang === 'pt'
              ? 'Opcional se definir RESEND_API_KEY nas variáveis de ambiente da Vercel.'
              : 'Optional if RESEND_API_KEY is set in Vercel environment variables.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {lang === 'pt' ? 'Email de envio (From) *' : 'From email *'}
            </label>
            <input
              type="email"
              required
              value={fromEmail}
              onChange={e => setFromEmail(e.target.value)}
              placeholder="vigilancias@escola.pt"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {lang === 'pt' ? 'Nome do remetente' : 'Sender name'}
            </label>
            <input
              type="text"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              placeholder="Vigilâncias de Exames"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Reply-To
          </label>
          <input
            type="email"
            value={replyTo}
            onChange={e => setReplyTo(e.target.value)}
            placeholder="secretaria@escola.pt"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {lang === 'pt' ? 'Nome da escola' : 'School name'}
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              placeholder="Escola Secundária D. João II"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {lang === 'pt' ? 'Prefixo do assunto' : 'Subject prefix'}
            </label>
            <input
              type="text"
              value={subjectPrefix}
              onChange={e => setSubjectPrefix(e.target.value)}
              placeholder="Vigilância de Exame"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-6 py-3 rounded-lg transition disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{lang === 'pt' ? 'Guardar Configuração' : 'Save Configuration'}</span>
        </button>
      </form>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-2">
        <p className="font-bold flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {lang === 'pt' ? 'Requisitos Resend' : 'Resend requirements'}
        </p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li>{lang === 'pt' ? 'Conta em resend.com com domínio verificado.' : 'Account at resend.com with verified domain.'}</li>
          <li>{lang === 'pt' ? 'O email "From" deve pertencer ao domínio verificado.' : 'The "From" email must belong to the verified domain.'}</li>
          <li>{lang === 'pt' ? 'Ative o envio e configure a API Key antes de usar "Enviar Notificações".' : 'Enable sending and configure the API Key before using "Send Notifications".'}</li>
        </ul>
      </div>
    </div>
  );
}
