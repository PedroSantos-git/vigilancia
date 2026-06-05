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
  // Mode selection: false = login, true = register
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration Role selector
  const [regRole, setRegRole] = useState<UserRole>('admin');

  // Input States
  const [email, setEmail] = useState('admin@escola.pt');
  const [password, setPassword] = useState('admin123');

  // Register Input States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regSubjectGroup, setRegSubjectGroup] = useState('');
  const [regSubject, setRegSubject] = useState('');

  // Status logs
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const t = translations[lang];
  const lt = localTranslations[lang];

  // Load custom admins from localStorage
  const getRegisteredAdmins = () => {
    const saved = localStorage.getItem('v_custom_admins');
    const defaults = [
      { email: 'admin@escola.pt', password: 'admin123', name: 'Coordenador Principal de Exames' }
    ];
    return saved ? JSON.parse(saved) : defaults;
  };

  // Save custom admin to localStorage
  const saveCustomAdmin = (admin: { email: string; password: string; name: string }) => {
    const list = getRegisteredAdmins();
    list.push(admin);
    localStorage.setItem('v_custom_admins', JSON.stringify(list));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const targetEmail = email.trim().toLowerCase();

    // 1. Check in Admin registry
    const adminsList = getRegisteredAdmins();
    const matchedAdmin = adminsList.find((a: any) => a.email.toLowerCase() === targetEmail);

    if (matchedAdmin) {
      if (password === matchedAdmin.password || password === 'admin123' /* demo bypass */) {
        setSuccessMsg(lang === 'pt' ? 'Acesso concedido. Bem-vindo!' : 'Access granted. Welcome!');
        setTimeout(() => {
          onLoginSuccess({
            role: 'admin',
            email: matchedAdmin.email,
            name: matchedAdmin.name
          });
        }, 500);
        return;
      } else {
        setErrorMsg(t.incorrectCredentials);
        return;
      }
    }

    // 2. Check in Teachers list
    const matchedTeacher = teachersList.find(tchr => tchr.email.toLowerCase() === targetEmail);
    if (matchedTeacher) {
      // For demo / preset teachers, verify if they have a registered password, otherwise accept any password
      const savedPassMap = localStorage.getItem('v_teacher_passwords');
      const passMap = savedPassMap ? JSON.parse(savedPassMap) : {};
      const registeredPassword = passMap[targetEmail];

      if (!registeredPassword || password === registeredPassword || password === 'admin123') {
        setSuccessMsg(lang === 'pt' ? 'Acesso concedido. Bem-vindo ao seu portal!' : 'Access granted. Welcome to your portal!');
        setTimeout(() => {
          onLoginSuccess({
            role: 'teacher',
            teacherId: matchedTeacher.id,
            email: matchedTeacher.email,
            name: matchedTeacher.name
          });
        }, 500);
      } else {
        setErrorMsg(t.incorrectCredentials);
      }
    } else {
      setErrorMsg(t.incorrectCredentials);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Field basic validations
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg(lt.invalidFields);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg(lt.passwordsMismatch);
      return;
    }

    const emailLower = regEmail.trim().toLowerCase();

    // Guard duplicate email check in admins and teachers
    const adminsList = getRegisteredAdmins();
    const emailExistsInAdmins = adminsList.some((a: any) => a.email.toLowerCase() === emailLower);
    const emailExistsInTeachers = teachersList.some(tchr => tchr.email.toLowerCase() === emailLower);

    if (emailExistsInAdmins || emailExistsInTeachers) {
      setErrorMsg(lt.emailExists);
      return;
    }

    if (regRole === 'admin') {
      const newAdmin = {
        email: emailLower,
        password: regPassword,
        name: regName.trim()
      };
      saveCustomAdmin(newAdmin);
      setSuccessMsg(lt.regSuccess);
      setTimeout(() => {
        onLoginSuccess({
          role: 'admin',
          email: newAdmin.email,
          name: newAdmin.name
        });
      }, 800);
    } else {
      // Create new teacher
      if (!regSubjectGroup.trim() || !regSubject.trim()) {
        setErrorMsg(lt.invalidFields);
        return;
      }

      const newTeacher: Teacher = {
        id: `t_reg_${Date.now()}`,
        name: regName.trim(),
        subjectGroup: regSubjectGroup.trim(),
        subject: regSubject.trim(),
        role: 'Professor',
        email: emailLower,
        available: true,
        unavailabilities: []
      };

      // Call parent dispatch to appent teacher
      onRegisterTeacher(newTeacher);

      // Save password
      const savedPassMap = localStorage.getItem('v_teacher_passwords');
      const passMap = savedPassMap ? JSON.parse(savedPassMap) : {};
      passMap[emailLower] = regPassword;
      localStorage.setItem('v_teacher_passwords', JSON.stringify(passMap));

      setSuccessMsg(lt.regSuccess);
      setTimeout(() => {
        onLoginSuccess({
          role: 'teacher',
          teacherId: newTeacher.id,
          email: newTeacher.email,
          name: newTeacher.name
        });
      }, 800);
    }
  };

  const handleQuickPreFill = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setEmail('admin@escola.pt');
    setPassword('admin123');
  };

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

      {/* Main Login Card with layout transitions */}
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="bg-slate-800/80 border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-md backdrop-blur-md">
          
          <AnimatePresence mode="wait">
            {!isRegistering ? (
              <motion.div
                key="login-view"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.18 }}
              >
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-black tracking-tight text-white mb-2">
                    {t.loginTitle}
                  </h1>
                  <p className="text-slate-400 text-xs">
                    {t.loginSubtitle}
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center space-x-1">
                      <Mail className="h-3 w-3 text-slate-400" />
                      <span>{t.emailPlaceholder}</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email@escola.pt"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center space-x-1">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>{t.password}</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>

                  {errorMsg && (
                    <div className="text-rose-400 text-xs font-semibold bg-rose-950/40 border border-rose-900/60 p-2.5 rounded-lg">
                      {errorMsg}
                    </div>
                  )}

                  {successMsg && (
                    <div className="text-emerald-400 text-xs font-semibold bg-emerald-950/40 border border-emerald-900/60 p-2.5 rounded-lg flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <button
                    id="submit_login_button"
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-950/30 cursor-pointer"
                  >
                    <span>{t.loginBtn}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="flex items-center space-x-2 py-1">
                    <div className="flex-1 h-px bg-slate-700"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{lt.or}</span>
                    <div className="flex-1 h-px bg-slate-700"></div>
                  </div>

                  <button
                    type="button"
                    onClick={() => googleSignIn('google')}
                    className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-2.5 rounded-lg text-xs tracking-wider flex items-center justify-center space-x-2 transition shadow-lg cursor-pointer"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                </form>

                {/* Setup demo profiles trigger */}
                <div className="mt-6 pt-5 border-t border-slate-700/60 flex flex-col space-y-3.5">
                  <button
                    type="button"
                    onClick={handleQuickPreFill}
                    className="flex items-center justify-center space-x-2 bg-slate-900/80 hover:bg-slate-950 text-slate-300 hover:text-blue-400 border border-slate-700 hover:border-blue-600/50 py-2.5 px-4 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span>{lt.quickFill}</span>
                  </button>

                  <div className="text-[11px] text-slate-400 bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                    <p className="font-semibold text-[10px] text-slate-300 flex items-center space-x-1 pt-0.5">
                      <span>•</span>
                      <span>{lt.demoHint}</span>
                    </p>
                    <p className="font-semibold text-[10px] text-slate-300 flex items-center space-x-1">
                      <span>•</span>
                      <span>{lt.anyTeacherHint}</span>
                    </p>
                  </div>

                  <p className="text-center text-xs text-slate-400 pt-2 font-medium">
                    {lt.noAccount}{" "}
                    <button
                      onClick={() => {
                        setIsRegistering(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-blue-400 hover:text-blue-300 font-bold underline transition ml-1 cursor-pointer"
                    >
                      {lt.signUp}
                    </button>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="register-view"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.18 }}
              >
                <div className="text-center mb-5">
                  <h1 className="text-2xl font-black tracking-tight text-white mb-1.5">
                    {lt.registerTitle}
                  </h1>
                  <p className="text-slate-400 text-[11px] leading-normal">
                    {lt.registerSubtitle}
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3.5">
                  
                  {/* Custom Role Selector Toggle */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/65 p-1 rounded-lg border border-slate-700/85">
                    <button
                      type="button"
                      onClick={() => setRegRole('admin')}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-bold transition ${
                        regRole === 'admin' 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lt.adminRole}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('teacher')}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-bold transition ${
                        regRole === 'teacher' 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lt.teacherRole}
                    </button>
                  </div>

                  {/* Standard inputs */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>{lt.fullName}</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dra. Clara Silva"
                      value={regName}
                      onChange={(e) => { setRegName(e.target.value); setErrorMsg(''); }}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1">
                      <Mail className="h-3 w-3 text-slate-400" />
                      <span>Email</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="clara.silva@escola.pt"
                      value={regEmail}
                      onChange={(e) => { setRegEmail(e.target.value); setErrorMsg(''); }}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Fields exclusive to Teachers */}
                  {regRole === 'teacher' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                          {lt.subjGroup}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="ex. 500"
                          value={regSubjectGroup}
                          onChange={(e) => { setRegSubjectGroup(e.target.value); setErrorMsg(''); }}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                          {t.examSubject || 'Disciplina'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="ex. Matemática"
                          value={regSubject}
                          onChange={(e) => { setRegSubject(e.target.value); setErrorMsg(''); }}
                          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <span>{t.password}</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => { setRegPassword(e.target.value); setErrorMsg(''); }}
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center space-x-1">
                        <Lock className="h-3 w-3 text-slate-400" />
                        <span>{lt.confirmPass}</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={regConfirmPassword}
                        onChange={(e) => { setRegConfirmPassword(e.target.value); setErrorMsg(''); }}
                        className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="text-rose-400 text-xs font-semibold bg-rose-950/40 border border-rose-900/60 p-2 rounded-lg">
                      {errorMsg}
                    </div>
                  )}

                  {successMsg && (
                    <div className="text-emerald-400 text-xs font-semibold bg-emerald-950/40 border border-emerald-900/60 p-2 rounded-lg flex items-center space-x-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg text-xs tracking-wider uppercase flex items-center justify-center space-x-2 transition shadow-lg shadow-blue-950/30 cursor-pointer mt-2"
                  >
                    <span>{lt.createAccountBtn}</span>
                    <UserPlus className="h-4 w-4" />
                  </button>
                </form>

                <p className="text-center text-xs text-slate-400 pt-5 mt-3 border-t border-slate-700/60">
                  {lt.hasAccount}{" "}
                  <button
                    onClick={() => {
                      setIsRegistering(false);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-blue-400 hover:text-blue-300 font-bold underline transition ml-1 cursor-pointer"
                  >
                    {lt.signIn}
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-500 max-w-6xl mx-auto w-full border-t border-slate-800/40 pt-4">
        <p>&copy; 2026 {t.appName} - {t.schoolYear}. Todos os direitos reservados.</p>
      </div>

    </div>
  );
}
