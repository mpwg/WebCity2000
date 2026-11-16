export const catalog = {
 road:['Straße',5,'━'],bridge:['Brücke',40,'≋'],home:['Wohnzone',25,'⌂'],farm:['Hof',350,'♧'],well:['Brunnen',200,'◉'],water:['Wasserwerk',600,'≈'],wind:['Windrad',450,'✣'],power:['Brennstoffkraftwerk',900,'ϟ'],forest:['Forstbetrieb',400,'♠'],mine:['Mine',650,'◆'],materials:['Baustoffwerk',700,'▤'],workshop:['Werkstatt',550,'⚒'],market:['Markt',250,'▥'],storage:['Lager',300,'▣'],recycle:['Recycling',550,'♻'],school:['Schule',700,'⚑'],clinic:['Klinik',800,'✚'],fire:['Feuerwehr',750,'♨'],park:['Park',120,'❀']
} as const;
export type Kind=keyof typeof catalog;
export type Goods='wood'|'ore'|'fuel'|'materials'|'goods';
export type Stock=Record<Goods,number>;
export interface Building {id:number;x:number;y:number;kind:Kind;people:number;level:number;net:number;stock:Stock;ok:boolean;reason:string;pollution:number;services:number;}
export interface Summary {people:number;jobs:number;employed:number;food:number;water:number;energy:number;income:number;upkeep:number;balance:number;supply:number;waste:number;recycled:number;pollution:number;streak:number;won:boolean;overflow:number;}
export interface Save {version:1;size:number;seed:number;sandbox:boolean;tick:number;money:number;nextId:number;buildings:Building[];summary:Summary;tutorial:number;}
export type Command={type:'build';kind:Kind;x:number;y:number}|{type:'demolish';x:number;y:number};
const empty=():Stock=>({wood:0,ore:0,fuel:0,materials:0,goods:0});
const summary=():Summary=>({people:0,jobs:0,employed:0,food:0,water:0,energy:0,income:0,upkeep:0,balance:0,supply:0,waste:0,recycled:0,pollution:0,streak:0,won:false,overflow:0});
export const isRoad=(k:Kind)=>k==='road'||k==='bridge';
export const services:Kind[]=['school','clinic','fire'];
const advanced:Kind[]=['water','power','mine','materials','workshop','recycle'];

