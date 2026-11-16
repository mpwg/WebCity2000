import {describe,it,expect} from 'vitest';
import {Simulation,type Kind} from '../src/simulation';
function village(){const s=new Simulation(128,42,true);for(let x=5;x<20;x++)s.command({type:'build',kind:'road',x,y:10});(['farm','well','wind','market','home','forest','mine','materials','workshop'] as Kind[]).forEach((kind,i)=>s.command({type:'build',kind,x:i+5,y:9}));return s;}
describe('Simulationsvertrag',()=>{
 it('ist deterministisch über 100.000 Ticks',()=>{const a=village(),b=village();a.step(100000);b.step(100000);expect(a.snapshot()).toEqual(b.snapshot());expect(a.summary.people).toBeGreaterThan(0);});
 it('bucht ungültige Aktionen nicht',()=>{const s=new Simulation();const start=s.money;expect(s.command({type:'build',kind:'bridge',x:1,y:1})).not.toBe('');expect(s.money).toBe(start);expect(s.command({type:'build',kind:'farm',x:-1,y:0})).not.toBe('');});
 it('trennt und verbindet Versorgung und lässt langsame Erholung zu',()=>{const s=village();s.step(80);const h=[...s.buildings.values()].find(b=>b.kind==='home')!;expect(h.people).toBe(8);s.command({type:'demolish',x:8,y:10});s.step(10);expect(h.people).toBe(7);expect(h.reason).toContain('Markt');s.command({type:'build',kind:'road',x:8,y:10});s.step(10);expect(h.people).toBe(8);});
 it('bilanziert Produktionsschritte und Finanzen',()=>{const s=village();const before=s.money;s.step(10);expect(s.money-before).toBe(s.summary.balance);const stock=[...s.buildings.values()].reduce((r,b)=>({wood:r.wood+b.stock.wood,ore:r.ore+b.stock.ore,materials:r.materials+b.stock.materials,goods:r.goods+b.stock.goods}),{wood:0,ore:0,materials:0,goods:0});expect(stock).toEqual({wood:6,ore:6,materials:3,goods:4});});
 it('schaltet Dienste und Industrie erst später frei',()=>{const s=new Simulation();expect(s.validate('school',4,4)).toContain('32');expect(s.validate('mine',4,4)).toContain('64');});
 it('setzt einen gespeicherten Stand identisch fort',()=>{const a=village();a.step(123);const b=Simulation.load(JSON.parse(JSON.stringify(a.snapshot())));a.step(1000);b.step(1000);expect(a.snapshot()).toEqual(b.snapshot());expect(()=>Simulation.load({version:9})).toThrow();});
 it('erzeugt gleiches Gelände und garantiert trockenes Startgebiet',()=>{const a=new Simulation(2048,7),b=new Simulation(2048,7);expect(a.terrain).toEqual(b.terrain);expect(a.terrain[10*2048+10]).toBe(0);});
});

describe('Robuste Kernbefehle und Transport',()=>{
 it('weist manipulierte Befehle und Koordinaten ohne Mutation ab',()=>{
  const s=village(),before=s.snapshot();
  for(const c of [{type:'demolish',x:128,y:8},{type:'demolish',x:5.5,y:9},{type:'build',kind:'toString',x:1,y:1},{type:'other',x:1,y:1},null]){
   expect(s.command(c as never)).not.toBe('');
  }expect(s.snapshot()).toEqual(before);
 });
 it('weist fehlende Lager- und Bilanzfelder sowie geerbte Typnamen ab',()=>{
  for(const mutate of [(d:any)=>delete d.buildings[0].stock.wood,(d:any)=>d.buildings[0].kind='constructor',(d:any)=>delete d.summary.people,(d:any)=>delete d.tutorial]){
   const d=village().snapshot();mutate(d);expect(()=>Simulation.load(d)).toThrow();
  }
 });
 it('entspannt einen gemeinsamen Flaschenhals durch einen zweiten Weg',()=>{
  const s=new Simulation(128,42,true);
  const build=(kind:Kind,x:number,y:number)=>expect(s.command({type:'build',kind,x,y})).toBe('');
  for(let x=5;x<=45;x++)build('road',x,10);
  for(let x=5;x<=10;x++){build('farm',x,9);build('well',x,11);}
  for(let x=11;x<=14;x++)build('wind',x,9);
  build('market',14,11);
  for(let x=31;x<=38;x++){build('home',x,9);s.cells.get(9*128+x)!.people=1;}
  const a=Simulation.load(s.snapshot());a.step(10);const constrained=a.summary.people;
  for(let x=4;x<=45;x++)build('road',x,12);
  build('road',4,10);build('road',4,11);build('road',13,11);build('road',45,11);
  s.step(10);expect(s.summary.people).toBeGreaterThan(constrained);expect(s.summary.people).toBe(16);
  for(const b of s.buildings.values())for(const n of Object.values(b.stock))expect(n).toBeGreaterThanOrEqual(0);
 });
 it('begrenzt Wachstum auf nachgewiesene Versorgung',()=>{
  const s=village();const homes=[...s.buildings.values()].filter(b=>b.kind==='home');homes[0].people=24;
  s.step(10);expect(homes[0].people).toBeLessThanOrEqual(24);expect(s.summary.food).toBeGreaterThanOrEqual(0);
 });
});

