/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { signIn as googleSignIn } from "next-auth/react";
import { translations } from '../translations';
import { Language, UserSession, Teacher, UserRole } from '../types';
import { Shield, BookOpen, ArrowRight, Globe, User, Mail, Lock, CheckCircle2, UserPlus } from 'lucide-react';
import { SchoolShipIcon } from './SchoolLogo';

interface LoginProps {
  lang: Language;
  onSetLang: (lang: Language) => void;
  onLoginSuccess: (session: UserSession) => void;
  teachersList: Array<Teacher>;
  onRegisterTeacher: (teacher: Teacher) => void;
}

const localTranslations = {
  pt: {
    signIn: "Iniciar Sessão",
    signUp: "Registar Nova Conta",
    noAccount: "Ainda não tem conta?",
    hasAccount: "Já tem uma conta registada?",
    createAccountBtn: "Criar Conta de Acesso",
    signInBtn: "Entrar no Portal",
    adminRole: "Coordenador de Exames (Admin)",
    teacherRole: "Professor / Vigilante",
    regSuccess: "Registo concluído! A entrar no portal...",
    passwordsMismatch: "As palavras-passe não coincidem!",
    invalidFields: "Por favor, preencha todos os campos corretamente.",
    emailExists: "Este email já se encontra registado por outro utilizador!",
    fullName: "Nome Completo",
    subjGroup: "Grupo Disciplinar (ex. 500, 300, 510)",
    subjectName: "Disciplina de Docência (ex. Matemática, Português)",
    confirmPass: "Confirmar Palavra-passe",
    registerTitle: "Registo de Utilizador",
    registerSubtitle: "Crie uma conta para coordenar as vigilâncias ou verificar a sua escala de exames",
    demoHint: "Pode usar as credenciais padrão admin@escola.pt / admin123 para demonstração.",
    anyTeacherHint: "Docentes integrados podem entrar com o seu email e qualquer palavra-passe.",
    or: "ou",
    quickFill: "Preenchimento Rápido (Demonstração)"
  },
  en: {
    signIn: "Sign In",
    signUp: "Create New Account",
    noAccount: "Don't have an account yet?",
    hasAccount: "Already have an account?",
    createAccountBtn: "Create Account",
    signInBtn: "Sign In to Portal",
    adminRole: "Exam Coordinator (Admin)",
    teacherRole: "Teacher / Invigilator",
    regSuccess: "Registration successful! Signing you in...",
    passwordsMismatch: "Passwords do not match!",
    invalidFields: "Please fill in all fields correctly.",
    emailExists: "This email address is already registered by another user!",
    fullName: "Full Name",
    subjGroup: "Subject Group (e.g. 500, 300, 510)",
    subjectName: "Teaching Subject (e.g. Mathematics, Portuguese)",
    confirmPass: "Confirm Password",
    registerTitle: "User Registration",
    registerSubtitle: "Create an account to coordinate exams or check your roster scale schedules",
    demoHint: "You may use the default admin@escola.pt / admin123 for initial demo.",
    anyTeacherHint: "Integrated teachers can sign in with their email and any password.",
    or: "or",
    quickFill: "Quick Fill (Demo Profile)"
  }
};

export default function LoginScreen({ lang, onSetLang, onLoginSuccess, teachersList, onRegisterTeacher }: LoginProps) {
  // Status logs
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const t = translations[lang];

  return (
    <div id="login_screen" className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-6">
      
      {/* Top Bar with Language select */}
      <div className="flex justify-between items-center max-w-6xl mx-auto w-full font-sans">
        <div className="flex items-center space-x-3">
          <SchoolShipIcon className="h-10 w-10 text-blue-400 animate-pulse" color="#3b82f6" />
          <span className="font-semibold text-lg tracking-wider bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Escola Secundária D. João II
          </span>
        </div>
        <button
          onClick={() => onSetLang(lang === 'pt' ? 'en' : 'pt')}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 px-3/5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer text-slate-300 hover:text-white"
        >
          <Globe className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold">{lang === 'pt' ? 'EN' : 'PT'}</span>
        </button>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="bg-slate-800/80 border border-slate-700 p-10 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-md">
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black tracking-tight text-white mb-2">
                {t.loginTitle}
              </h1>
              <p className="text-slate-400 text-xs">
                {t.loginSubtitle}
              </p>
            </div>

            <div className="space-y-6">
              <button
                type="button"
                onClick={() => googleSignIn('google')}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl text-sm tracking-wider flex items-center justify-center space-x-3 transition shadow-lg cursor-pointer"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google Login</span>
              </button>

              {errorMsg && (
                <div className="text-rose-400 text-xs font-semibold bg-rose-950/40 border border-rose-900/60 p-3 rounded-lg text-center">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-emerald-400 text-xs font-semibold bg-emerald-950/40 border border-emerald-900/60 p-3 rounded-lg flex items-center justify-center space-x-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>

            <div className="mt-10 pt-6 border-t border-slate-700/60 text-center">
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
                {lang === 'pt' ? 'Acesso Restrito' : 'Restricted Access'}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 px-4 leading-relaxed">
                {lang === 'pt' 
                  ? 'Apenas utilizadores autorizados pelo Secretariado de Exames podem aceder a esta plataforma.' 
                  : 'Only users authorized by the Exam Secretariat can access this platform.'}
              </p>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-500 max-w-6xl mx-auto w-full border-t border-slate-800/40 pt-4">
        <p>&copy; 2026 {t.appName} - {t.schoolYear}. Todos os direitos reservados.</p>
      </div>

    </div>
  );
}
