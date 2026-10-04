import {io} from 'socket.io-client';
import {writeFile,mkdir} from 'node:fs/promises';
import {createApp} from '../server/app.js';
const count=Number(process.env.BOTS)||24,duration=Number(process.env.DURATION_SECONDS)||300;
if(!Number.isInteger(count)||count<2||count>30||!Number.isFinite(duration)||duration<5)throw Error('Use BOTS de 2 a 30 e DURATION_SECONDS >=5.');
const local=process.env.BASE_URL?null:createApp();if(local)await new Promise(r=>local.http.listen(0,'127.0.0.1',r));
const url=process.env.BASE_URL||`http://127.0.0.1:${local.http.address().port}`;
const sockets=[],latencies=[],samples=[];let sent=0,received=0,bytes=0,disconnects=0,failures=0,phase='LOBBY',remaining=0,closing=false,skipping=false;
const emit=(socket,event,data={})=>new Promise((resolve,reject)=>{sent++;socket.timeout(10000).emit(event,data,(err,r)=>err||!r?.ok?reject(err||Error(r?.error)):resolve(r));});
function connect(){return new Promise((resolve,reject)=>{const s=io(url,{transports:['websocket','polling'],tryAllTransports:true,forceNew:true,timeout:30000,reconnection:false});sockets.push(s);s.onAny((_event,data)=>{received++;bytes+=Buffer.byteLength(JSON.stringify(data)||'');});s.on('connect',()=>resolve(s));s.on('connect_error',reject);s.on('disconnect',()=>{if(!closing)disconnects++;});});}
let movement,pings,metrics,status;
try{
 const teacher=await connect(),created=await emit(teacher,'room:create',{capacity:count});teacher.on('room:state',s=>{phase=s.phase;remaining=s.remaining;});teacher.on('room:frame',s=>remaining=s.remaining);
 const players=await Promise.all(Array.from({length:count},async(_,i)=>{const socket=await connect(),joined=await emit(socket,'room:join',{code:created.code,name:`Carga ${i+1}`});const bot={socket,id:joined.id,seq:0,offered:null,used:false};socket.on('player:private',data=>{bot.used=data.used;if(data.offered?.length&&!data.power&&phase==='POWER_SELECTION')emit(socket,'power:choose',{id:data.offered[0]}).catch(()=>{});});return bot;}));
 await emit(teacher,'teacher:action',{action:'start'});const start=Date.now();
 movement=setInterval(()=>{players.forEach((b,i)=>{const cycle=Math.floor((Date.now()-start)/2200+i)%4;sent++;b.socket.emit('player:input',{seq:++b.seq,up:cycle===0,right:cycle===1,down:cycle===2,left:cycle===3});});if(phase==='ROUND_ACTIVE'&&remaining<6000&&!skipping){skipping=true;emit(teacher,'teacher:action',{action:'skip'}).catch(()=>failures++).finally(()=>skipping=false);}},250);
 pings=setInterval(()=>players.forEach(async b=>{const before=performance.now();try{await emit(b.socket,'ping:check');latencies.push(performance.now()-before);}catch{failures++;}}),5000);
 const sample=async()=>{try{const data=await emit(teacher,'diagnostics');samples.push({seconds:Math.round((Date.now()-start)/1000),...data.metrics});}catch{failures++;}};await sample();metrics=setInterval(sample,5000);
 status=setInterval(()=>console.log(`Carga ${count}: ${Math.round((Date.now()-start)/1000)}/${duration}s, ${received} eventos recebidos, ${disconnects} desconexões`),30000);
 await new Promise(r=>setTimeout(r,duration*1000));await sample();clearInterval(movement);clearInterval(pings);clearInterval(metrics);clearInterval(status);
 latencies.sort((a,b)=>a-b);const percentile=p=>Math.round((latencies[Math.min(latencies.length-1,Math.floor(latencies.length*p))]||0)*10)/10;
 const report={environment:local?'local':'public',url,players:count,durationSeconds:(Date.now()-start)/1000,sent,received,jsonPayloadMB:Math.round(bytes/1048576*10)/10,disconnects,failures,pingSamples:latencies.length,latencyMs:{median:percentile(.5),p95:percentile(.95),max:percentile(1)},rssPeakMB:Math.max(...samples.map(s=>s.rssMB)),eventLoopP95PeakMs:Math.max(...samples.map(s=>s.eventLoopP95Ms)),peakConnections:Math.max(...samples.map(s=>s.peakConnections)),samples};
 await emit(teacher,'teacher:action',{action:'end'});for(const s of sockets)await emit(s,'session:leave').catch(()=>{});await mkdir('test-results',{recursive:true});const path=`test-results/load-${report.environment}-${count}.json`;await writeFile(path,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,samples:report.samples.length,report:path},null,2));if(failures||disconnects)process.exitCode=1;
}finally{closing=true;clearInterval(movement);clearInterval(pings);clearInterval(metrics);clearInterval(status);for(const s of sockets)s.disconnect();await local?.close();}
