import { projects } from '../js/products.js';
export { projects };
export async function getProjects() { return projects; }
export async function getProjectById(id) { return projects.find(project => project.id === id) || null; }
