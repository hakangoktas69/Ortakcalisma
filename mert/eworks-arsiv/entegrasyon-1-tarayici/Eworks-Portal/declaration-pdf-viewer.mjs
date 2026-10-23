// PDF.js yerel olarak sunulur; belge içeriği harici bir görüntüleyiciye gönderilmez.
import {getDocument,GlobalWorkerOptions} from './vendor/pdfjs/pdf.mjs';
GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
let active=null;
export function dispose(){if(active){active.destroy();active=null;}}
window.EworksPdfViewer={dispose};

export async function render(raw,container){
  dispose();
  const task=getDocument({data:new Uint8Array(raw),isEvalSupported:false,
    cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,
    standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,
    wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href});
  active=task;
  const pdf=await task.promise;
  if(!container.isConnected||active!==task)return;
  container.replaceChildren();container.removeAttribute('role');
  const controls=document.createElement('div');controls.className='actions';controls.style.cssText='position:sticky;top:0;background:white;padding:10px 0;z-index:1;align-items:center';
  const previous=document.createElement('button'),next=document.createElement('button'),counter=document.createElement('span');
  previous.className=next.className='btn small';previous.textContent='Önceki';next.textContent='Sonraki';
  previous.setAttribute('aria-label','Önceki PDF sayfası');next.setAttribute('aria-label','Sonraki PDF sayfası');
  counter.setAttribute('role','status');controls.append(previous,counter,next);
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','PDF sayfası');canvas.style.cssText='display:block;max-width:100%;height:auto;border:1px solid #dce5ef;background:white';
  const error=document.createElement('p');error.setAttribute('role','alert');
  container.append(controls,canvas,error);
  let number=1,busy=false;
  async function paint(){
    if(busy||active!==task)return;busy=true;previous.disabled=next.disabled=true;error.textContent='';
    try{
      const page=await pdf.getPage(number),original=page.getViewport({scale:1});
      const width=Math.max(200,container.clientWidth-4),pixelRatio=Math.min(window.devicePixelRatio||1,2);
      const viewport=page.getViewport({scale:width/original.width*pixelRatio});
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width=width+'px';
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      counter.textContent=number+' / '+pdf.numPages;
      container.dataset.renderedPage=String(number);container.dataset.pageCount=String(pdf.numPages);
    }catch(err){error.textContent='PDF önizlemesi açılamadı. Kayda dönerek İndir düğmesini kullanabilirsiniz.';throw err;}
    finally{busy=false;previous.disabled=number<=1;next.disabled=number>=pdf.numPages;}
  }
  previous.onclick=()=>{if(number>1){number--;paint().catch(()=>{});}};
  next.onclick=()=>{if(number<pdf.numPages){number++;paint().catch(()=>{});}};
  await paint();
}
