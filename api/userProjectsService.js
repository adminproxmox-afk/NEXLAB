import { getCurrentUser } from '../js/session.js';
import { projects } from '../js/products.js';

const key=userId=>`nexlab_projects_${userId}`;
function read(userId) { try { return JSON.parse(localStorage.getItem(key(userId))) || []; } catch { return []; } }
function write(userId,items) { localStorage.setItem(key(userId),JSON.stringify(items)); }

export async function getMyProjects(userId=getCurrentUser()?.id) {
  if (!userId) return [];
  const saved=localStorage.getItem(key(userId));
  if (saved !== null) return read(userId);
  const now=new Date().toISOString();
  const examples=['weather-station','smart-lamp'].map((projectId,index)=>({id:`demo-${userId}-${index}`,userId,projectId,progress:index?35:80,components:projects.find(project=>project.id===projectId)?.components || [],createdAt:now}));
  write(userId,examples);
  return examples;
}

export async function saveMyProject(projectId,user=getCurrentUser()) {
  if (!user) throw new Error('UNAUTHENTICATED');
  if (!projects.some(project=>project.id===projectId)) throw new Error('PROJECT_NOT_FOUND');
  const items=await getMyProjects(user.id);
  const exists=items.find(item=>item.projectId===projectId);
  if (exists) return exists;
  const record={id:globalThis.crypto?.randomUUID?.() || `saved-${Date.now()}`,userId:user.id,projectId,progress:0,components:projects.find(project=>project.id===projectId).components,createdAt:new Date().toISOString()};
  write(user.id,[record,...items]);
  return record;
}
