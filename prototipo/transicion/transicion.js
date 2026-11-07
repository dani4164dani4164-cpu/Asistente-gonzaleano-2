/* ============================================================
   Transición entre asistentes (three.js)
   Miles de partículas nacen de la forma del asistente que se va,
   salen disparadas, viajan en remolino cambiando de color y
   dibujan la forma del asistente que llega, que se materializa.
   ============================================================ */
import * as THREE from 'three';

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const suave=x=>x*x*(3-2*x),limitar=x=>Math.max(0,Math.min(1,x));

/* ---------- Formas: puntos que dibujan a cada asistente ---------- */
const v=new THREE.Vector3(),eu=new THREE.Euler();
function enAnillo(r,rot,a,out){v.set(Math.cos(a)*r,Math.sin(a)*r,0);eu.set(...rot);return out.copy(v.applyEuler(eu));}
const FORMAS={
  agios(n,rand){
    const P=[];
    for(let i=0;i<n;i++){
      const k=rand(),p=new THREE.Vector3();
      if(k<0.36){                                         // giroscopio: 4 anillos
        const j=Math.floor(rand()*4),r=(0.38+j*0.19)*0.82;
        enAnillo(r,[[Math.PI/2,0.3,0],[0.9,0,0],[0.2,1.1,0],[1.3,0.6,0.4]][j],rand()*6.283,p);
      }else if(k<0.72){                                   // esfera de circuitos
        const u=rand()*2-1,a=rand()*6.283,q=Math.sqrt(1-u*u),r=[0.5,0.56,0.62][Math.floor(rand()*3)];
        p.set(q*Math.cos(a)*r,u*r*0.9,q*Math.sin(a)*r);
      }else if(k<0.88){                                   // anillo escáner
        enAnillo(0.97,[1.15,0,0.35],rand()*6.283,p);
      }else{                                              // núcleo
        const u=rand()*2-1,a=rand()*6.283,q=Math.sqrt(1-u*u),r=0.04+rand()*0.1;p.set(q*Math.cos(a)*r,u*r,q*Math.sin(a)*r);
      }
      P.push(p);
    }
    return {puntos:P,inclinacion:0.25,tono:[242,33]};
  },
  kyrien(n,rand){
    const P=[],RG=0.44;
    for(let i=0;i<n;i++){
      const k=rand(),p=new THREE.Vector3();
      if(k<0.34){                                         // roca
        const u=rand()*2-1,a=rand()*6.283,q=Math.sqrt(1-u*u),irr=1+0.08*Math.sin(a*3+u*4);
        p.set(q*Math.cos(a)*RG*1.12*irr,u*RG*0.9*irr,q*Math.sin(a)*RG*0.55*irr);
      }else if(k<0.6){                                    // gran anillo de inscripciones
        enAnillo(0.86+rand()*0.11,[1.18,0,0.25],rand()*6.283,p);
      }else if(k<0.78){                                   // anillo cruzado
        enAnillo(0.66+rand()*0.12,[0.35,-0.95,0],rand()*6.283,p);
      }else if(k<0.9){                                    // ojo: almendra e iris al frente
        const a=rand()*6.283;
        if(rand()<0.5){const u=rand()*2-1;p.set(u*0.3,(rand()<0.5?1:-1)*0.16*Math.pow(1-u*u,0.7),0.27);}
        else p.set(Math.cos(a)*0.19,Math.sin(a)*0.19,0.27);
      }else{                                              // hexagrama
        const lado=Math.floor(rand()*6),s=rand(),a0=Math.PI/2+lado*2*Math.PI/3*(lado<3?1:1)+(lado>=3?Math.PI:0);
        const A=[Math.cos(a0)*0.68,Math.sin(a0)*0.68],B=[Math.cos(a0+2.094)*0.68,Math.sin(a0+2.094)*0.68];
        v.set(A[0]+(B[0]-A[0])*s,A[1]+(B[1]-A[1])*s,0);eu.set(-0.75,0.5,0);p.copy(v.applyEuler(eu));
      }
      P.push(p);
    }
    return {puntos:P,inclinacion:0.16,tono:[33,7]};
  }
};