type FlowEdge={to:number;reverse:number;capacity:number};
type RoadLink={a:number;b:number;remaining:number};
/** Aggregated integral flow. Shared road budgets persist across resources in one round. */
class RoundTransport {
 private nodes=new Map<number,number>();
 private links:RoadLink[]=[];
 private attachments:{id:number;building:number;road:number}[]=[];
 constructor(all:Building[],cells:Map<number,Building>,neighbors:(x:number,y:number)=>number[]){
  for(const b of all)this.nodes.set(b.id,this.nodes.size);
  for(const b of all){
   if(isRoad(b.kind)){for(const key of neighbors(b.x,b.y)){const n=cells.get(key);if(n&&isRoad(n.kind)&&n.id>b.id)this.links.push({a:this.nodes.get(b.id)!,b:this.nodes.get(n.id)!,remaining:32});}}
   else if(b.net>=0){for(const key of neighbors(b.x,b.y)){const n=cells.get(key);if(n&&isRoad(n.kind)&&n.net===b.net){this.attachments.push({id:b.id,building:this.nodes.get(b.id)!,road:this.nodes.get(n.id)!});break;}}}
  }
 }
 move(supply:Map<number,number>,demand:Map<number,number>,shares=1):Map<number,number>{
  const delivered=new Map<number,number>();if(![...supply.values()].some(n=>n>0)||![...demand.values()].some(n=>n>0))return delivered;
  const count=this.nodes.size,source=count,sink=count+1,graph:FlowEdge[][]=Array.from({length:count+2},()=>[]);
  const add=(a:number,b:number,capacity:number,reverse=0)=>{const edge={to:b,reverse:graph[b].length,capacity};graph[a].push(edge);graph[b].push({to:a,reverse:graph[a].length-1,capacity:reverse});return edge;};
  const allocated=this.links.map(link=>Math.floor(link.remaining/shares));const roads=this.links.map((link,i)=>add(link.a,link.b,allocated[i],allocated[i]));
  for(const {id,building,road} of this.attachments){
   // Buildings are endpoints, never shortcuts between road cells.
   if((supply.get(id)||0)>0)add(building,road,1000000000);if((demand.get(id)||0)>0)add(road,building,1000000000);
  }
  const inputs=new Map<number,FlowEdge>(),outputs=new Map<number,FlowEdge>();
  for(const [id,n] of supply)if(n>0)inputs.set(id,add(source,this.nodes.get(id)!,n));
  for(const [id,n] of demand)if(n>0)outputs.set(id,add(this.nodes.get(id)!,sink,n));
  const level=new Int32Array(count+2),cursor=new Int32Array(count+2);
  while(true){
   level.fill(-1);level[source]=0;const queue=[source];
   for(let q=0;q<queue.length;q++){const a=queue[q];for(const edge of graph[a])if(edge.capacity>0&&level[edge.to]<0){level[edge.to]=level[a]+1;queue.push(edge.to);}}
   if(level[sink]<0)break;cursor.fill(0);
   // Iterative blocking-flow search also supports roads longer than the JS call stack.
   while(true){const path:number[]=[source],edges:FlowEdge[]=[];
    while(path.length&&path[path.length-1]!==sink){
     const a=path[path.length-1];while(cursor[a]<graph[a].length){const edge=graph[a][cursor[a]];if(edge.capacity>0&&level[edge.to]===level[a]+1)break;cursor[a]++;}
     if(cursor[a]===graph[a].length){level[a]=-1;path.pop();if(edges.length){edges.pop();if(path.length)cursor[path[path.length-1]]++;}}
     else{const edge=graph[a][cursor[a]];edges.push(edge);path.push(edge.to);}
    }
    if(!path.length)break;let amount=Infinity;for(const edge of edges)amount=Math.min(amount,edge.capacity);
    for(let i=0;i<edges.length;i++){const edge=edges[i];edge.capacity-=amount;graph[edge.to][edge.reverse].capacity+=amount;}
   }
  }
  for(let i=0;i<this.links.length;i++)this.links[i].remaining-=Math.abs(allocated[i]-roads[i].capacity);
  for(const [id,edge] of inputs)supply.set(id,edge.capacity);
  for(const [id,edge] of outputs)delivered.set(id,demand.get(id)!-edge.capacity);
  return delivered;
 }
}
export class Simulation {
 size:number;seed:number;sandbox:boolean;tick=0;money=20000;nextId=1;tutorial=0;summary=summary();
 terrain:Uint8Array;buildings=new Map<number,Building>();cells=new Map<number,Building>();dirty=true;events:string[]=[];
 constructor(size=256,seed=2000,sandbox=false){if(![128,256,512,1024,2048].includes(size))throw Error('Ungültige Kartengröße');this.size=size;this.seed=seed|0;this.sandbox=sandbox;this.terrain=new Uint8Array(size*size);for(let y=0;y<size;y++){const river=Math.floor(size*.62+Math.sin((y+seed%100)/23)*4);for(let x=river;x<river+4;x++)if(x>=0&&x<size)this.terrain[y*size+x]=1;}}
 neighbors(x:number,y:number){return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<this.size&&b<this.size).map(([a,b])=>b*this.size+a);}
 validate(kind:Kind,x:number,y:number){if(typeof kind!=='string'||!Object.hasOwn(catalog,kind))return 'Unbekannter Gebäudetyp';if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.size||y>=this.size)return 'Außerhalb der Karte';if(this.cells.has(y*this.size+x))return 'Feld bereits belegt';if(this.nextId>=Number.MAX_SAFE_INTEGER||this.buildings.size>=500000)return 'Gebäudelimit erreicht';if((kind==='bridge')!==!!this.terrain[y*this.size+x])return kind==='bridge'?'Brücken nur über Wasser':'Hier ist Wasser – baue eine Brücke';if(!this.sandbox&&services.includes(kind)&&this.summary.people<32)return 'Ab 32 Einwohnern verfügbar';if(!this.sandbox&&advanced.includes(kind)&&this.summary.people<64)return 'Ab 64 Einwohnern verfügbar';if(!this.sandbox&&this.money<catalog[kind][1])return 'Nicht genug Geld';return '';}
 command(c:Command){if(!c||!['build','demolish'].includes(c.type))return 'Ungültiger Befehl';if(!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.y<0||c.x>=this.size||c.y>=this.size)return 'Außerhalb der Karte';if(c.type==='demolish'){const b=this.cells.get(c.y*this.size+c.x);if(!b)return 'Hier steht kein Gebäude';this.cells.delete(c.y*this.size+c.x);this.buildings.delete(b.id);this.dirty=true;return '';}
 const error=this.validate(c.kind,c.x,c.y);if(error)return error;const b:Building={id:this.nextId++,x:c.x,y:c.y,kind:c.kind,people:0,level:1,net:-1,stock:empty(),ok:false,reason:'Warte auf Wirtschaftsrunde',pollution:0,services:0};this.buildings.set(b.id,b);this.cells.set(b.y*this.size+b.x,b);if(!this.sandbox)this.money-=catalog[c.kind][1];this.dirty=true;if(c.kind==='road')this.tutorial=Math.max(1,this.tutorial);return '';}
 networks(){if(!this.dirty)return;this.dirty=false;for(const b of this.buildings.values())b.net=-1;for(const b of this.buildings.values()){if(!isRoad(b.kind)||b.net>=0)continue;b.net=b.id;const queue=[b];for(let i=0;i<queue.length;i++)for(const key of this.neighbors(queue[i].x,queue[i].y)){const n=this.cells.get(key);if(n&&isRoad(n.kind)&&n.net<0){n.net=b.id;queue.push(n);}}}for(const b of this.buildings.values())if(!isRoad(b.kind)){for(const key of this.neighbors(b.x,b.y)){const n=this.cells.get(key);if(n&&isRoad(n.kind)){b.net=n.net;break;}}// Kartenrand erlaubt Anschluss an ein eigenes Randnetz.
 if(b.net<0&&(b.x===0||b.y===0||b.x===this.size-1||b.y===this.size-1))b.net=b.id;}}
 step(count=1){if(!Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(this.tick+count))throw Error('Ungültige Tickzahl');for(let i=0;i<count;i++){this.tick++;if(this.tick%10===0)this.economy();}}

 economy(){
  this.networks();this.events=[];const old=this.summary,s=summary();s.won=old.won;
  const all=[...this.buildings.values()].sort((a,b)=>a.id-b.id),connected=all.filter(b=>b.net>=0);
  const transport=new RoundTransport(all,this.cells,(x,y)=>this.neighbors(x,y));
  const sources=connected.filter(b=>!isRoad(b.kind)&&b.kind!=='home'),homes=all.filter(b=>b.kind==='home');
  const goods:Goods[]=['wood','ore','fuel','materials','goods'];
  const spatial=new Map<string,Building[]>(),groups=new Map<number,{people:number;jobs:number;recycling:number;market:boolean}>();
  for(const b of all){b.ok=false;b.reason='Kein Straßenanschluss';b.pollution=0;b.services=0;if(isRoad(b.kind))s.upkeep++;
   if(b.kind==='mine'||b.kind==='power'||b.kind==='park'||services.includes(b.kind)){const key=Math.floor(b.x/16)+':'+Math.floor(b.y/16),list=spatial.get(key)||[];list.push(b);spatial.set(key,list);}
  }
  for(const b of [...connected,...homes])if(!groups.has(b.net))groups.set(b.net,{people:0,jobs:0,recycling:0,market:false});
  for(const b of all){let relief=0;const types=new Set<Kind>();
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const p of spatial.get((Math.floor(b.x/16)+dx)+':'+(Math.floor(b.y/16)+dy))||[]){
    const distance=Math.abs(b.x-p.x)+Math.abs(b.y-p.y);if((p.kind==='mine'||p.kind==='power')&&distance<=8)b.pollution+=25;if(p.kind==='park'&&distance<=5)relief+=15;
    if(p.net>=0&&services.includes(p.kind)&&Math.hypot(p.x-b.x,p.y-b.y)<=12)types.add(p.kind);
   }b.pollution=Math.max(0,b.pollution-relief);b.services=types.size;
  }
  const food=new Map<number,number>(),water=new Map<number,number>(),energy=new Map<number,number>();
  for(const b of sources){b.ok=true;b.reason='In Betrieb';s.upkeep+=2;const group=groups.get(b.net)!;group.jobs+=b.kind==='workshop'?12:4;if(b.kind==='market')group.market=true;if(b.kind==='recycle')group.recycling+=64;
   switch(b.kind){case 'farm':food.set(b.id,24);break;case 'well':water.set(b.id,24);break;case 'water':water.set(b.id,100);break;case 'wind':energy.set(b.id,32);break;case 'forest':b.stock.wood+=8;break;case 'mine':b.stock.ore+=8;b.stock.fuel+=4;break;}
  }
  // Deliver inputs into visible local inventories. Partial recipes remain stored, never discarded.
  const transfer=(kind:Goods,targets:Building[],quantity:number)=>{
   const targetIds=new Set(targets.map(b=>b.id)),supply=new Map<number,number>(),demand=new Map<number,number>();
   for(const b of connected){const reserve=targetIds.has(b.id)?quantity:0;supply.set(b.id,Math.max(0,b.stock[kind]-reserve));}
   for(const b of targets)demand.set(b.id,Math.max(0,quantity-b.stock[kind]));
   const received=transport.move(supply,demand);
   for(const b of connected){const reserve=targetIds.has(b.id)?Math.min(quantity,b.stock[kind]):0;b.stock[kind]=reserve+(supply.get(b.id)||0)+(received.get(b.id)||0);}
  };
  const power=sources.filter(b=>b.kind==='power');transfer('fuel',power,1);
  for(const b of power)if(b.stock.fuel>=1){b.stock.fuel--;energy.set(b.id,160);}else{b.ok=false;b.reason='Brennstoff fehlt – Mine oder Transport prüfen';}
  // Stable stages: sources, power, materials, workshop, homes. One recipe per plant/round.
  for(const kind of ['materials','workshop'] as const){
   const plants=sources.filter(b=>b.kind===kind);
   if(kind==='materials'){transfer('wood',plants,2);transfer('ore',plants,2);}else transfer('materials',plants,1);
   const ready=plants.filter(b=>kind==='materials'?b.stock.wood>=2&&b.stock.ore>=2:b.stock.materials>=1);
   const powered=transport.move(energy,new Map(ready.map(b=>[b.id,1])));
   const readyIds=new Set(ready.map(b=>b.id));for(const b of plants){if(!readyIds.has(b.id)){b.ok=false;b.reason='Rohstoffe fehlen – Quellen oder Transport prüfen';continue;}if(!powered.get(b.id)){b.ok=false;b.reason='Energie fehlt – Windrad oder Transport prüfen';continue;}
    if(kind==='materials'){b.stock.wood-=2;b.stock.ore-=2;b.stock.materials+=4;}else{b.stock.materials--;b.stock.goods+=4;}
   }
  }
  transfer('goods',homes,2);
  const priorPeople=new Map<number,number>();for(const b of homes)priorPeople.set(b.net,(priorPeople.get(b.net)||0)+b.people);
  const freeJobs=new Map([...groups].map(([id,g])=>[id,g.jobs])),demand=new Map<number,number>();
  for(const b of homes){let target=b.people;const group=groups.get(b.net)!;const growthPollution=b.pollution+Math.min(50,Math.max(0,Math.ceil((priorPeople.get(b.net)||0)/8)-group.recycling)*2);
   if(group.market&&target<32&&(freeJobs.get(b.net)||0)>=target+1&&(target<8||(b.stock.goods>=1&&b.services>=1))&&(target<16||(b.services>=2&&growthPollution<=20)))target++;
   demand.set(b.id,target);freeJobs.set(b.net,Math.max(0,(freeJobs.get(b.net)||0)-target));
  }
  // Reserve a fair road share for each basic supply, so food cannot exhaust every bottleneck before water and energy.
  const f=transport.move(food,demand,3),w=transport.move(water,demand,2),e=transport.move(energy,demand);
  // Unused delivered perishables remain explicit round surplus, not hidden consumption.
  let surplusFood=0,surplusWater=0,surplusEnergy=0;
  for(const b of homes){const group=groups.get(b.net)!,target=demand.get(b.id)!,delivered=Math.min(f.get(b.id)||0,w.get(b.id)||0,e.get(b.id)||0);
   const basic=group.market&&delivered>=Math.max(1,b.people);
   if(group.market&&delivered>=target)b.people=target;else if(!basic&&b.people>0)b.people--;
   const used=b.people;surplusFood+=Math.max(0,(f.get(b.id)||0)-used);surplusWater+=Math.max(0,(w.get(b.id)||0)-used);surplusEnergy+=Math.max(0,(e.get(b.id)||0)-used);
   b.ok=basic;b.reason=!group.market?'Markt fehlt im Straßennetz':(f.get(b.id)||0)<target?'Nahrung fehlt – Hof oder Straßenengpass prüfen':(w.get(b.id)||0)<target?'Wasser fehlt – Brunnen oder Straßenengpass prüfen':(e.get(b.id)||0)<target?'Energie fehlt – Windrad oder Straßenengpass prüfen':target===used&&used<32?'Versorgt · Wachstum möglich':'Versorgt · Waren, Dienste oder Jobs für Wachstum prüfen';
   b.level=used>16?3:used>8?2:1;if(used>8&&b.stock.goods>0)b.stock.goods--;
   group.people+=used;s.people+=used;if(group.market)s.supply+=Math.min(used,delivered);
  }
  for(const kind of goods){
   for(const targets of [sources.filter(b=>b.kind==='storage'),sources]){
    const supply=new Map(sources.map(b=>[b.id,Math.max(0,b.stock[kind]-(b.kind==='storage'?288:32))]));
    const demand=new Map(targets.map(b=>[b.id,Math.max(0,(b.kind==='storage'?288:32)-b.stock[kind])]));
    const before=new Map(supply),received=transport.move(supply,demand);
    for(const b of sources)b.stock[kind]-=(before.get(b.id)||0)-(supply.get(b.id)||0);
    for(const b of targets)b.stock[kind]+=received.get(b.id)||0;
   }
  }
  for(const b of all)for(const kind of goods){const cap=b.kind==='storage'?288:32;const excess=Math.max(0,b.stock[kind]-cap);s.overflow+=excess;if(excess)this.events.push('Überlauf '+kind+': '+excess+' (Gebäude '+b.id+')');b.stock[kind]=Math.min(cap,b.stock[kind]);}
  // Per-resource capacity is 32, or 288 in warehouses; discarded overflow is explicit.
  for(const group of groups.values()){s.jobs+=group.jobs;s.employed+=Math.min(group.people,group.jobs);const waste=Math.ceil(group.people/8);s.waste+=waste;s.recycled+=Math.min(waste,group.recycling);}
  for(const b of homes){const g=groups.get(b.net)!,unrecycled=Math.max(0,Math.ceil(g.people/8)-g.recycling);b.pollution+=Math.min(50,unrecycled*2);s.pollution+=b.pollution*b.people;}
  const sum=(values:Map<number,number>)=>{let n=0;for(const value of values.values())n+=value;return n;};
  s.food=sum(food)+surplusFood;s.water=sum(water)+surplusWater;s.energy=sum(energy)+surplusEnergy;
  s.income=s.people*2+s.employed;s.balance=s.income-s.upkeep;this.money+=s.balance;s.supply=s.people?Math.floor(s.supply*100/s.people):0;s.pollution=s.people?Math.floor(s.pollution/s.people):0;
  const sustainable=s.people>=256&&s.balance>0&&s.supply>=95&&(s.waste===0||s.recycled/s.waste>=.8)&&s.pollution<=20;s.streak=sustainable?old.streak+1:0;s.won=s.won||s.streak>=20;this.summary=s;
  if(this.tutorial>=1&&sources.some(b=>b.kind==='farm')&&sources.some(b=>b.kind==='well')&&sources.some(b=>b.kind==='wind')&&sources.some(b=>b.kind==='market'))this.tutorial=Math.max(this.tutorial,2);
  if(this.tutorial>=2&&homes.length)this.tutorial=Math.max(this.tutorial,3);if(this.tutorial>=3&&s.people>0)this.tutorial=Math.max(this.tutorial,4);
 }
 snapshot():Save{return {version:1,size:this.size,seed:this.seed,sandbox:this.sandbox,tick:this.tick,money:this.money,nextId:this.nextId,buildings:structuredClone([...this.buildings.values()]),summary:{...this.summary},tutorial:this.tutorial};}
 static load(input:unknown){const d=input as Save;if(!d||d.version!==1||!Array.isArray(d.buildings)||d.buildings.length>500000||!Number.isSafeInteger(d.tick)||d.tick<0||!Number.isSafeInteger(d.money)||!Number.isSafeInteger(d.seed)||d.seed!==(d.seed|0)||typeof d.sandbox!=='boolean')throw Error('Ungültiger oder unbekannter Spielstand');const sim=new Simulation(d.size,d.seed,d.sandbox);const ids=new Set<number>();let maxId=0;for(const b of d.buildings){if(!b||(typeof b.kind!=='string'||!Object.hasOwn(catalog,b.kind))||!Number.isSafeInteger(b.id)||b.id<1||ids.has(b.id)||!Number.isInteger(b.people)||b.people<0||b.people>32||(b.kind!=='home'&&b.people!==0)||!Number.isInteger(b.x)||!Number.isInteger(b.y)||b.x<0||b.y<0||b.x>=d.size||b.y>=d.size||sim.cells.has(b.y*d.size+b.x)||!b.stock||(['wood','ore','fuel','materials','goods'] as Goods[]).some(k=>!Number.isSafeInteger(b.stock[k])||b.stock[k]<0||b.stock[k]>(b.kind==='storage'?288:32))||!Number.isInteger(b.level)||b.level<1||b.level>3||typeof b.ok!=='boolean'||typeof b.reason!=='string'||(!Number.isSafeInteger(b.pollution)||b.pollution<0)||(!Number.isInteger(b.services)||b.services<0||b.services>3)||!Number.isInteger(b.net)||((b.kind==='bridge')!==!!sim.terrain[b.y*d.size+b.x]))throw Error('Beschädigte Gebäudedaten');ids.add(b.id);maxId=Math.max(maxId,b.id);const copy=structuredClone(b);sim.buildings.set(b.id,copy);sim.cells.set(b.y*d.size+b.x,copy);}if(!Number.isSafeInteger(d.nextId)||d.nextId>Number.MAX_SAFE_INTEGER||d.nextId<=maxId)throw Error('Ungültige Gebäude-ID');if(!Number.isInteger(d.tutorial)||d.tutorial<0||d.tutorial>5||!d.summary||Object.keys(summary()).some(k=>k==='won'?typeof d.summary.won!=='boolean':(!Number.isSafeInteger(d.summary[k as keyof Summary])||(k!=='balance'&&Number(d.summary[k as keyof Summary])<0))))throw Error('Ungültige Bilanz');sim.tick=d.tick;sim.money=d.money;sim.nextId=d.nextId;sim.summary={...d.summary};sim.tutorial=d.tutorial;return sim;}
}
