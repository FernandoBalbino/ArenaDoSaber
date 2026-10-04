import {randomInt} from 'node:crypto';
import {Room} from './engine.js';
import {CATEGORIES} from '../public/shared/rules.js';
export class Rooms {
  constructor(questions,{maxRooms=5,rng=Math.random}={}){this.rooms=new Map();this.questions=questions;this.maxRooms=maxRooms;this.rng=rng;}
  create(options,now){
    if(this.rooms.size>=this.maxRooms)throw Error('Todas as salas estão ocupadas. Tente mais tarde.');
    const capacity=options.capacity??24,categories=options.categories??Object.keys(CATEGORIES);
    if(!Number.isInteger(capacity)||capacity<2||capacity>30)throw Error('A capacidade deve ser de 2 a 30 alunos.');
    if(!Array.isArray(categories)||!categories.length||categories.length>12||categories.some(c=>!Object.hasOwn(CATEGORIES,c))||new Set(categories).size!==categories.length)throw Error('Selecione categorias válidas.');
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;
    do{code=Array.from({length:5},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.rooms.has(code));
    const room=new Room(code,this.questions,{capacity,categories,rng:this.rng,now});this.rooms.set(code,room);return room;
  }
  get(code){if(typeof code!=='string'||!/^[A-Z2-9]{5}$/.test(code))throw Error('Informe o código de cinco caracteres.');const room=this.rooms.get(code);if(!room)throw Error('Sala não encontrada. Ela pode ter sido encerrada ou o servidor reiniciado.');return room;}
  cleanup(now){for(const [code,room] of this.rooms)if(room.emptySince!==null&&now-room.emptySince>=900000)this.rooms.delete(code);}
}
