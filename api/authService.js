import { getUserByEmail, saveUser } from '../js/users.js';
import { login as createSession, logout as endSession } from '../js/session.js';

// Demo adapter only. Replace these localStorage operations with POST /api/auth/*.
export function register({name,email,password}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (getUserByEmail(normalizedEmail)) throw new Error('EMAIL_TAKEN');
  const user = {id:globalThis.crypto?.randomUUID?.() || `user-${Date.now()}`,name:name.trim(),email:normalizedEmail,password,role:'user',createdAt:new Date().toISOString()};
  saveUser(user);
  createSession(user);
  return user;
}

export function login({email,password}) {
  const user = getUserByEmail(email);
  if (!user || user.password !== password) throw new Error('INVALID_CREDENTIALS');
  createSession(user);
  return user;
}

export const authenticate=login;
export function logout() { endSession(); }
