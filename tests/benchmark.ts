import {Simulation,type Kind} from '../src/simulation';
const sim=new Simulation(2048,2000,true);const types:Kind[]=['farm','well','wind','market','home','forest','storage','home','home','home'];
const start=performance.now();for(let y=10;y<110;y++)for(let x=10;x<1010;x++){const kind=y%3===1?'road':types[x%types.length];const error=sim.command({type:'build',kind,x,y});if(error)throw Error(error);}
const generated=performance.now()-start;
function measure(label:string){const rounds:number[]=[];for(let i=0;i<5;i++){const begin=performance.now();sim.step(10);rounds.push(performance.now()-begin);}rounds.sort((a,b)=>a-b);console.log(JSON.stringify({scenario:label,size:sim.size,buildings:sim.buildings.size,rounds:5,roundMeanMs:rounds.reduce((a,b)=>a+b,0)/rounds.length,roundP95Ms:rounds[rounds.length-1],people:sim.summary.people,generatedMs:generated}));}
measure('getrennte Teilnetze');for(let y=10;y<110;y++)sim.command({type:'build',kind:'road',x:1010,y});measure('verbundene Teilnetze');
