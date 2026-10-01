const USERS_KEY = 'nexlab_users';

function readUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

export const getUsers = readUsers;
export const getUserById = id => readUsers().find(user => user.id === id) || null;
export const getUserByEmail = email => readUsers().find(user => user.email.toLowerCase() === email.trim().toLowerCase()) || null;
export function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
export function saveUser(user) {
  const users = readUsers();
  const index = users.findIndex(item => item.id === user.id);
  if (index < 0) users.push(user); else users[index] = user;
  saveUsers(users);
  return user;
}

export async function initializeUsers() {
  if (localStorage.getItem(USERS_KEY) === null) saveUsers([]);
  // DEMO ONLY: localStorage authentication is not secure. Passwords are plaintext here; never do this in production.
  // Replace with server authentication and password hashes. Client role values are editable and must never grant server access.
  const admin=getUserByEmail('admin@nexlab.local');
  if (!admin) {
    saveUser({id:'nexlab-admin-demo',name:'Адміністратор',email:'admin@nexlab.local',password:'admin123',role:'admin',createdAt:new Date().toISOString()});
  } else if (admin.id==='nexlab-admin-demo' && admin.name==='Administrator') saveUser({...admin,name:'Адміністратор'});
}
