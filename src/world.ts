import * as T from 'three';
import {type Building,type Kind} from './simulation';
import {batch,part,tree,buildingParts,visualKey,type Part} from "./world-rendering";
const colors:Record<Kind,number>={road:0x697d80,bridge:0xb3a181,home:0xf1d6a1,farm:0xd4b878,well:0x73bdca,water:0x70aabc,wind:0xf6f0dd,power:0x8f919d,forest:0x57936a,mine:0x9a8d83,materials:0xcf9a72,workshop:0xd58962,market:0xe5b25e,storage:0xbca982,recycle:0x68a98c,school:0xe6c77e,clinic:0xf1ded2,fire:0xcf7564,park:0x4d9a65};
export class World {
 renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.OrthographicCamera();root=new T.Group();terrainGroup=new T.Group();buildings=new Map<number,Building>();meshes:T.InstancedMesh[]=[];terrain=new Uint8Array();size=256;target=new T.Vector3(16,0,16);zoom=26;angle=0;diagnosis='normal';cursor={x:16,y:16};preview:T.Mesh;ray=new T.Raycaster();plane=new T.Plane(new T.Vector3(0,1,0),0);onTile:(x:number,y:number,build:boolean)=>void=()=>{};onView:()=>void=()=>{};dirty=true;
 constructor(public host:HTMLElement){this.renderer=new T.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setClearColor(0xcbded5);this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','Stadtansicht. Pfeiltasten bewegen den Bauzeiger, Eingabe baut, I untersucht. WASD bewegt die Karte, Q und E drehen, Plus und Minus zoomen.');host.append(this.renderer.domElement);this.scene.add(this.terrainGroup,this.root);this.scene.add(new T.HemisphereLight(0xffffff,0x829779,1.8));const sun=new T.DirectionalLight(0xffedd4,2.4);sun.position.set(-20,40,10);this.scene.add(sun);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;this.preview=new T.Mesh(new T.BoxGeometry(.98,.1,.98),new T.MeshBasicMaterial({color:0x55ce85,transparent:true,opacity:.7}));this.scene.add(this.preview);new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.events();this.frame();}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);this.camera.left=-this.zoom*w/h;this.camera.right=this.zoom*w/h;this.camera.top=this.zoom;this.camera.bottom=-this.zoom;this.camera.near=.1;this.camera.far=Math.max(1500,this.zoom*12);this.camera.updateProjectionMatrix();this.position();}
 position(){const a=Math.PI/4+this.angle*Math.PI/2;this.camera.position.copy(this.target).add(new T.Vector3(Math.cos(a),1,Math.sin(a)).multiplyScalar(Math.max(100,this.zoom*2)));this.camera.lookAt(this.target);this.dirty=true;}
 move(dx:number,dy:number){this.target.x=Math.max(0,Math.min(this.size-1,this.target.x+dx));this.target.z=Math.max(0,Math.min(this.size-1,this.target.z+dy));this.position();this.onView();}
 rotate(){this.angle=(this.angle+1)%4;this.position();}
 setZoom(f:number){this.zoom=Math.max(6,Math.min(this.size,this.zoom*f));this.resize();this.onView();}
 events(){const canvas=this.renderer.domElement;let down:{x:number;y:number;button:number}|undefined;canvas.oncontextmenu=e=>e.preventDefault();canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(down&&(down.button===1||down.button===2||e.shiftKey)){const scale=this.zoom/this.host.clientHeight*2;this.move(-(e.clientX-down.x)*scale,-(e.clientY-down.y)*scale);down={x:e.clientX,y:e.clientY,button:down.button};}else{const r=canvas.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hit=new T.Vector3();if(this.ray.ray.intersectPlane(this.plane,hit)){this.cursor={x:Math.floor(hit.x+.5),y:Math.floor(hit.z+.5)};this.onTile(this.cursor.x,this.cursor.y,false);}}});canvas.addEventListener('pointerup',e=>{if(down&&down.button===0&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5&&!e.shiftKey)this.onTile(this.cursor.x,this.cursor.y,true);down=undefined;});canvas.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(Math.exp(e.deltaY*.001));},{passive:false});canvas.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown','enter',' '].includes(key))e.preventDefault();const dirs:Record<string,[number,number]>={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]};if(dirs[key]){this.cursor.x+=dirs[key][0];this.cursor.y+=dirs[key][1];this.onTile(this.cursor.x,this.cursor.y,false);}if(key==='enter')this.onTile(this.cursor.x,this.cursor.y,true);if(key==='i')this.onTile(this.cursor.x,this.cursor.y,true);if(key==='a')this.move(-3,0);if(key==='d')this.move(3,0);if(key==='w')this.move(0,-3);if(key==='s')this.move(0,3);if(key==='q'){this.angle=(this.angle+3)%4;this.position();}if(key==='e')this.rotate();if(key==='+')this.setZoom(.8);if(key==='-')this.setZoom(1.25);});}
 setTerrain(data:Uint8Array,size:number){this.terrain=new Uint8Array(data);this.size=size;this.terrainView='';this.rebuildTerrain();}
 clear(group:T.Group){for(const obj of [...group.children]){group.remove(obj);if(obj instanceof T.Mesh){if(obj instanceof T.InstancedMesh)obj.dispose();obj.geometry.dispose();for(const mat of Array.isArray(obj.material)?obj.material:[obj.material])mat.dispose();}}}

 // Render only a bounded area; coarse cells replace detail at overview zoom.
 terrainView='';
 rebuildTerrain(){
 this.clear(this.terrainGroup);
 const aspect=this.host.clientWidth/Math.max(1,this.host.clientHeight);
 const radius=Math.ceil(this.zoom*(aspect+1)+16),step=Math.max(1,Math.ceil(radius/85));
 const cx=Math.floor(this.target.x/8)*8,cz=Math.floor(this.target.z/8)*8;
 const parts:Part[]=[],occupied=new Set([...this.buildings.values()].map(b=>b.y*this.size+b.x));
 const wet=(x:number,z:number)=>x>=0&&z>=0&&x<this.size&&z<this.size&&!!this.terrain[z*this.size+x];
 for(let z=cz-radius;z<=cz+radius;z+=step)for(let x=cx-radius;x<=cx+radius;x+=step){
 const water=wet(x,z),bank=!water&&(wet(x-1,z)||wet(x+1,z)||wet(x,z-1)||wet(x,z+1));
 const variation=Math.sin(x*.13+Math.sin(z*.09))*Math.cos(z*.11);
 const color=water?0x78b8bd:bank?0xc9c29b:variation>.35?0xa7bd87:variation<-.35?0x97b27b:0xa0b982;
 parts.push(part('box',x,-.11,z,step,.18,step,color));
 // Low rounded meadow forms, grouped groves and their soft contact shadows.
 if(step===1&&!water&&!bank&&!occupied.has(z*this.size+x)){
 const hash=((Math.imul(x,73856093)^Math.imul(z,19349663))>>>0);
 const grove=Math.sin(x*.21+z*.07)+Math.cos(z*.19-x*.05)>1.05;
 if(grove&&hash%13===0){
 parts.push(part('ball',x,.003,z,.95,.018,.8,0x8da675));
 tree(parts,x,z,.65+(hash%7)*.08);
 }else if(hash%173===0){
 parts.push(part('ball',x,-.08,z,2.8,.24,2.2,0xa9be8c));
 }
 }
 }
 batch(this.terrainGroup,parts,64*step);this.dirty=true;
 }
 update(updates:Building[],removed:number[]){
 let changed=removed.some(id=>this.buildings.has(id)),landChanged=changed;
 for(const id of removed)this.buildings.delete(id);
 for(const b of updates){const old=this.buildings.get(b.id);if(!old||visualKey(old,this.diagnosis)!==visualKey(b,this.diagnosis))changed=true;if(!old||old.x!==b.x||old.y!==b.y)landChanged=true;this.buildings.set(b.id,b);}
 if(changed)this.rebuild();if(landChanged)this.terrainView='';
 }
 rebuild(){
 this.clear(this.root);const parts:Part[]=[];
 // Worker already sends the visible region; additionally bound detail for large overviews.
 const stride=Math.max(1,Math.ceil(this.zoom/100)),regions=new Set<string>();
 for(const b of this.buildings.values()){
 let c=colors[b.kind];
 if(this.diagnosis==='supply')c=b.ok?0x5cae7d:0xd77657;
 if(this.diagnosis==='traffic')c=b.net>=0?0x66aab6:0xd77657;
 if(this.diagnosis==='environment')c=b.pollution>20?0xd87b56:0x6cad7a;
 if(stride===1)parts.push(...buildingParts(b,c));
 else {const x=Math.floor(b.x/stride)*stride,z=Math.floor(b.y/stride)*stride,key=x+':'+z;if(!regions.has(key)){regions.add(key);parts.push(part('box',x,.15,z,stride,.3,stride,c));}}
 }
 batch(this.root,parts,64*stride);this.dirty=true;
 }
 showPreview(x:number,y:number,valid:boolean){this.preview.position.set(x,.13,y);(this.preview.material as T.MeshBasicMaterial).color.setHex(valid?0x38a76f:0xda5b49);this.dirty=true;}
 frame=()=>{requestAnimationFrame(this.frame);if(document.hidden)return;const view=[Math.floor(this.target.x/8),Math.floor(this.target.z/8),this.zoom,this.host.clientWidth,this.host.clientHeight].join(':');if(view!==this.terrainView){this.terrainView=view;this.rebuildTerrain();this.rebuild();}if(this.dirty){this.renderer.render(this.scene,this.camera);this.dirty=false;}};
}
