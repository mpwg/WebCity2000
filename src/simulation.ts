import {economy} from './economy';
export const catalog = {
 road:['Straße',5,'━'],bridge:['Brücke',40,'≋'],home:['Wohnzone',25,'⌂'],farm:['Hof',350,'♧'],well:['Brunnen',200,'◉'],water:['Wasserwerk',600,'≈'],wind:['Windrad',450,'✣'],power:['Brennstoffkraftwerk',900,'ϟ'],forest:['Forstbetrieb',400,'♠'],mine:['Mine',650,'◆'],materials:['Baustoffwerk',700,'▤'],workshop:['Werkstatt',550,'⚒'],market:['Markt',250,'▥'],storage:['Lager',300,'▣'],recycle:['Recycling',550,'♻'],school:['Schule',700,'⚑'],clinic:['Klinik',800,'✚'],fire:['Feuerwehr',750,'♨'],park:['Park',120,'❀']
} as const;
export type Kind=keyof typeof catalog;
export type Goods='wood'|'ore'|'fuel'|'materials'|'goods';
export type Stock=Record<Goods,number>;
export interface Building {id:number;x:number;y:number;kind:Kind;people:number;level:number;net:number;stock:Stock;ok:boolean;reason:string;pollution:number;services:number;waste:number;}
export interface Summary {people:number;jobs:number;employed:number;food:number;water:number;energy:number;income:number;upkeep:number;balance:number;supply:number;waste:number;recycled:number;pollution:number;streak:number;won:boolean;overflow:number;}
export interface Save {version:1;size:number;seed:number;sandbox:boolean;tick:number;money:number;nextId:number;buildings:Building[];summary:Summary;tutorial:number;}
export type Command={type:'build';kind:Kind;x:number;y:number}|{type:'demolish';x:number;y:number};
const empty=():Stock=>({wood:0,ore:0,fuel:0,materials:0,goods:0});
const summary=():Summary=>({people:0,jobs:0,employed:0,food:0,water:0,energy:0,income:0,upkeep:0,balance:0,supply:0,waste:0,recycled:0,pollution:0,streak:0,won:false,overflow:0});
export const isRoad=(k:Kind)=>k==='road'||k==='bridge';
export const services:Kind[]=['school','clinic','fire'];
const advanced:Kind[]=['water','power','mine','materials','workshop','recycle'];
export class Simulation {
 size:number;seed:number;sandbox:boolean;tick=0;money=20000;nextId=1;tutorial=0;summary=summary();
 chunks=new Map<number,Uint8Array>();terrain:Uint8Array;buildings=new Map<number,Building>();cells=new Map<number,Building>();dirty=true;events:string[]=[];
 constructor(size=256,seed=2000,sandbox=false){if(![128,256,512,1024,2048].includes(size))throw Error('Ungültige Kartengröße');this.size=size;this.seed=seed|0;this.sandbox=sandbox;this.terrain=new Uint8Array(size*size);for(let y=0;y<size;y++){const river=Math.floor(size*.62+Math.sin((y+seed%100)/23)*4);for(let x=river;x<river+4;x++)if(x>=0&&x<size)this.terrain[y*size+x]=1;}for(let cy=0;cy<size/64;cy++)for(let cx=0;cx<size/64;cx++){const data=new Uint8Array(4096);for(let row=0;row<64;row++)data.set(this.terrain.subarray((cy*64+row)*size+cx*64,(cy*64+row)*size+cx*64+64),row*64);this.chunks.set(cy*(size/64)+cx,data);}}
 neighbors(x:number,y:number){return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<this.size&&b<this.size).map(([a,b])=>b*this.size+a);}
 validate(kind:Kind,x:number,y:number){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.size||y>=this.size)return 'Außerhalb der Karte';if(this.cells.has(y*this.size+x))return 'Feld bereits belegt';if((kind==='bridge')!==!!this.terrain[y*this.size+x])return kind==='bridge'?'Brücken nur über Wasser':'Hier ist Wasser – baue eine Brücke';if(!this.sandbox&&services.includes(kind)&&this.summary.people<32)return 'Ab 32 Einwohnern verfügbar';if(!this.sandbox&&advanced.includes(kind)&&this.summary.people<64)return 'Ab 64 Einwohnern verfügbar';if(!this.sandbox&&this.money<catalog[kind][1])return 'Nicht genug Geld';return '';}
 command(c:Command){if(c.type==='demolish'){const b=this.cells.get(c.y*this.size+c.x);if(!b)return 'Hier steht kein Gebäude';this.cells.delete(c.y*this.size+c.x);this.buildings.delete(b.id);this.dirty=true;return '';}
 const error=this.validate(c.kind,c.x,c.y);if(error)return error;const b:Building={id:this.nextId++,x:c.x,y:c.y,kind:c.kind,people:0,level:1,net:-1,stock:empty(),ok:false,reason:'Warte auf Wirtschaftsrunde',pollution:0,services:0,waste:0};this.buildings.set(b.id,b);this.cells.set(b.y*this.size+b.x,b);if(!this.sandbox)this.money-=catalog[c.kind][1];this.dirty=true;if(c.kind==='road')this.tutorial=Math.max(1,this.tutorial);return '';}
 networks(){if(!this.dirty)return;this.dirty=false;for(const b of this.buildings.values())b.net=-1;for(const b of this.buildings.values()){if(!isRoad(b.kind)||b.net>=0)continue;b.net=b.id;const queue=[b];for(let i=0;i<queue.length;i++)for(const key of this.neighbors(queue[i].x,queue[i].y)){const n=this.cells.get(key);if(n&&isRoad(n.kind)&&n.net<0){n.net=b.id;queue.push(n);}}}for(const b of this.buildings.values())if(!isRoad(b.kind)){for(const key of this.neighbors(b.x,b.y)){const n=this.cells.get(key);if(n&&isRoad(n.kind)){b.net=n.net;break;}}}}
 step(count=1){for(let i=0;i<count;i++){this.tick++;if(this.tick%10===0)this.economy();}}
 economy(){economy(this);}
 snapshot():Save{return {version:1,size:this.size,seed:this.seed,sandbox:this.sandbox,tick:this.tick,money:this.money,nextId:this.nextId,buildings:structuredClone([...this.buildings.values()]),summary:{...this.summary},tutorial:this.tutorial};}
 static load(input:unknown){
const d=input as Save;if(!d||d.version!==1||!Array.isArray(d.buildings)||d.buildings.length>500000||!Number.isSafeInteger(d.tick)||d.tick<0||!Number.isSafeInteger(d.money)||!Number.isSafeInteger(d.seed)||typeof d.sandbox!=="boolean"||!Number.isInteger(d.tutorial)||d.tutorial<0||d.tutorial>5)throw Error("Ungültiger oder unbekannter Spielstand");
const sim=new Simulation(d.size,d.seed,d.sandbox),ids=new Set<number>();let largest=0;
for(const b of d.buildings){if(!b||!Object.hasOwn(catalog,b.kind)||!Number.isSafeInteger(b.id)||b.id<1||ids.has(b.id)||!Number.isInteger(b.people)||b.people<0||b.people>32||!Number.isInteger(b.level)||b.level<1||b.level>3||!Number.isInteger(b.x)||!Number.isInteger(b.y)||b.x<0||b.y<0||b.x>=d.size||b.y>=d.size||sim.cells.has(b.y*d.size+b.x)||!b.stock||Object.keys(empty()).some(k=>!Number.isSafeInteger(b.stock[k as Goods])||b.stock[k as Goods]<0||b.stock[k as Goods]>(b.kind==="storage"?288:32))||(b.kind==="bridge")!==!!sim.terrain[b.y*d.size+b.x]||typeof b.reason!=="string"||typeof b.ok!=="boolean"||!Number.isFinite(b.pollution)||!Number.isInteger(b.services)||!Number.isSafeInteger(b.waste)||b.waste<0)throw Error("Beschädigte Gebäudedaten");ids.add(b.id);largest=Math.max(largest,b.id);const copy=structuredClone(b);sim.buildings.set(b.id,copy);sim.cells.set(b.y*d.size+b.x,copy);}
if(!Number.isSafeInteger(d.nextId)||d.nextId<=largest)throw Error("Ungültige Gebäude-ID");if(!d.summary||Object.keys(summary()).some(k=>{const value=d.summary[k as keyof Summary];return typeof summary()[k as keyof Summary]==="boolean"?typeof value!=="boolean":!Number.isSafeInteger(value);}))throw Error("Ungültige Bilanz");sim.tick=d.tick;sim.money=d.money;sim.nextId=d.nextId;sim.summary={...d.summary};sim.tutorial=d.tutorial;return sim;
 }
}
