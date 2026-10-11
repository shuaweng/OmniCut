// Keep only user edits, rather than replaying an old inspector over fresh data.
export function createEditorDrafts() {
 const drafts=new Map();
 const controls=el=>[...el.querySelectorAll('input:not([type=file]):not([type=hidden]),textarea,select')];
 const key=node=>{
  const form=node.closest('form'),entity=node.closest('[data-draft-entity]')?.dataset.draftEntity||'';
  return [entity,form?.dataset.param||form?.dataset.time||form?.id||'',node.id||node.name||node.getAttribute('aria-label')||node.placeholder].join('|');
 };
 const value=node=>node.type==='checkbox'||node.type==='radio'?node.checked:node.value;
 const viewOnly=node=>node.type==='search'||node.getAttribute('aria-label')==='素材类型';
 const initial=node=>node.type==='checkbox'||node.type==='radio'?node.defaultChecked:node.tagName==='SELECT'?[...node.options].find(o=>o.defaultSelected)?.value||node.options[0]?.value||'':node.defaultValue;
 return {
  capture(scope,el){
   if(!scope||!el)return;
   const entries=drafts.get(scope)||new Map();
   const focused=el.ownerDocument?.activeElement;
   entries.focus=focused&&el.contains(focused)?{key:key(focused),start:focused.selectionStart,end:focused.selectionEnd}:null;
   for(const node of controls(el)){const id=key(node);if(value(node)!==initial(node))entries.set(id,value(node));else entries.delete(id);}
   if(entries.size)drafts.set(scope,entries);else drafts.delete(scope);
  },
  restore(scope,el){
   const entries=drafts.get(scope);if(!entries)return false;let restored=false;
   for(const node of controls(el)){
    const id=key(node);if(!entries.has(id))continue;const next=entries.get(id);
    if(value(node)===next){entries.delete(id);continue;}
    if(node.type==='checkbox'||node.type==='radio')node.checked=next;else node.value=next;
    // Filters are view state. Replaying edit-control change handlers would save
    // the user's draft without their action.
    if(viewOnly(node))node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));else restored=true;
    if(entries.focus?.key===id){node.focus();if(typeof entries.focus.start==='number')node.setSelectionRange?.(entries.focus.start,entries.focus.end);}
   }
   if(!entries.size)drafts.delete(scope);return restored;
  },
  clear(scope){drafts.delete(scope);},
  hasPending(el){return !!el&&controls(el).some(node=>!viewOnly(node)&&value(node)!==initial(node));},
 };
}
