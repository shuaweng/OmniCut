// Only the latest project snapshot matters when an SSE consumer is slow.
export function latestEvents(res) {
 let blocked=false,pending,closed=false;
 const write=value=>{blocked=!res.write('data: '+JSON.stringify(value)+'\n\n');};
 const drain=()=>{blocked=false;if(pending!==undefined){const value=pending;pending=undefined;write(value);}};
 const close=()=>{closed=true;pending=undefined;res.off('drain',drain);};
 res.on('drain',drain);res.once('close',close);
 return {
  send(value){if(closed||res.destroyed)return;if(blocked){pending=value;return;}write(value);},
  heartbeat(){if(!closed&&!blocked&&!res.destroyed)blocked=!res.write(': heartbeat\n\n');},
 };
}
