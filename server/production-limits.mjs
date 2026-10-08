// Structural limits describe the editing contract, not a hidden media budget.
// Reference frames, characters, alternatives and revisions do not map 1:1 to shots.
export function productionLimits(plan){
 const scenes=Math.min(30,plan?.scenes?.length||0);
 return {scenes:30,images:null,videos:null,audio:null,operations:Math.max(80,scenes*8+40),mediaPolicy:'媒体生成不按镜头数量设次数配额。按用户目标与已确认预算执行；复用合格素材。相同操作保持 operationId，查询中断先恢复原任务，不能靠更换 ID 重复提交。'};
}
