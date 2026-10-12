import { request } from './client.js';
import { setSession, logout as endSession } from '../js/session.js';
export async function register(input) {return setSession(await request('auth/register',{method:'POST',body:input}));}
export async function login(input) {return setSession(await request('auth/login',{method:'POST',body:input}));}
export const authenticate = login;
export const logout = endSession;
