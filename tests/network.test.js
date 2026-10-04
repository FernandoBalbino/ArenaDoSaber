import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createApp} from '../server/app.js';
const emit=(socket,event,data={})=>new Promise((resolve,reject)=>socket.timeout(3000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
const connect=(url,transports=['websocket'])=>new Promise((resolve,reject)=>{const s=io(url,{transports,forceNew:true,reconnection:false});s.on('connect',()=>resolve(s));s.on('connect_error',reject);});
test('HTTP, Socket.IO, permissões, isolamento, 30 entradas simultâneas e retomada',async()=>{
 const app=createApp({autoTick:false}),sockets=[];await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.http.address().port}`;
 try{
  assert.equal((await fetch(url+'/healthz')).status,200);for(const path of ['/data/questions.json','/server/app.js','/.env','/package.json','/data/source/hardware.txt'])assert.equal((await fetch(url+path)).status,404,path);
  const home=await fetch(url);assert.ok(home.headers.get('content-security-policy'));assert.equal((await fetch(url+'/vendor/phaser.min.js')).status,200);
  const t=await connect(url);sockets.push(t);const created=await emit(t,'room:create',{capacity:30});assert.equal(created.ok,true);const code=created.code;
  const students=await Promise.all(Array.from({length:30},()=>connect(url)));sockets.push(...students);const joined=await Promise.all(students.map((s,i)=>emit(s,'room:join',{code,name:'Estudante '+i})));assert.ok(joined.every(r=>r.ok));const room=app.rooms.get(code);assert.equal(new Set([...room.players.values()].map(p=>p.appearance.shirt)).size,30);
  assert.equal((await emit(students[0],'teacher:action',{action:'start'})).ok,false);assert.equal((await emit(t,'teacher:action',{action:'start'})).ok,true);
  const leaked=[];students[1].onAny((event,data)=>{if(event!=='player:private')leaked.push(JSON.stringify(data));});app.tick(20000);app.tick(3000);await new Promise(r=>setTimeout(r,40));for(const value of leaked){assert.ok(!value.includes(created.token));assert.ok(!value.includes(joined[0].token));assert.ok(!value.includes('correctIndex'));}
  const a=room.players.get(joined[0].id);a.power='blast';assert.equal((await emit(students[0],'power:use',{x:99999})).ok,false);assert.equal(a.used,false);
  assert.equal((await emit(students[0],'chat:send',{text:'<img src=x onerror=alert(1)>'})).ok,true);assert.equal(room.chat[0].text,'<img src=x onerror=alert(1)>');assert.equal((await emit(students[0],'chat:send',{text:'spam'})).ok,false);
  assert.equal((await emit(t,'teacher:action',{action:'mute',id:a.id})).ok,true);assert.equal((await emit(students[0],'chat:send',{text:'silenciado'})).ok,false);
  const appearance={...a.appearance};students[0].disconnect();await new Promise(r=>setTimeout(r,25));const again=await connect(url,['polling']);sockets.push(again);const resumed=await emit(again,'session:resume',{code,token:joined[0].token});assert.equal(resumed.ok,true);assert.deepEqual(room.players.get(a.id).appearance,appearance);assert.equal(resumed.self.power,'blast');
  const t2=await connect(url);sockets.push(t2);const room2=await emit(t2,'room:create',{});assert.notEqual(room2.code,code);assert.equal(room2.state.players.length,0);assert.equal((await emit(t2,'teacher:action',{action:'kick',id:a.id})).ok,false);
  assert.equal((await emit(t,'teacher:action',{action:'clearChat'})).ok,true);assert.equal(room.chat.length,0);assert.equal((await emit(t,'teacher:action',{action:'kick',id:a.id})).ok,true);assert.equal(room.players.has(a.id),false);assert.equal((await emit(again,'session:resume',{code,token:joined[0].token})).ok,false);
 }finally{for(const s of sockets)s.disconnect();await app.close();}
});
