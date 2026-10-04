import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const response=await fetch('https://render.com/schema/render.yaml.json');
if(!response.ok)throw Error('Não foi possível obter o schema oficial do Render.');
const schema=await response.json(),ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);
const validate=ajv.compile(schema),config=parse(readFileSync(new URL('../render.yaml',import.meta.url),'utf8'));
if(!validate(config)){console.error(validate.errors);process.exitCode=1;}else console.log('render.yaml válido segundo o schema oficial do Render.');
