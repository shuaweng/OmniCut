export const PRODUCTION_ROUTES=['generated','code','hybrid'];
export function productionRoute(value,fallback='generated'){
 const route=value===undefined?fallback:value;if(!PRODUCTION_ROUTES.includes(route))throw Error('制作路线需为 generated、code 或 hybrid');return route;
}
export function planRoutes(plan,previous){
 if(!plan)return plan;
 const scenes=(plan.scenes||[]).map((scene,index)=>{
  if(!scene||typeof scene!=='object'||Array.isArray(scene))throw Error('镜头计划格式无效');
  const prior=scene.id?previous?.scenes?.find(value=>value.id===scene.id):previous?.scenes?.[index];
  return {...scene,route:productionRoute(scene.route,productionRoute(plan.route,productionRoute(prior?.route,productionRoute(previous?.route))))};
 });
 const routes=new Set(scenes.map(scene=>scene.route));return {...plan,route:routes.size>1?'hybrid':routes.values().next().value||productionRoute(plan.route,productionRoute(previous?.route)),scenes};
}
export const needsNativeRoute=plan=>(plan?.scenes||[]).some(scene=>productionRoute(scene.route,plan?.route||'generated')!=='generated');