describe('Ressourcen bleiben sichtbar',()=>{
 it('behält im getrennten Viertel Wasser und erholt sich nach Wiederanschluss',()=>{
  const s=village();s.step(80);
  s.command({type:'build',kind:'well',x:16,y:11});
  s.command({type:'demolish',x:8,y:10});s.step(10);
  expect(s.summary.water).toBeGreaterThanOrEqual(24);
  const home=[...s.buildings.values()].find(b=>b.kind==='home')!;expect(home.people).toBe(7);
  s.command({type:'build',kind:'road',x:8,y:10});s.step(10);expect(home.people).toBe(8);
 });
 it('bilanziert jedes Produktionsgut mit Verbrauch und ausgewiesenem Überlauf',()=>{
  const s=village();s.step(1000);
  const totals=()=>Object.fromEntries(['wood','ore','fuel','materials','goods'].map(k=>[k,[...s.buildings.values()].reduce((n,b)=>n+b.stock[k as keyof typeof b.stock],0)]));
  const before=totals();s.step(10);const after=totals();
  const produced={wood:8,ore:8,fuel:4,materials:4,goods:4};
  const consumed={wood:2,ore:2,fuel:0,materials:1,goods:0};
  let overflow=0;for(const k of Object.keys(produced) as (keyof typeof produced)[]){
   const delta=before[k]+produced[k]-consumed[k]-after[k];expect(delta).toBeGreaterThanOrEqual(0);overflow+=delta;
  }expect(overflow).toBe(s.summary.overflow);
 });
 it('verhindert Fernversorgung über unverbundene Kartenränder',()=>{
  const s=new Simulation(128,42,true);
  for(const [kind,y] of [['farm',1],['well',3],['wind',5],['market',7],['home',9]] as [Kind,number][])s.command({type:'build',kind,x:0,y});
  s.step(100);expect(s.summary.people).toBe(0);
 });
});

describe('Große Spielstände und Erholung',()=>{
 it('lädt 150.000 IDs ohne Argument-Spread und verwirft ungültige Importe ohne Mutation',()=>{
  const s=new Simulation(1024,42,true);s.command({type:'build',kind:'road',x:0,y:0});
  const d=s.snapshot(),template=d.buildings[0];
  d.buildings=Array.from({length:150000},(_,i)=>({...template,id:i+1,x:i%400,y:Math.floor(i/400),stock:{...template.stock}}));
  d.nextId=150001;const loaded=Simulation.load(d);expect(loaded.buildings.size).toBe(150000);expect(loaded.nextId).toBe(150001);
  const before=s.snapshot();d.buildings[149999].stock.ore=-1;expect(()=>Simulation.load(d)).toThrow();expect(s.snapshot()).toEqual(before);
 });
 it('erholt den Rundensaldo durch Abriss überflüssiger Betriebe',()=>{
  const s=village();s.step(80);expect(s.summary.balance).toBeLessThan(0);s.money=-10;
  expect(s.command({type:'build',kind:'park',x:22,y:10})).toBe(''); // sandbox keeps its explicit cost exemption
  for(let x=10;x<=13;x++)s.command({type:'demolish',x,y:9});
  s.command({type:'demolish',x:22,y:10});s.step(10);expect(s.summary.balance).toBeGreaterThan(0);
  const paid=new Simulation();paid.money=-1;expect(paid.command({type:'build',kind:'road',x:1,y:1})).toContain('Geld');expect(paid.money).toBe(-1);
 });
 it('erhält die Bilanz, wenn Verarbeitungsinputs nur teilweise ankommen',()=>{
  const s=new Simulation(128,42,true);
  for(let x=1;x<=5;x++)s.command({type:'build',kind:'road',x,y:10});
  for(const [kind,x] of [['forest',1],['materials',3],['wind',5]] as [Kind,number][])s.command({type:'build',kind,x,y:9});
  s.step(10);const total=[...s.buildings.values()].reduce((n,b)=>n+b.stock.wood,0);
  expect(total).toBe(8);expect(s.cells.get(9*128+3)!.stock.wood).toBe(2);expect(s.cells.get(9*128+3)!.stock.materials).toBe(0);
 });
});

describe('Brücken und lokale Dienste',()=>{
 it('stoppt Lieferungen beim Brückenabriss, erhält den lokalen Brunnen und nimmt sie wieder auf',()=>{
  const s=new Simulation(128,42,true),y=30;
  let river=0;while(!s.terrain[y*s.size+river])river++;
  const build=(kind:Kind,x:number,by:number)=>expect(s.command({type:'build',kind,x,y:by})).toBe('');
  for(let x=river-10;x<=river+12;x++)build(s.terrain[y*s.size+x]?'bridge':'road',x,y);
  for(const [kind,x] of [['farm',river-9],['well',river-8],['wind',river-7],['market',river-6],['home',river+8]] as [Kind,number][])build(kind,x,y-1);
  build('well',river+9,y+1);s.step(80);
  const home=s.cells.get((y-1)*s.size+river+8)!;expect(home.people).toBe(8);
  s.command({type:'demolish',x:river+1,y});s.step(10);expect(home.people).toBe(7);expect(home.reason).toContain('Markt');expect(s.summary.water).toBeGreaterThanOrEqual(24);
  build('bridge',river+1,y);s.step(10);expect(home.people).toBe(8);
 });
 it('zählt Diensttypen im Radius und entfernt die Wirkung beim Anschlussverlust',()=>{
  const s=village();s.command({type:'build',kind:'school',x:19,y:9});s.command({type:'build',kind:'clinic',x:19,y:11});
  s.step(10);const home=[...s.buildings.values()].find(b=>b.kind==='home')!;expect(home.services).toBe(2);
  s.command({type:'demolish',x:19,y:10});s.step(10);expect(home.services).toBe(0);
 });
});
