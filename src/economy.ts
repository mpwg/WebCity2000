import {Flow} from './flow';
import {isRoad,services,type Building,type Goods,type Simulation,type Summary} from './simulation';
const goods:Goods[]=['wood','ore','fuel','materials','goods'];
/** Räumliche Suche mit konstant kleinem Suchgebiet statt quadratischem Stadtvergleich. */
function nearby(items:Building[],size:number){
 const width=Math.ceil(size/16),grid=new Map<number,Building[]>();
 for(const b of items){const key=Math.floor(b.y/16)*width+Math.floor(b.x/16);const list=grid.get(key)||[];list.push(b);grid.set(key,list);}
 return (b:Building)=>{const found:Building[]=[];const cx=Math.floor(b.x/16),cy=Math.floor(b.y/16);for(let y=Math.max(0,cy-1);y<=Math.min(width-1,cy+1);y++)for(let x=Math.max(0,cx-1);x<=Math.min(width-1,cx+1);x++)for(const p of grid.get(y*width+x)||[])found.push(p);return found;};
}
type Offer={building:Building;amount:number};
type Demand={building:Building;amount:number};
/** Eine aggregierte Flussrechnung pro Ware und Produktionsphase. Straßen haben
 * 340 Einheiten Gesamtkapazität: je 85 Nahrung/Wasser/Energie/Fracht. Fracht wird
 * von allen Produktionsstufen gemeinsam belegt. Die Reservierung verhindert,
 * dass die stabile Bearbeitungsreihenfolge Strom durch Nahrung verdrängt. */