function texturaSuave(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#fff');gr.addColorStop(0.25,'rgba(255,255,255,.8)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

const DISCO=new THREE.Euler(1.05,0,0.2),NORMAL=new THREE.Vector3(0,1,0).applyEuler(DISCO);
export function crearTransicion(contenedor,N=2600){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0);
  renderer.domElement.className='escena transicion';contenedor.append(renderer.domElement);
  const escena=new THREE.Scene(),camara=new THREE.PerspectiveCamera(37,1,0.1,50),grupo=new THREE.Group();escena.add(grupo);
  const pos=new Float32Array(N*3),col=new Float32Array(N*3),geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const tex=texturaSuave();
  const mat=new THREE.PointsMaterial({size:0.03,map:tex,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  const puntos=new THREE.Points(geo,mat);puntos.frustumCulled=false;grupo.add(puntos);
  let dist=4,activa=null;
  const c1=new THREE.Color(),c2=new THREE.Color();

  function redimensionar(w,h){renderer.setSize(w,h,false);camara.aspect=w/h;const aj=1.2/Math.tan(THREE.MathUtils.degToRad(18.5));dist=camara.aspect<1?aj/camara.aspect:aj;camara.updateProjectionMatrix();}

  /* Arranca una transición: de → a, en `dur` ms */
  function correr(de,a,dur=6000,modo='estallido'){
    const rand=rng(Math.floor(Math.random()*1e6));
    const A=FORMAS[de](N,rand),B=FORMAS[a](N,rand);
    const P=[];
    for(let i=0;i<N;i++){
      const s=A.puntos[i],d=B.puntos[i];
      const sal=s.clone().normalize().multiplyScalar(0.25+rand()*0.45).add(new THREE.Vector3(rand()-.5,rand()-.5,rand()-.5).multiplyScalar(0.25));
      const eje=new THREE.Vector3(rand()-.5,rand()-.5,rand()-.5).normalize();
      // onda expansiva: casi todas en un anillo inclinado, algunas en una cáscara esférica
      let onda;
      if(rand()<0.75){const brazo=Math.floor(rand()*3),a=brazo*2.094+rand()*0.9,r=0.55+rand()*1.1;onda=new THREE.Vector3(Math.cos(a)*r,(rand()-.5)*0.06,Math.sin(a)*r).applyEuler(DISCO);}
      else{const u=rand()*2-1,a=rand()*6.283,q=Math.sqrt(1-u*u),r=0.8+rand()*0.5;onda=new THREE.Vector3(q*Math.cos(a)*r,u*r,q*Math.sin(a)*r);}
      P.push({s,d,ex:s.clone().add(sal),onda,giro:(rand()<0.5?1:-1)*(1+rand()),eje,ret:rand()*0.08,h1:A.tono[0]+(rand()-.5)*2*A.tono[1],h2:B.tono[0]+(rand()-.5)*2*B.tono[1],tam:0.6+rand()*0.8});
    }
    activa={P,t:0,dur,modo,incA:A.inclinacion,incB:B.inclinacion};
    renderer.domElement.style.opacity=1;
  }

  const tmp=new THREE.Vector3(),perp=new THREE.Vector3();
  function dibujar(dT,rot=0){
    if(!activa){return false;}
    activa.t+=dT;const p=limitar(activa.t/activa.dur);
    grupo.rotation.set(activa.incA+(activa.incB-activa.incA)*suave(p),rot,0,'YXZ');
    camara.position.set(0,0,dist);camara.lookAt(0,0,0);
    const blanco=new THREE.Color(1,0.97,0.9),Y=new THREE.Vector3(0,1,0);
    for(let i=0;i<N;i++){
      const q=activa.P[i];let k,brillo;
      if(activa.modo==='implosion'){
        // 1) absorbido hacia el centro, en espiral
        const e0=suave(limitar(p/0.17));
        tmp.copy(q.s).multiplyScalar(1-0.97*e0).applyAxisAngle(Y,e0*2.5*q.giro);
        // 2) onda expansiva
        const e1=1-Math.pow(1-limitar((p-0.17)/0.09),3);
        if(e1>0)tmp.lerp(q.onda,e1);
        // 3) vórtice: giran como galaxia y se recogen un poco
        const e2=limitar((p-0.24)/0.4);
        // la galaxia gira en un solo sentido; el centro más rápido que las orillas → brazos en espiral
        if(e2>0){const r=Math.max(0.3,q.onda.length());tmp.copy(q.onda).multiplyScalar(1-0.25*suave(e2)).applyAxisAngle(NORMAL,e2*Math.PI*1.6/r);}
        // 4) corrientes que dibujan al nuevo asistente
        const e3=suave(limitar((p-0.56-q.ret)/0.28));
        if(e3>0){perp.copy(q.eje).cross(tmp).multiplyScalar(Math.sin(e3*Math.PI)*0.35);tmp.lerp(q.d,e3).add(perp);}
        k=suave(limitar((p-0.26)/0.35));
        c1.setHSL(q.h1/360,0.85,0.66);c2.setHSL(q.h2/360,0.92,0.62);c1.lerp(c2,k);
        const fogon=Math.exp(-Math.pow((p-0.18)/0.035,2));     // fogonazo al implotar
        c1.lerp(blanco,0.25*e0*(1-k)+0.7*fogon);
        brillo=limitar(p/0.03)*(1-limitar((p-0.88)/0.12))*(0.75+0.9*e0*(1-e1)+1.2*fogon);
      }else{
        const e1=suave(limitar(p/0.24)),e2=suave(limitar((p-0.2-q.ret)/0.42));
        tmp.lerpVectors(q.s,q.ex,e1);
        if(e2>0){perp.copy(q.eje).cross(tmp).multiplyScalar(Math.sin(e2*Math.PI)*0.5);tmp.lerp(q.d,e2).add(perp);}
        k=suave(limitar((p-0.2)/0.5));
        c1.setHSL(q.h1/360,0.85,0.66);c2.setHSL(q.h2/360,0.92,0.62);c1.lerp(c2,k);
        brillo=limitar(p/0.04)*(1-limitar((p-0.84)/0.16))*(0.7+0.6*Math.sin(Math.min(1,e1+e2)*Math.PI*0.5+0.3));
      }
      pos[i*3]=tmp.x;pos[i*3+1]=tmp.y;pos[i*3+2]=tmp.z;
      col[i*3]=Math.min(1,c1.r*brillo);col[i*3+1]=Math.min(1,c1.g*brillo);col[i*3+2]=Math.min(1,c1.b*brillo);
    }
    mat.size=0.026+0.02*Math.sin(p*Math.PI);
    geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
    renderer.render(escena,camara);
    if(p>=1){activa=null;renderer.clear();renderer.domElement.style.opacity=0;}
    return true;
  }
  return {correr,dibujar,redimensionar,get modo(){return activa?activa.modo:null;},get activa(){return !!activa;},get progreso(){return activa?limitar(activa.t/activa.dur):1;}};
}
