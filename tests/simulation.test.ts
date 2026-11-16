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