class Transport {
 roads:Building[];indices:Map<number,number>;freight:Map<number,number>;
 constructor(private sim:Simulation,group:Building[]){this.roads=group.filter(b=>isRoad(b.kind));this.indices=new Map(this.roads.map((b,i)=>[b.id,i]));this.freight=new Map(this.roads.map(b=>[b.id,85]));}
 attached(b:Building){for(const key of this.sim.neighbors(b.x,b.y)){const road=this.sim.cells.get(key);if(road&&isRoad(road.kind)&&road.net===b.net)return this.indices.get(road.id);}return undefined;}
 send(offers:Offer[],demands:Demand[],freight=false){
 const received=new Map<number,number>(),spent=new Map<number,number>();
 if(!offers.length||!demands.length)return {received,spent};
 const source=this.roads.length*2,sink=source+1,flow=new Flow(sink+1);
 const roadEdges=this.roads.map((b,i)=>flow.add(i*2,i*2+1,freight?this.freight.get(b.id)!:85));
 for(const [i,b] of this.roads.entries())for(const key of this.sim.neighbors(b.x,b.y)){const next=this.sim.cells.get(key),index=next?this.indices.get(next.id):undefined;if(index!==undefined)flow.add(i*2+1,index*2,340);}
 const entries=offers.map(o=>{const index=this.attached(o.building);return {o,edge:index===undefined?undefined:flow.add(source,index*2,o.amount)};});
 const exits=demands.map(d=>{const index=this.attached(d.building);return {d,edge:index===undefined?undefined:flow.add(index*2+1,sink,d.amount)};});
 flow.run(source,sink);
 for(const {o,edge} of entries)spent.set(o.building.id,edge?edge.initial-edge.capacity:0);
 for(const {d,edge} of exits)received.set(d.building.id,edge?edge.initial-edge.capacity:0);
 if(freight)roadEdges.forEach((edge,i)=>this.freight.set(this.roads[i].id,edge.capacity));
 return {received,spent};
 }
}
export function economy(sim:Simulation){
 sim.networks();const old=sim.summary;const s:Summary={people:0,jobs:0,employed:0,food:0,water:0,energy:0,income:0,upkeep:0,balance:0,supply:0,waste:0,recycled:0,pollution:0,streak:old.streak,won:old.won,overflow:0};
 const all=[...sim.buildings.values()].sort((a,b)=>a.id-b.id),nets=new Map<number,Building[]>();
 const pollutionSources=nearby(all.filter(b=>b.kind==='mine'||b.kind==='power'),sim.size),parks=nearby(all.filter(b=>b.kind==='park'),sim.size);
 for(const b of all){b.ok=isRoad(b.kind);b.reason=isRoad(b.kind)?'Straße · 85 Einheiten je Versorgung und Fracht':'Kein Straßenanschluss';b.pollution=0;for(const p of pollutionSources(b))if(Math.abs(b.x-p.x)+Math.abs(b.y-p.y)<=8)b.pollution+=25;for(const p of parks(b))if(Math.abs(b.x-p.x)+Math.abs(b.y-p.y)<=5)b.pollution=Math.max(0,b.pollution-15);if(isRoad(b.kind))s.upkeep++;if(b.net<0){if(b.kind==='home'){b.people=Math.max(0,b.people-1);s.people+=b.people;s.pollution+=b.people*b.pollution;}continue;}const list=nets.get(b.net)||[];list.push(b);nets.set(b.net,list);}
 for(const group of nets.values()){
 const transport=new Transport(sim,group),plants=group.filter(b=>!isRoad(b.kind)&&b.kind!=='home'),homes=group.filter(b=>b.kind==='home');
 const offers={food:[] as Offer[],water:[] as Offer[],energy:[] as Offer[]};let jobs=0;
 for(const b of plants){b.ok=true;b.reason='In Betrieb';s.upkeep+=2;jobs+=b.kind==='workshop'?12:4;
 switch(b.kind){case 'farm':offers.food.push({building:b,amount:24});break;case 'well':offers.water.push({building:b,amount:24});break;case 'water':offers.water.push({building:b,amount:100});break;case 'wind':offers.energy.push({building:b,amount:32});break;case 'forest':b.stock.wood+=8;break;case 'mine':b.stock.ore+=8;b.stock.fuel+=4;break;}}
 // Rohstoffe bleiben am Gebäude. Transport verschiebt sie nur über ein
 // tatsächlich verbundenes Netz und mit gemeinsamem Frachtbudget.
 const transfer=(good:Goods,receivers:Building[],target:number)=>{
 const recipients=receivers.filter(b=>b.stock[good]<target);
 const suppliers=group.filter(b=>b.stock[good]>0&&!recipients.includes(b));
 const result=transport.send(suppliers.map(building=>({building,amount:building.stock[good]})),recipients.map(building=>({building,amount:target-building.stock[good]})),true);
 for(const b of suppliers)b.stock[good]-=result.spent.get(b.id)||0;
 for(const b of recipients)b.stock[good]+=result.received.get(b.id)||0;
 };
 const powers=plants.filter(b=>b.kind==='power');transfer('fuel',powers,1);for(const b of powers){if(b.stock.fuel){b.stock.fuel--;offers.energy.push({building:b,amount:160});}else{b.ok=false;b.reason='Brennstoff fehlt – Mine oder Frachtverbindung prüfen';}}
 const factories=plants.filter(b=>b.kind==='materials'),workshops=plants.filter(b=>b.kind==='workshop');
 transfer('wood',factories,2);transfer('ore',factories,2);
 const industry=[...factories,...workshops].sort((a,b)=>a.id-b.id);
 const homeDemand=homes.map(building=>({building,amount:Math.max(1,building.people+1)}));
 const electric=transport.send(offers.energy,[...industry.map(building=>({building,amount:1})),...homeDemand]);
 // Feste dokumentierte Phasen; innerhalb jeder Phase aufsteigende IDs.
 for(const b of factories){if((electric.received.get(b.id)||0)<1){b.ok=false;b.reason='Energie fehlt – Erzeugung oder Straßenkapazität prüfen';}else if(b.stock.wood>=2&&b.stock.ore>=2){b.stock.wood-=2;b.stock.ore-=2;b.stock.materials+=4;}else{b.ok=false;b.reason='Holz oder Erz fehlt – Zulieferer und Fracht prüfen';}}
 transfer('materials',workshops,1);
 for(const b of workshops){if((electric.received.get(b.id)||0)<1){b.ok=false;b.reason='Energie fehlt – Windrad oder Verbindung prüfen';}else if(b.stock.materials>=1){b.stock.materials--;b.stock.goods+=4;}else{b.ok=false;b.reason='Baustoff fehlt – Baustoffwerk und Fracht prüfen';}}
 const market=plants.some(b=>b.kind==='market');if(market)transfer('goods',homes.filter(b=>b.people>=8),1);
 const food=transport.send(offers.food,market?homeDemand:[]).received,water=transport.send(offers.water,homeDemand).received;
 const serviceNear=nearby(plants.filter(b=>services.includes(b.kind)),sim.size);let employed=0,foodUsed=0,waterUsed=0,energyUsed=industry.reduce((n,b)=>n+(electric.received.get(b.id)||0),0);
 const totalFood=offers.food.reduce((n,o)=>n+o.amount,0),totalWater=offers.water.reduce((n,o)=>n+o.amount,0),totalEnergy=offers.energy.reduce((n,o)=>n+o.amount,0);
 for(const b of homes){
 const f=food.get(b.id)||0,w=water.get(b.id)||0,e=electric.received.get(b.id)||0,need=Math.max(1,b.people);
 b.services=new Set(serviceNear(b).filter(p=>Math.hypot(p.x-b.x,p.y-b.y)<=12).map(p=>p.kind)).size;
 let reason='';if(!market)reason='Markt fehlt im Straßennetz';else if(f<need)reason=totalFood>=need?'Verkehrsengpass – parallele Straßen oder lokalen Hof bauen':'Nahrung fehlt – Hof anschließen';else if(w<need)reason=totalWater>=need?'Verkehrsengpass – parallele Straße oder lokalen Brunnen bauen':'Wasser fehlt – Brunnen im Viertel bauen';else if(e<need)reason=totalEnergy>=need?'Verkehrsengpass – parallele Straße oder lokales Windrad bauen':'Strom fehlt – Windrad anschließen';else if(jobs-employed<need)reason='Freie Arbeitsplätze fehlen';else if(b.people>=8&&(!b.stock.goods||b.services<1))reason='Für Stufe 2: Waren und öffentlicher Dienst nötig';else if(b.people>=16&&(b.services<2||b.pollution>20))reason='Für Stufe 3: zwei Dienste und niedrige Belastung nötig';
 const basic=market&&f>=need&&w>=need&&e>=need;const grow=!reason&&f>b.people&&w>b.people&&e>b.people&&jobs-employed>b.people;
 if(grow&&b.people<32)b.people++;else if(!basic&&b.people>0)b.people--;
 b.level=b.people>16?3:b.people>8?2:1;b.ok=basic;b.reason=reason||(b.people===32?'Voll entwickelt und versorgt':'Versorgt · Wachstum möglich');
 if(b.people>8&&b.stock.goods>0)b.stock.goods--;foodUsed+=Math.min(f,b.people);waterUsed+=Math.min(w,b.people);energyUsed+=Math.min(e,b.people);employed+=Math.min(b.people,Math.max(0,jobs-employed));s.people+=b.people;if(basic)s.supply+=b.people;
 }
 let generated=Math.ceil(homes.reduce((n,b)=>n+b.people,0)/8);for(const b of homes){const amount=Math.min(generated,Math.ceil(b.people/8));b.waste+=amount;generated-=amount;}
 const waste=homes.reduce((n,b)=>n+b.waste,0);let recycling=plants.filter(b=>b.kind==='recycle').length*64,recycled=0;
 for(const b of homes){const amount=Math.min(recycling,b.waste);b.waste-=amount;recycling-=amount;recycled+=amount;}
 const dirtyHomes=nearby(homes.filter(b=>b.waste>0),sim.size);for(const b of homes){for(const p of dirtyHomes(b))if(Math.abs(p.x-b.x)+Math.abs(p.y-b.y)<=5)b.pollution+=Math.min(50,p.waste*2);s.pollution+=b.pollution*b.people;}
 s.waste+=waste;s.recycled+=recycled;s.jobs+=jobs;s.employed+=employed;s.food+=Math.max(0,totalFood-foodUsed);s.water+=Math.max(0,totalWater-waterUsed);s.energy+=Math.max(0,totalEnergy-energyUsed);
 // Lager nehmen Überschuss auf; kapazitätsbedingt untransportierter Überhang
 // verfällt erst danach. Auch leere Gründungsstädte produzieren Grundgüter.
 const storages=plants.filter(b=>b.kind==='storage');for(const good of goods){const over=group.filter(b=>b.kind!=='storage'&&b.stock[good]>32);const result=transport.send(over.map(building=>({building,amount:building.stock[good]-32})),storages.filter(b=>b.stock[good]<288).map(building=>({building,amount:288-building.stock[good]})),true);for(const b of over)b.stock[good]-=result.spent.get(b.id)||0;for(const b of storages)b.stock[good]+=result.received.get(b.id)||0;for(const b of group){const cap=b.kind==='storage'?288:32;s.overflow+=Math.max(0,b.stock[good]-cap);b.stock[good]=Math.min(cap,b.stock[good]);}}
 }
 s.income=s.people*2+s.employed;s.balance=s.income-s.upkeep;sim.money+=s.balance;s.supply=s.people?Math.floor(s.supply*100/s.people):0;s.pollution=s.people?Math.floor(s.pollution/s.people):0;
 const sustainable=s.people>=256&&s.balance>0&&s.supply>=95&&(s.waste===0||s.recycled/s.waste>=.8)&&s.pollution<=20;s.streak=sustainable?s.streak+1:0;s.won=s.won||s.streak>=20;sim.summary=s;
 if(sim.tutorial>=1&&['farm','well','wind','market'].every(kind=>all.some(b=>b.kind===kind)))sim.tutorial=Math.max(sim.tutorial,2);if(sim.tutorial>=2&&all.some(b=>b.kind==='home'))sim.tutorial=Math.max(sim.tutorial,3);if(sim.tutorial>=3&&s.people>0)sim.tutorial=Math.max(sim.tutorial,4);
}
