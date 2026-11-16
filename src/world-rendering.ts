import * as T from 'three';
import type {Building} from './simulation';

// Pure tile-unit recipes. Instancing is split by shape and 64-tile chunk.
export type Part={shape:'box'|'roof'|'ball'|'trunk'|'ring';x:number;y:number;z:number;sx:number;sy:number;sz:number;color:number};
export const part=(shape:Part['shape'],x:number,y:number,z:number,sx:number,sy:number,sz:number,color:number):Part=>({shape,x,y,z,sx,sy,sz,color});
export function batch(group:T.Group,parts:Part[],chunkSize=64){
 const buckets=new Map<string,Part[]>();
 for(const p of parts){const key=`${p.shape}:${Math.floor(p.x/chunkSize)}:${Math.floor(p.z/chunkSize)}`;const bucket=buckets.get(key)||[];bucket.push(p);buckets.set(key,bucket);}
 const matrix=new T.Matrix4(),q=new T.Quaternion(),color=new T.Color();
 for(const list of buckets.values()){
  const shape=list[0].shape;
  const geometry=shape==='roof'?new T.ConeGeometry(.71,1,4):shape==='ball'?new T.IcosahedronGeometry(.5,1):shape==='trunk'?new T.CylinderGeometry(.5,.6,1,7):shape==='ring'?new T.TorusGeometry(.38,.12,6,16):new T.BoxGeometry(1,1,1);
  if(shape==='roof')geometry.rotateY(Math.PI/4);
  if(shape==='ring')geometry.rotateX(Math.PI/2);
  const mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({roughness:.9}),list.length);
  list.forEach((p,i)=>{matrix.compose(new T.Vector3(p.x,p.y,p.z),q,new T.Vector3(p.sx,p.sy,p.sz));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(p.color));});
  mesh.computeBoundingSphere();group.add(mesh);
 }
}
export function tree(parts:Part[],x:number,z:number,s=1){
 parts.push(part('trunk',x,.35*s,z,.15*s,.7*s,.15*s,0x866b4c),part('ball',x,.95*s,z,.9*s,1.15*s,.85*s,0x618a58),part('ball',x+.22*s,1.12*s,z-.12*s,.7*s,.85*s,.7*s,0x80a567));
}
export function buildingParts(b:Building,c:number):Part[]{
 const p:Part[]=[],{x,y:z,kind:k}=b;
 const box=(dx:number,y:number,dz:number,w:number,h:number,d:number,color:number)=>p.push(part('box',x+dx,y,z+dz,w,h,d,color));
 const roof=(y:number,w:number,h:number,d:number,color=0xb56f50)=>p.push(part('roof',x,y,z,w,h,d,color));
 const house=(h:number)=>{box(0,h/2,0,.7,h,.64,c);roof(h+.16,.8,.32,.74);box(0,.2,-.326,.16,.38,.025,0x577572);box(-.22,h*.65,-.33,.12,.15,.025,0xe9f1d5);box(.22,h*.65,-.33,.12,.15,.025,0xe9f1d5);};
 if(k==='road'||k==='bridge'){box(0,.035,0,1,.07,1,c);if(k==='bridge'){box(-.44,.2,0,.06,.3,1,0xe7d4ad);box(.44,.2,0,.06,.3,1,0xe7d4ad);}return p;}
 p.push(part('ball',x+.1,-.005,z+.1,1.12,.025,1,0x8ba375));
 box(0,.025,0,.94,.05,.94,k==='park'?0x93af75:0xd4c99e);
 if(k==='home'){
  if(!b.people){for(const dx of [-.4,.4])box(dx,.12,0,.035,.2,.82,c);box(0,.055,0,.58,.025,.58,0xb5c48b);box(0,.2,0,.28,.3,.035,c);}else house(.48+Math.max(0,b.level-1)*.32);
 }else if(k==='farm'){
  for(let i=0;i<4;i++)box(-.3+i*.19,.08,.17,.09,.08,.53,i%2?0x9eac54:0xbb985c);
  box(0,.27,-.23,.58,.46,.36,c);p.push(part('roof',x,.62,z-.23,.66,.26,.44,0xa66049));
 }else if(k==='well'){
  p.push(part('trunk',x,.13,z,.6,.22,.6,0xbdb296),part('trunk',x,.25,z,.39,.035,.39,0x64adb6),part('ring',x,.27,z,.72,.72,.72,0xe7d9b7));
  for(const dx of [-.3,.3])box(dx,.52,0,.06,.65,.06,0x916e4f);roof(.91,.8,.25,.64,0x648f8a);
 }else if(k==='market'){
  box(0,.25,0,.78,.4,.55,0x9e7951);for(let i=0;i<5;i++)box(-.32+i*.16,.72,0,.16,.08,.76,i%2?0xf3dfad:c);
  for(const dx of [-.34,.34])box(dx,.43,.25,.04,.65,.04,0x896c4e);
  for(let i=0;i<3;i++)box(-.24+i*.24,.48,-.05,.16,.09,.22,[0xc1764d,0x8eac59,0xe0bb65][i]);
 }else if(k==='wind'){
  p.push(part('trunk',x,.85,z,.18,1.65,.18,c));box(0,1.67,0,.27,.22,.3,c);
  box(0,1.67,-.2,.09,1.25,.045,0xf5edcf);box(0,1.67,-.2,1.25,.09,.045,0xf5edcf);
  p.push(part('ball',x,1.67,z-.24,.2,.2,.14,0xb58f61));
 }else if(k==='park'||k==='forest'){tree(p,x-.18,z-.12,.65);if(k==='forest')tree(p,x+.23,z+.2,.55);else box(.22,.18,.22,.4,.12,.16,0xb29061);
 }else {house(k==='storage'?.45:.65);if(['power','materials','workshop','mine','recycle'].includes(k))box(.25,.85,.2,.17,.65,.17,0x7e8983);if(k==='clinic'){box(0,.63,-.34,.35,.07,.035,0xbd6958);box(0,.63,-.36,.07,.3,.035,0xbd6958);}}
 return p;
}
export function visualKey(b:Building,diagnosis:string){return `${b.kind}:${b.x}:${b.y}:${b.kind==='home'?`${b.level}:${b.people>0}`:''}:${diagnosis==='supply'?b.ok:diagnosis==='traffic'?b.net>=0:diagnosis==='environment'?b.pollution>20:''}`;}
