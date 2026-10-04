import {SPEED,direction,clampCircle} from '../shared/rules.js';
const skins=[0xf4d7b1,0xe2b387,0xbf855e,0x95603f,0x724530,0x4b3028],hairs=[0x33282d,0x6a402b,0xd2a853,0x24383f,0xaa5448];
const colors=[0x6fe0d4,0xf2c56f,0x9d99ef,0xec9cac];
export function createArena(parent,bridge,preview=false){
  class Arena extends Phaser.Scene {
    constructor(){super('arena');this.actors=new Map();this.particles=[];this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;}
    create(){
      this.clouds=this.add.graphics();this.stars=this.add.graphics();
      this.world=this.add.container(0,0);this.floor=this.add.graphics();this.world.add(this.floor);this.drawFloor();
      this.decoration=this.add.graphics();this.world.add(this.decoration);
      this.objectsLayer=this.add.graphics();this.world.add(this.objectsLayer);
      this.effectLayer=this.add.graphics();this.world.add(this.effectLayer);
      this.fog=this.add.graphics();this.fog.setDepth(800);
      this.scale.on('resize',()=>this.layout());this.layout();bridge.scene=this;
    }
    layout(){const w=this.scale.width,h=this.scale.height;this.factor=Math.min(w/(preview?1020:1170),h/(preview?1070:1050));this.world.setPosition(w/2,h/2+5).setScale(this.factor);this.clouds.clear();this.stars.clear();
      for(let i=0;i<24;i++){const x=((i*379+97)%997)/997*w,y=((i*181+43)%997)/997*h;this.stars.fillStyle(0x95dad5,.1+(i%3)*.07);this.stars.fillCircle(x,y,i%3===0?1.7:1);}
      for(let i=0;i<9;i++){const x=((i*349+123)%997)/997*w,y=((i*163+231)%997)/997*h;this.clouds.fillStyle(0x52838a,.025);for(let j=0;j<5;j++)this.clouds.fillEllipse(x+j*20,y+j*6,180-j*12,55);}
    }
    drawFloor(){const g=this.floor;
      g.fillStyle(0x030e16,.42);g.fillEllipse(0,95,990,850);
      for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;const r=450;g.fillStyle(i%2?0x243d47:0x1a303d);g.fillPoints([{x:Math.cos(a)*r,y:Math.sin(a)*r},{x:Math.cos(b)*r,y:Math.sin(b)*r},{x:Math.cos(b)*r*.88,y:Math.sin(b)*r*.88+105},{x:Math.cos(a)*r*.88,y:Math.sin(a)*r*.88+105}],true);}
      g.fillStyle(0x42616a);g.fillCircle(0,0,452);g.lineStyle(8,0x779094,.55);g.strokeCircle(0,0,444);g.fillStyle(0x25464d);g.fillCircle(0,0,424);
      for(let z=0;z<4;z++){const start=-Math.PI*.75+z*Math.PI*.5;g.fillStyle(colors[z],.13);g.slice(0,0,414,start,start+Math.PI/2,false);g.fillPath();}
      for(let ring=0;ring<5;ring++){const r1=80+ring*66,r2=r1+62,count=12+ring*4;for(let i=0;i<count;i++){const a=i/count*Math.PI*2+.035+(ring%2)*.1,b=(i+1)/count*Math.PI*2-.035+(ring%2)*.1;const pts=[];for(let j=0;j<=4;j++){const t=a+(b-a)*j/4;pts.push({x:Math.cos(t)*r2,y:Math.sin(t)*r2});}for(let j=4;j>=0;j--){const t=a+(b-a)*j/4;pts.push({x:Math.cos(t)*r1,y:Math.sin(t)*r1});}g.fillStyle([0x37595e,0x3d6266,0x46696a,0x315358][(i+ring)%4],.7);g.fillPoints(pts,true);g.lineStyle(1,0x90b3ab,.12);g.strokePoints(pts,true);}}
      for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;g.lineStyle(22,0x142f3b,.95);g.lineBetween(Math.cos(a)*62,Math.sin(a)*62,Math.cos(a)*425,Math.sin(a)*425);g.lineStyle(3,0x9cebdd,.65);g.lineBetween(Math.cos(a)*68,Math.sin(a)*68,Math.cos(a)*419,Math.sin(a)*419);}
      g.fillStyle(0x193842);g.fillCircle(0,0,68);g.lineStyle(3,0xc4b685,.65);g.strokeCircle(0,0,65);g.lineStyle(2,0x78c9be,.45);g.strokeCircle(0,0,51);g.lineBetween(-20,18,0,-24);g.lineBetween(0,-24,20,18);g.lineBetween(-12,8,12,8);
      for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,x=Math.cos(a)*437,y=Math.sin(a)*437;g.fillStyle(0x203744);g.fillEllipse(x,y+5,64,37);g.fillStyle(0x71888a);g.fillTriangle(x-25,y,x,y-44,x+25,y);g.fillStyle(0x44606a);g.fillTriangle(x+25,y,x,y-44,x+8,y+11);g.fillStyle(0x87eade);g.fillTriangle(x-10,y-23,x,y-54,x+9,y-23);g.lineStyle(2,0xccfff1,.8);g.lineBetween(x,y-51,x+1,y-25);}
      for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=432;g.lineStyle(2,0xa3bcad,.26);const x=Math.cos(a)*r,y=Math.sin(a)*r;g.strokeCircle(x,y,4);}
    }
    makeActor(p){const container=this.add.container(0,0),body=this.add.graphics(),label=this.add.text(0,-49,p.name,{fontFamily:'Segoe UI, sans-serif',fontSize:'23px',fontStyle:'bold',color:'#e7f5f3',stroke:'#0a202b',strokeThickness:5,align:'center'}).setOrigin(.5,1);container.add([body,label]);this.world.add(container);container.setSize(70,105).setInteractive({useHandCursor:!preview});container.on('pointerdown',()=>bridge.onTarget?.(p.id));const actor={container,body,label,x:p.x,y:p.y,lastX:p.x,lastY:p.y,teleport:p.teleport,direction:'down'};this.actors.set(p.id,actor);return actor;}
    drawActor(actor,p,t,moving,local){const g=actor.body;g.clear();const selected=bridge.selected===p.id,eligible=bridge.targeting&&bridge.eligible?.includes(p.id),alive=p.alive&&!p.waiting;const bob=this.reduced?0:Math.sin(t/(moving?85:500)+(p.appearance.skin||0))*(moving?2:1);const walk=moving&&!this.reduced?Math.sin(t/90)*4:0;
      g.fillStyle(0x051621,.4);g.fillEllipse(0,9,39,15);
      if(local||eligible||selected){g.lineStyle(selected?5:3,selected?0xfbd57f:local?0x8bffdf:0x91d5ed,.95);g.strokeEllipse(0,8,52,25);if(selected){g.fillStyle(0xfbd57f);g.fillTriangle(-6,-75,6,-75,0,-65);}}
      if(p.effects?.includes('magnet')){g.lineStyle(2,0x94e4d4,.35);g.strokeCircle(0,0,160);}
      g.fillStyle(0x182e3c);g.fillRoundedRect(-14,-3+walk,11,15,3);g.fillRoundedRect(3,-3-walk,11,15,3);
      const shirt=Phaser.Display.Color.HexStringToColor(p.appearance.shirt).color;g.fillStyle(shirt);g.fillRoundedRect(-16,-30+bob,32,31,7);g.fillStyle(0xffffff,.14);g.fillRoundedRect(-12,-27+bob,9,21,3);g.fillStyle(0x000000,.13);g.fillRect(-16,-6+bob,32,5);
      const skin=skins[p.appearance.skin],hair=hairs[p.appearance.hair];g.fillStyle(skin);g.fillCircle(-19,-16+bob-walk,6);g.fillCircle(19,-16+bob+walk,6);
      const hs=p.effects?.includes('head')?1.65:1,hx=0,hy=-42+bob;g.fillStyle(skin);g.fillRoundedRect(-14*hs,hy-13*hs,28*hs,28*hs,10*hs);g.fillStyle(hair);g.fillRoundedRect(-15*hs,hy-16*hs,30*hs,11*hs,5*hs);
      if(actor.direction==='up')g.fillRoundedRect(-14*hs,hy-10*hs,28*hs,21*hs,7*hs);else{g.fillStyle(0x203442);const dx=actor.direction==='left'?-4:actor.direction==='right'?4:0;g.fillCircle((-5+dx)*hs,hy+1*hs,1.7*hs);g.fillCircle((5+dx)*hs,hy+1*hs,1.7*hs);g.lineStyle(1.4,0x81543f);g.lineBetween(-3+dx,hy+7,3+dx,hy+7);}
      if(p.appearance.accessory===1){g.fillStyle(shirt);g.fillRoundedRect(-17*hs,hy-20*hs,34*hs,9*hs,4);g.fillStyle(0xf1cd79);g.fillCircle(0,hy-16*hs,3);}
      if(p.appearance.accessory===2&&actor.direction!=='up'){g.lineStyle(2,0x233542);g.strokeCircle(-6*hs,hy,5*hs);g.strokeCircle(6*hs,hy,5*hs);g.lineBetween(-1,hy,1,hy);}
      if(p.appearance.accessory===3){g.fillStyle(0xefc16b);g.fillRect(-15,-28+bob,30,5);g.fillTriangle(6,-23+bob,16,-23+bob,14,-12+bob);}
      if(p.effects?.includes('ice')){g.fillStyle(0x9cddff,.32);g.fillRoundedRect(-23,-56,46,67,8);g.lineStyle(2,0xc0f3ff,.8);g.strokeRoundedRect(-23,-56,46,67,8);}
      if(p.effects?.includes('invert')||p.effects?.includes('confuse')){g.lineStyle(3,0xd3a0ff,.8);g.strokeEllipse(0,-66,36,11);}
      actor.label.setText(p.name+(local?' · VOCÊ':''));actor.label.setY(p.effects?.includes('head')?-73:-63);actor.label.setFontSize(Math.max(20,12/this.factor));actor.container.setAlpha(alive?1:.3);
    }
    update(time,delta){if(!this.world)return;const state=bridge.state;const demo=[{id:'demo1',name:'Lia',x:-150,y:-130,appearance:{shirt:'#eaa956',skin:2,hair:1,accessory:1}},{id:'demo2',name:'Davi',x:170,y:10,appearance:{shirt:'#8be1d4',skin:4,hair:0,accessory:2}},{id:'demo3',name:'Bia',x:-120,y:175,appearance:{shirt:'#bf9fea',skin:0,hair:2,accessory:3}},{id:'demo4',name:'Caio',x:80,y:-215,appearance:{shirt:'#f087a0',skin:3,hair:3,accessory:0}}].map(p=>({...p,alive:true,effects:[],teleport:0}));const players=preview?demo:(state?.players||[]);const ids=new Set(players.map(p=>p.id));for(const [id,a]of this.actors)if(!ids.has(id)){a.container.destroy();this.actors.delete(id);}
      for(const p of players){const a=this.actors.get(p.id)||this.makeActor(p);const local=p.id===bridge.id;const teleported=a.teleport!==p.teleport;if(teleported){a.x=p.x;a.y=p.y;a.teleport=p.teleport;}
        if(local&&state?.phase==='ROUND_ACTIVE'&&!state.paused&&p.alive&&!p.waiting&&bridge.connected){const d=direction(bridge.input||{}),f=p.effects.includes('invert')?-1:1;if(!p.effects.includes('ice')&&!p.effects.includes('slip')){a.x+=d.x*SPEED*Math.min(delta,50)/1000*f;a.y+=d.y*SPEED*Math.min(delta,50)/1000*f;clampCircle(a);}const error=Math.hypot(a.x-p.x,a.y-p.y);const blend=error>95?.6:.07;a.x+=(p.x-a.x)*blend;a.y+=(p.y-a.y)*blend;
        }else{const blend=preview?1:Math.min(1,delta/85);a.x+=(p.x-a.x)*blend;a.y+=(p.y-a.y)*blend;}
        const dx=a.x-a.lastX,dy=a.y-a.lastY,moving=Math.hypot(dx,dy)>.1;if(moving)a.direction=Math.abs(dx)>Math.abs(dy)?dx<0?'left':'right':dy<0?'up':'down';a.lastX=a.x;a.lastY=a.y;a.container.setPosition(a.x,a.y).setDepth(a.y+500);this.drawActor(a,p,time,moving,local);
      }
      this.world.sort('depth');this.floor.setDepth(-1000);this.decoration.setDepth(-900);this.objectsLayer.setDepth(-500);this.effectLayer.setDepth(2000);
      const g=this.decoration;g.clear();for(let i=0;i<16;i++){const a=i*2.4,r=430+Math.sin(i*7)*24,x=Math.cos(a)*r,y=Math.sin(a)*r;g.fillStyle(i%2?0xc0ede1:0xb4c2fa,.2+(this.reduced?.15:Math.sin(time/900+i)*.1));g.fillCircle(x,y-(this.reduced?0:(time/35+i*20)%40),2.4);}
      this.objectsLayer.clear();for(const o of state?.objects||[]){if(o.kind==='banana'){this.objectsLayer.lineStyle(8,0xf4cc60);this.objectsLayer.beginPath();this.objectsLayer.arc(o.x,o.y,12,0,Math.PI);this.objectsLayer.strokePath();}else{this.objectsLayer.fillStyle(0x8a94ad,.35);this.objectsLayer.fillCircle(o.x,o.y,160);}}
      const self=players.find(p=>p.id===bridge.id);const inSmoke=self&&(state?.objects||[]).some(o=>o.kind==='smoke'&&o.owner!==self.id&&Math.hypot(o.x-self.x,o.y-self.y)<=160);this.fog.clear();if(inSmoke){this.fog.fillStyle(0x8994a6,.7);for(let i=0;i<8;i++)this.fog.fillEllipse(this.scale.width*.35+i%3*60,this.scale.height*.3+Math.floor(i/3)*60,280,160);}
      this.effectLayer.clear();const power=state?.lastPower;if(power&&state.time-power.time<500){const age=(state.time-power.time)/500;this.effectLayer.lineStyle(7*(1-age),power.kind==='blast'?0xd5ef91:0x92deeb,1-age);this.effectLayer.strokeCircle(power.x,power.y,30+age*135);}
    }
  }
  const holder=document.getElementById(parent);return new Phaser.Game({type:Phaser.AUTO,parent,width:holder.clientWidth||600,height:holder.clientHeight||500,transparent:true,antialias:true,roundPixels:false,render:{powerPreference:'low-power'},fps:{target:60,limit:60},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Arena,audio:{noAudio:true},banner:false});
}
