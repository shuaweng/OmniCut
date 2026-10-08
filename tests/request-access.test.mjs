import test from 'node:test';
import assert from 'node:assert/strict';
import {requestAccessError} from '../server/request-access.mjs';
const headers={host:'localhost:5180','sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
test('external top-level navigation can load only the public shell',()=>{
 assert.equal(requestAccessError({method:'GET',headers},'/',5180),null);
 for(const path of ['/api/projects','/api/config','/dsh/','/api/jobs/example/download'])assert.equal(requestAccessError({method:'GET',headers},path,5180),'不允许跨站访问');
});
test('cross-site fetch, iframe, mutation and foreign host stay blocked',()=>{
 for(const extra of [{'sec-fetch-mode':'cors','sec-fetch-dest':'empty'},{'sec-fetch-dest':'iframe'}])assert.equal(requestAccessError({method:'GET',headers:{...headers,...extra}},'/',5180),'不允许跨站访问');
 assert.equal(requestAccessError({method:'POST',headers:{...headers,origin:'https://example.com'}},'/api/settings',5180),'不允许跨站修改');
 assert.equal(requestAccessError({method:'GET',headers:{...headers,host:'example.com:5180'}},'/',5180),'仅允许本机访问');
});
test('same-origin project requests and local clients remain supported',()=>{
 assert.equal(requestAccessError({method:'POST',headers:{host:'localhost:5180',origin:'http://localhost:5180','sec-fetch-site':'same-origin'}},'/api/projects',5180),null);
 assert.equal(requestAccessError({method:'GET',headers:{host:'127.0.0.1:5180'}},'/api/projects',5180),null);
});
