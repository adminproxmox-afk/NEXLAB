import { projects } from '../js/products.js';
import { getProducts } from './productService.js';
export {projects};
export async function getProjects() {
  const products=await getProducts();
  return projects.map(project=>({...project,estimatedPrice:project.components.reduce((sum,item)=>sum+(products.find(p=>p.id===item.productId)?.price || 0)*item.quantity,0)}));
}
export async function getProjectById(id) {return (await getProjects()).find(project=>project.id===id) || null;}
