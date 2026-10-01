import { getUserByEmail, saveUser } from '../js/users.js';
import { getCurrentUser } from '../js/session.js';

// DEMO ONLY: data and password remain editable in localStorage. Use server-side validation and password hashes in production.
export function updateProfile({name,email}) {
  const current = getCurrentUser();
  if (!current) throw new Error('UNAUTHENTICATED');
  const normalizedEmail = email.trim().toLowerCase();
  const conflict = getUserByEmail(normalizedEmail);
  if (conflict && conflict.id !== current.id) throw new Error('EMAIL_TAKEN');
  return saveUser({...current,name:name.trim(),email:normalizedEmail});
}

export function changePassword({currentPassword,newPassword}) {
  const current = getCurrentUser();
  if (!current) throw new Error('UNAUTHENTICATED');
  if (current.password !== currentPassword) throw new Error('WRONG_PASSWORD');
  if (newPassword.length < 6) throw new Error('PASSWORD_TOO_SHORT');
  return saveUser({...current,password:newPassword});
}
