import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {latestEvents} from '../server/latest-events.mjs';
test('slow consumers retain one pending snapshot instead of queuing every update',()=>{
 const response=new EventEmitter(),writes=[];
 response.write=text=>{writes.push(text);return false;};
 const events=latestEvents(response);
 for(let i=0;i<10000;i++)events.send({revision:i});
 events.heartbeat();assert.equal(writes.length,1);
 response.emit('drain');assert.equal(writes.length,2);
 assert.equal(writes[1],'data: {"revision":9999}\n\n');
 events.send({revision:10000});response.emit('close');response.emit('drain');events.send({revision:10001});
 assert.equal(writes.length,2);
});
