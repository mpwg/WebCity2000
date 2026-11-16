import {it,expect} from 'vitest';
import {Flow} from '../src/flow';
it('begrenzt einen gemeinsamen Flaschenhals statt jede Nachfrage unabhängig',()=>{const f=new Flow(6);f.add(0,1,200);f.add(1,2,64);f.add(2,3,100);f.add(2,4,100);f.add(3,5,100);f.add(4,5,100);expect(f.run(0,5)).toBe(64);f.add(1,2,64);expect(f.run(0,5)).toBe(64);});
