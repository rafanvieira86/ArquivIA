(()=>{
const c=APP_CONFIG, fields=c.headers, drop=new Set(Object.keys(c.dropdowns)), formula=fields[c.formulaColumn-1], records=[];
const $=id=>document.getElementById(id);
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}

function build(){
  const g=$('formGrid');g.innerHTML='';
  fields.forEach(n=>{
    const w=document.createElement('div');w.className='field';
    const l=document.createElement('label');l.textContent=n;
    let x;
    if(drop.has(n)){
      x=document.createElement('select');
      x.innerHTML='<option value="">Selecionar...</option>'+c.dropdowns[n].map(v=>`<option>${esc(v)}</option>`).join('');
    }else if(n===formula){
      w.classList.add('readonly');
      x=document.createElement('input');x.readOnly=true;x.placeholder='Calculado no Excel';
    }else if(['Título','OBS:','ENDEREÇO ANTERIOR'].includes(n)){
      x=document.createElement('textarea');
    }else {
      x=document.createElement('input');
    }
    x.id='f_'+slug(n);x.dataset.field=n;w.append(l,x);g.append(w);
  });
  
  // AUTOMAÇÃO DO PCTT TRF2
  if(typeof pcttDB !== 'undefined') {
    const inputCodigo = $('f_' + slug('Código (PCTT)'));
    if (inputCodigo) {
      inputCodigo.addEventListener('input', (e) => {
        const cod = e.target.value.trim();
        const info = pcttDB[cod];
        if (info) {
          const campoCorrente = $('f_' + slug('Prazo de Guarda PCTT (Arquivo Corrente) (em anos)'));
          const campoIntermediario = $('f_' + slug('Prazo de Guarda PCTT (Arquivo intermediário) (em anos)'));
          const campoDestinacao = $('f_' + slug('Destinação Final'));

          if(campoCorrente) { campoCorrente.value = info[0] || ''; campoCorrente.style.backgroundColor = '#e8f5e9'; setTimeout(()=>campoCorrente.style.backgroundColor='', 1000); }
          if(campoIntermediario) { campoIntermediario.value = info[1] || ''; campoIntermediario.style.backgroundColor = '#e8f5e9'; setTimeout(()=>campoIntermediario.style.backgroundColor='', 1000); }
          if(campoDestinacao) { campoDestinacao.value = info[2] || ''; campoDestinacao.style.backgroundColor = '#e8f5e9'; setTimeout(()=>campoDestinacao.style.backgroundColor='', 1000); }
        }
      });
    }
  }
}
build();

function prog(p,s){$('progressBox').classList.remove('hidden');$('progressBar').style.width=Math.max(0,Math.min(100,p))+'%';$('progressPct').textContent=Math.round(p)+'\%';$('progressText').textContent=s}
function showRaw(t){$('rawText').textContent=t\vert{}\vert{}'(nenhum texto reconhecido)';$('rawBox').classList.remove('hidden')}
function setStatus(s,ok=false){$('ocrStatus').textContent=s;$('ocrStatus').className='ocr-status '+(ok?'ok':'')}
function prepCanvas(srcCanvas){
 const max=3200, scale=Math.min(1,max/Math.max(srcCanvas.width,srcCanvas.height));
 const x=document.createElement('canvas');x.width=Math.max(1,Math.round(srcCanvas.width*scale));x.height=Math.max(1,Math.round(srcCanvas.height*scale));
 const ctx=x.getContext('2d',{willReadFrequently:true});ctx.drawImage(srcCanvas,0,0,x.width,x.height);
 const im=ctx.getImageData(0,0,x.width,x.height),d=im.data;
 for(let i=0;i<d.length;i+=4){let y=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]);y=(y-128)*1.45+128;y=Math.max(0,Math.min(255,y));d[i]=d[i+1]=d[i+2]=y;}
 ctx.putImageData(im,0,0);return x;
}
async function imageCanvas(file){const u=URL.createObjectURL(file);try{const im=await new Promise((r,j)=>{const i=new Image;i.onload=()=>r(i);i.onerror=()=>j(new Error('Não foi possível abrir a imagem.'));i.src=u});const x=document.createElement('canvas');const max=4200,s=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));x.width=Math.round(im.naturalWidth*s);x.height=Math.round(im.naturalHeight*s);x.getContext('2d').drawImage(im,0,0,x.width,x.height);return [prepCanvas(x)];}finally{URL.revokeObjectURL(u)}}
async function pdfCanvases(file){if(!window.pdfjsLib)throw new Error('PDF.js não carregou. Verifique a internet e recarregue a página.');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,a=[];for(let p=1;p<=pdf.numPages;p++){prog(5+(p/pdf.numPages)*15,`Abrindo página ${p} de ${pdf.numPages}...`);const page=await pdf.getPage(p),v=page.getViewport({scale:2.5}),x=document.createElement('canvas');x.width=v.width;x.height=v.height;await page.render({canvasContext:x.getContext('2d'),viewport:v}).promise;a.push(prepCanvas(x))}return a}
function cleanOcr(t){return String(t||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()}
function valueAfterLabel(lines, aliases){const ns=aliases.map(norm);for(let i=0;i<lines.length;i++){const line=norm(lines[i]);for(const a of ns){if(line===a||line.startsWith(a+':')||line.startsWith(a+' -')||line.includes(a+':')){let raw=lines[i].trim();let pos=norm(raw).indexOf(a);if(pos>=0){let val=raw.slice(pos+a.length).replace(/^\s*[:;\-–—]+\s*/,'').trim();if(val&&norm(val)!==a)return val}for(let j=i+1;j<Math.min(lines.length,i+3);j++){if(lines[j].trim())return lines[j].trim()}}}}return ''}
function regexValue(text,re){const m=text.match(re);return m?m[1].trim():''}
function sector(t){const n=norm(t);let best='';for(const s of c.sectors){const sn=norm(s);if(n.includes(sn))return s;const words=sn.split(/\s+/).filter(w=>w.length>3);if(words.filter(w=>n.includes(w)).length>=Math.min(3,words.length))best=s}return best}

function extract(text){
 const raw=cleanOcr(text), lines=raw.split(/\n/).map(x=>x.trim()).filter(Boolean), v={};
 v['Nome do Produtor']=sector(raw);v['UNIDADE']=sector(raw);
 
 const aliases={
 'Título':['descrição','descricao','assunto','descrição do documento','descricao do documento','tipo doc.','tipo doc','tipo de documento','espécie documental'],
 'Datas Limites':['data abrangente','período','periodo','período abrangido','data arq.','data de arquivamento'],
 'Código (PCTT)':['código (pctt)','codigo (pctt)','código pctt','codigo pctt','pctt'],
 'Prazo de Guarda PCTT (Arquivo Corrente) (em anos)':['prazo de guarda pctt (arquivo corrente)','arquivo corrente'],
 'Prazo de Guarda PCTT (Arquivo intermediário) (em anos)':['prazo de guarda pctt (arquivo intermediário)','arquivo intermediário'],
 'Destinação Final':['destinação final','destinacao final'],
 'OBS:':['obs:','obs','observação','observações'],
 'ENDEREÇO ANTERIOR':['endereço anterior','endereco anterior']
 };
 
 for(const [k,a] of Object.entries(aliases))v[k]=valueAfterLabel(lines,a);
 v['ENDEREÇO (CAIXA) (anterior)']=regexValue(raw,/(?:endereço\s*\(?\s*caixa\s*\)?|caixa|cx\.?)[\s:#-]*(E\s*[\/-]\s*[0-9A-Z-]+)/i)||regexValue(raw,/\b(E\s*[\/-]\s*\d{1,8})\b/i);
 v['ENDEREÇO (CAIXA) (atual)']=v['ENDEREÇO (CAIXA) (anterior)'];
 
 setTimeout(() => {
   const inputCodigo = $('f_' + slug('Código (PCTT)'));
   if (inputCodigo && inputCodigo.value) {
     inputCodigo.dispatchEvent(new Event('input'));
   }
 }, 200);

 return v;
}

async function process(file){if(!file)return;try{if(!window.Tesseract)throw new Error('Tesseract.js não carregou. Abra o aplicativo com internet e recarregue a página.');setStatus('Preparando documento...');prog(2,'Abrindo arquivo...');const canvases=file.type==='application/pdf'?await pdfCanvases(file):await imageCanvas(file);let text='';const worker=await Tesseract.createWorker('por',1,{logger:m=>{if(m.status==='recognizing text')prog(20+(m.progress||0)*75,'Lendo texto da imagem...');else if(m.status==='loading language traineddata')setStatus('Baixando modelo de português (primeira vez pode demorar)...')}});await worker.setParameters({preserve_interword_spaces:'1'});for(let i=0;i<canvases.length;i++){prog(20+(i/canvases.length)*75,`Lendo página ${i+1} de ${canvases.length}...`);const r=await worker.recognize(canvases[i]);text+='\n'+r.data.text;canvases[i].width=canvases[i].height=1}await worker.terminate();text=cleanOcr(text);showRaw(text);if(!text){setStatus('OCR terminou, mas não encontrou texto. Tente uma foto mais nítida, reta e bem iluminada.');toast('Nenhum texto foi reconhecido.');return}const values=extract(text);let count=0;fields.forEach(n=>{if(!drop.has(n)&&n!==formula&&values[n]){$('f_'+slug(n)).value=values[n];count++}});prog(100,'Leitura concluída');setStatus(`OCR concluído: ${count} campo(s) preenchido(s). Confira o texto lido abaixo.` ,true);toast(count?`Documento lido: ${count} campos preenchidos.`:'Texto lido, mas nenhum campo foi localizado.');setTimeout(()=>$('progressBox').classList.add('hidden'),1200)}catch(e){console.error(e);prog(0,'Erro: '+(e.message||e));setStatus('Erro no OCR: '+(e.message||e));toast('Não foi possível ler o documento. Veja a mensagem abaixo.')}}
$('fileInput').onchange=e=>process(e.target.files[0]);$('cameraInput').onchange=e=>process(e.target.files[0]);
function form(){const r={};fields.forEach(n=>r[n]=$('f_'+slug(n))?.value.trim()||'');return r}
function render(){const w=$('tableWrap');$('count').textContent=records.length;if(!records.length){w.innerHTML='<div class="empty">Nenhum registro adicionado.</div>';return}w.innerHTML='<table><thead><tr>'+fields.map(n=>'<th>'+esc(n)+'</th>').join('')+'<th>Ações</th></tr></thead><tbody>'+records.map((r,i)=>'<tr>'+fields.map(n=>'<td>'+esc(r[n])+'</td>').join('')+`<td><button class="danger" data-d="${i}">Excluir</button></td></tr>`).join('')+'</tbody></table>';w.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{records.splice(+b.dataset.d,1);render()})}
$('addBtn').onclick=()=>{const r=form();if(!r['Nome do Produtor']&&!r['Título']&&!r['ENDEREÇO (CAIXA) (atual)']){toast('Preencha pelo menos Nome do Produtor, Título ou Endereço da Caixa.');return}records.push(r);render();fields.forEach(n=>{const x=$('f_'+slug(n));if(x)x.value=''});$('rawBox').classList.add('hidden');toast('Registro adicionado.')};
$('clearBtn').onclick=()=>{fields.forEach(n=>{const x=$('f_'+slug(n));if(x)x.value=''});toast('Campos limpos.')};
function date(v){const m=String(v).match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);if(!m)return v;let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1])}$('exportBtn').onclick=()=>{if(!records.length){toast('Adicione pelo menos um registro.');return}const a=[fields];records.forEach((r,i)=>{const row=fields.map(n=>r[n]||'');const d=fields.indexOf('Datas Limites');if(d>=0&&row[d])row[d]=date(row[d]);row[c.formulaColumn-1]=`=IF(OR(D${i+2}="",N${i+2}=""),"",DATE(YEAR(D${i+2})+N${i+2}+1,MONTH(D${i+2}),DAY(D${i+2})))`;a.push(row)});const w=XLSX.utils.book_new(),s=XLSX.utils.aoa_to_sheet(a);s['!cols']=fields.map(n=>({wch:Math.min(42,Math.max(12,String(n).length+2))}));XLSX.utils.book_append_sheet(w,s,'Plan1');XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['ENDEREÇO (CAIXA)','UNIDADE']]),'Plan2');XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['ENDEREÇO (CAIXA)']]),'Plan3');XLSX.writeFile(w,'Inventario_TRF2_OCR.xlsx');toast('Excel exportado.')};
})();
