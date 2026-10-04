import {POWER, clampCircle, direction} from '../public/shared/rules.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function push(a,b,amount) { const d=distance(a,b)||1; let x=(b.x-a.x)/d,y=(b.y-a.y)/d; if(x===0&&y===0)y=-1; b.x+=x*amount;b.y+=y*amount;clampCircle(b);b.teleport++; }
export function usePower(room,actor,targetId) {
  if(room.paused || room.phase!=='ROUND_ACTIVE' || room.remaining<=2000 || !actor.alive || actor.waiting || actor.used || !actor.power || room.sudden) throw Error('Poder indisponível neste momento.');
  const power=POWER[actor.power]; let target;
  if(power.target){
    target=room.players.get(targetId);
    if(!target||!target.alive||target.waiting||target.id===actor.id)throw Error('Escolha outro jogador vivo desta sala.');
    if(power.id!=='swap'&&distance(actor,target)>220)throw Error('Este jogador está fora do alcance. Aproxime-se.');
  }
  const effect=(p,type,duration)=>{p.effects[type]=room.time+duration;};
  const affected=new Set();
  if(target)affected.add(target.id);
  switch(power.id){
    case 'banana': room.objects.push({id:room.nextObject++,kind:'banana',owner:actor.id,x:actor.x,y:actor.y,until:Infinity});break;
    case 'invert':effect(target,'invert',4000);break;
    case 'push':push(actor,target,120);break;
    case 'swap':{const x=actor.x,y=actor.y;actor.x=target.x;actor.y=target.y;target.x=x;target.y=y;actor.teleport++;target.teleport++;break;}
    case 'ice':effect(target,'ice',2000);break;
    case 'head':effect(target,'head',4000);break;
    case 'confuse':effect(target,'confuse',4000);break;
    case 'smoke':room.objects.push({id:room.nextObject++,kind:'smoke',owner:actor.id,x:actor.x,y:actor.y,until:room.time+4000});break;
    case 'magnet':effect(actor,'magnet',3000);break;
    case 'blast':for(const p of room.players.values())if(p.alive&&!p.waiting&&p.id!==actor.id&&distance(actor,p)<=160){push(actor,p,120);affected.add(p.id);}break;
  }
  actor.used=true;actor.stats.powers++;for(const id of affected)markAffected(actor,id);
  room.lastPower={id:room.nextObject++,kind:power.id,actor:actor.id,target:target?.id||null,x:actor.x,y:actor.y,time:room.time};
}
function markAffected(actor,id){ if(!actor.affected.has(id)){actor.affected.add(id);actor.stats.affected++;} }
export function updateEffects(room,dt){
  for(const p of room.players.values())for(const [k,until] of Object.entries(p.effects))if(until<=room.time)delete p.effects[k];
  room.objects=room.objects.filter(o=>o.until>room.time);
  for(const o of room.objects){
    for(const p of room.players.values()){
      if(!p.alive||p.waiting||p.id===o.owner)continue;
      if(o.kind==='banana'&&distance(p,o)<29){p.effects.slip=room.time+1500;const d=direction(p.input);p.slipVector=d.x||d.y?d:{x:1,y:0};o.until=0;const a=room.players.get(o.owner);if(a)markAffected(a,p.id);break;}
      if(o.kind==='smoke'&&distance(p,o)<=160){const a=room.players.get(o.owner);if(a)markAffected(a,p.id);}
    }
  }
  for(const a of room.players.values())if(a.alive&&a.effects.magnet>room.time)for(const p of room.players.values())if(p.alive&&!p.waiting&&p.id!==a.id&&distance(a,p)<=160){const d=distance(a,p)||1;p.x+=(a.x-p.x)/d*70*dt/1000;p.y+=(a.y-p.y)/d*70*dt/1000;clampCircle(p);markAffected(a,p.id);}
}
