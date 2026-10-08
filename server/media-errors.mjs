export function mediaFailure(code,message){
 if(/Image generation is not enabled for this group/i.test(String(message||'')))return {category:'permission',message:'当前密钥分组未开通图片生成',nextAction:'在 Musk 控制台开启分组的图片生成权限，或更换支持图片的 Key。',retryable:false};
 if(code==='MUSIC_API_UNAVAILABLE')return {category:'unavailable',message:'MiniMax Music 3.0 API 当前不可用',nextAction:'可在模型设置中选择 ElevenLabs 配乐。',retryable:false};
 if(code==='SILENT_AUDIO')return {category:'quality',message:'声音接近静音',nextAction:'调整描述后重新生成，或换用已有声音。',retryable:false};
 const raw=String(code||'')+' '+String(message||'');
 if(/AccountOverdue|quota|balance|insufficient.*credit|余额|欠费/i.test(raw))return {category:'quota',message:'服务账户余额或额度不足',nextAction:'检查对应服务账户的额度，或使用已有素材继续制作。',retryable:false};
 if(/system authentication failed|upstream.*auth|(?:502|503|504)\b/i.test(raw))return {category:'provider',message:'服务商上游暂时不可用',nextAction:'先核对服务商任务记录；结果未确认前不要重复提交。',retryable:false};
 if(/fetch failed|timeout|aborted due|network|ECONN/i.test(raw))return {category:'network',message:'服务连接暂时中断',nextAction:'可恢复查询已有任务，无需重新生成。',retryable:true};
 if(/PrivacyInformation|may contain real person/i.test(raw))return {category:'reference_rejected',message:'视频服务不接受这张含写实人物的参考图',nextAction:'改用不含人物的商品参考图，或使用文字描述场景。',retryable:false};
 if(/not available for free|paid plan|subscription|套餐不足/i.test(raw))return {category:'plan',message:'当前套餐未开通这项生成能力',nextAction:'换用已有素材或视频原声，也可在服务商控制台开通后重试。',retryable:false};
 if(/Authentication|Unauthorized|invalid.*key|401/i.test(raw))return {category:'authentication',message:'服务商未接受当前密钥',nextAction:'在模型设置中检查该服务的 Key。',retryable:false};
 if(/AccessDenied|permission|403/i.test(raw))return {category:'permission',message:'当前账户无权使用此模型',nextAction:'检查模型开通状态和 Key 所属项目。',retryable:false};
 if(/quota|balance|credit|余额/i.test(raw))return {category:'quota',message:'服务额度不足',nextAction:'检查服务额度，或使用已有素材继续剪辑。',retryable:false};
 return {category:'provider',message:String(message||'任务未完成'),nextAction:'检查任务详情后再决定是否重试。',retryable:false};
}
