import {createApp} from './app.js';
const game=createApp();
const port=Number(process.env.PORT)||3000;
game.http.listen(port,'0.0.0.0',()=>console.log(`Arena do Saber disponível na porta ${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await game.close();process.exit(0);});
