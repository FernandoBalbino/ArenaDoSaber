import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const source=new URL('../data/source/',import.meta.url),questions=[];
for(const file of readdirSync(source).filter(f=>f.endsWith('.txt')).sort()){
  const category=file.replace('.txt','');
  const lines=readFileSync(new URL(file,source),'utf8').trim().split(/\r?\n/);
  if(lines.length!==40)throw Error(`${category}: ${lines.length} perguntas; esperado 40`);
  lines.forEach((line,i)=>{const [text,correct,a,b,c,explanation,...extra]=line.split('|');if(!explanation||extra.length)throw Error(`${category}:${i+1} campos inválidos`);questions.push({id:`${category}-${String(i+1).padStart(2,'0')}`,category,difficult:i>=30,text,options:[correct,a,b,c],correctIndex:0,explanation});});
}
writeFileSync(new URL('../data/questions.json',import.meta.url),JSON.stringify(questions,null,2)+'\n');
console.log(`${questions.length} perguntas geradas.`);
