import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {Simulation} from '../src/simulation';
import {saveGame,loadGame,latestGame} from '../src/storage';
it('speichert manuell und in drei Autosave-Slots ohne ungültiges Überschreiben',async()=>{const sim=new Simulation();sim.command({type:'build',kind:'road',x:10,y:10});const initial=sim.snapshot();await saveGame('manual',initial);for(let i=0;i<3;i++){sim.step(10);await saveGame(`auto${i}`,sim.snapshot());}expect(await loadGame('manual')).toEqual(initial);await expect(saveGame('manual',{...initial,version:99} as never)).rejects.toThrow();expect(await loadGame('manual')).toEqual(initial);expect(await latestGame()).toEqual(initial);for(let i=0;i<3;i++)expect((await loadGame(`auto${i}`))?.tick).toBe((i+1)*10);});
it('weist beschädigte Werte, Fremdformate und doppelte IDs zurück',()=>{const s=new Simulation();s.command({type:'build',kind:'road',x:10,y:10});const a=s.snapshot();expect(()=>Simulation.load({...a,summary:{}})).toThrow();expect(()=>Simulation.load({...a,buildings:[...a.buildings,...a.buildings]})).toThrow();a.buildings[0].stock.wood=-1;expect(()=>Simulation.load(a)).toThrow();});
