'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  employeeCode?: string;
  isSuperAdmin: boolean;
  companyId?: string | null;
  company?: {
    id: string;
    code: string;
    name: string;
  } | null;
  roles: string[];
  permissions: string[];
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    department?: string;
    designation?: string;
  } | null;
}

export interface Company {
  id: string;
  code: string;
  name: string;
}

export const KNOWN_COMPANIES: Company[] = [
  {
    id: 'SUPERBEE',
    code: 'SUPERBEE',
    name: 'Superbee Aeronautics Private Limited',
  },
  {
    id: 'GTIDS',
    code: 'GTIDS',
    name: 'Gram Tarang Inclusive Development Services Private Limited',
  },
  {
    id: 'CUTMAP',
    code: 'CUTMAP',
    name: 'Centurion University Admission Staff',
  },
];

function mergeWithKnownCompanies(fetched: Company[]): Company[] {
  const map = new Map<string, Company>();
  (fetched || []).forEach((c) => {
    if (c?.code) {
      if (c.code.toUpperCase() === 'GTIB') {
        map.set('CUTMAP', {
          ...c,
          code: 'CUTMAP',
          name: 'Centurion University Admission Staff',
        });
      } else {
        map.set(c.code.toUpperCase(), c);
      }
    }
  });
  KNOWN_COMPANIES.forEach((k) => {
    if (!map.has(k.code.toUpperCase())) {
      map.set(k.code.toUpperCase(), k);
    }
  });
  return Array.from(map.values());
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeCompany: Company | null;
  companies: Company[];
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  loginWithGoogle: (email: string) => Promise<void>;
  logout: () => void;
  switchCompany: (company: Company | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('hrms_token');
    const savedUser = localStorage.getItem('hrms_user');
    const savedActiveCompany = localStorage.getItem('hrms_active_company');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);

        if (savedActiveCompany) {
          try {
            const parsed = JSON.parse(savedActiveCompany);
            if (parsed?.code?.toUpperCase() === 'GTIB') {
              parsed.code = 'CUTMAP';
              parsed.name = 'Centurion University Admission Staff';
              localStorage.setItem('hrms_active_company', JSON.stringify(parsed));
            }
            setActiveCompany(parsed);
          } catch (_) {
            setActiveCompany(JSON.parse(savedActiveCompany));
          }
        } else if (parsedUser.company) {
          const comp = { ...parsedUser.company };
          if (comp?.code?.toUpperCase() === 'GTIB') {
            comp.code = 'CUTMAP';
            comp.name = 'Centurion University Admission Staff';
          }
          setActiveCompany(comp);
        }

        // Fetch authorized companies
        api.get<Company[]>('/companies').then((data) => {
          const merged = mergeWithKnownCompanies(data);
          setCompanies(merged);
          if (!savedActiveCompany && merged.length > 0) {
            setActiveCompany(merged[0]);
            localStorage.setItem('hrms_active_company', JSON.stringify(merged[0]));
            localStorage.setItem('hrms_active_company_id', merged[0].id);
          }
        }).catch(() => {
          setCompanies(KNOWN_COMPANIES);
          if (!savedActiveCompany) {
            setActiveCompany(KNOWN_COMPANIES[0]);
            localStorage.setItem('hrms_active_company', JSON.stringify(KNOWN_COMPANIES[0]));
            localStorage.setItem('hrms_active_company_id', KNOWN_COMPANIES[0].id);
          }
        });
      } catch (e) {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await api.post<{ user: User; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/login',
      { identifier, password },
    );

    localStorage.setItem('hrms_token', res.tokens.accessToken);
    localStorage.setItem('hrms_refresh_token', res.tokens.refreshToken);
    localStorage.setItem('hrms_user', JSON.stringify(res.user));

    setToken(res.tokens.accessToken);
    setUser(res.user);

    // Fetch user companies
    const availableCompanies = await api.get<Company[]>('/companies').catch(() => []);
    const merged = mergeWithKnownCompanies(availableCompanies);
    setCompanies(merged);

    if (res.user.company) {
      setActiveCompany(res.user.company);
      localStorage.setItem('hrms_active_company', JSON.stringify(res.user.company));
      localStorage.setItem('hrms_active_company_id', res.user.company.id);
    } else if (merged.length > 0) {
      setActiveCompany(merged[0]);
      localStorage.setItem('hrms_active_company', JSON.stringify(merged[0]));
      localStorage.setItem('hrms_active_company_id', merged[0].id);
    }

    router.push('/dashboard');
  };

  const loginWithGoogle = async (email: string) => {
    const res = await api.post<{ user: User; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/google',
      { email },
    );

    localStorage.setItem('hrms_token', res.tokens.accessToken);
    localStorage.setItem('hrms_refresh_token', res.tokens.refreshToken);
    localStorage.setItem('hrms_user', JSON.stringify(res.user));

    setToken(res.tokens.accessToken);
    setUser(res.user);

    const availableCompanies = await api.get<Company[]>('/companies').catch(() => []);
    const merged = mergeWithKnownCompanies(availableCompanies);
    setCompanies(merged);

    if (res.user.company) {
      setActiveCompany(res.user.company);
      localStorage.setItem('hrms_active_company', JSON.stringify(res.user.company));
      localStorage.setItem('hrms_active_company_id', res.user.company.id);
    } else if (merged.length > 0) {
      setActiveCompany(merged[0]);
      localStorage.setItem('hrms_active_company', JSON.stringify(merged[0]));
      localStorage.setItem('hrms_active_company_id', merged[0].id);
    }

    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_refresh_token');
    localStorage.removeItem('hrms_user');
    localStorage.removeItem('hrms_active_company');
    localStorage.removeItem('hrms_active_company_id');
    setToken(null);
    setUser(null);
    setActiveCompany(null);
    router.push('/login');
  };

  const switchCompany = (comp: Company | null) => {
    setActiveCompany(comp);
    if (comp) {
      localStorage.setItem('hrms_active_company', JSON.stringify(comp));
      localStorage.setItem('hrms_active_company_id', comp.id);
    } else {
      localStorage.removeItem('hrms_active_company');
      localStorage.setItem('hrms_active_company_id', 'ALL');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeCompany,
        companies,
        isLoading,
        login,
        loginWithGoogle,
        logout,
        switchCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
