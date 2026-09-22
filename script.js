window.onload = function() {
  if (typeof APP_CONFIG === 'undefined') {
    alert("ERRO: O arquivo config.js não foi encontrado. Verifique se ele foi salvo corretamente.");
    return;
  }

  var c = APP_CONFIG;
  var fields = c.headers;
  var drop = new Set(Object.keys(c.dropdowns || {}));
  var formula = fields[c.formulaColumn ? c.formulaColumn - 1 : -1];
  var records = [];
  
  function $(id) { return document.getElementById(id); }
  
  function slug(s) {
    if (!s) return '';
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, function(x) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[x];
    });
  }
  
  function norm(s) {
    if (!s) return '';
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  
  function toast(s) {
    var t = $('toast');
    if (t) {
      t.textContent = s;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 3000);
    }
  }

  function build() {
    var g = $('formGrid');
    if (!g) return;
    g.innerHTML = '';
    fields.forEach(function(n) {
      var w = document.createElement('div');
      w.className = 'field';
      var l = document.createElement('label');
      l.textContent = n;
      var x;
      if (drop.has(n)) {
        x = document.createElement('select');
        var optionsHtml = '<option value="">Selecionar...</option>';
        c.dropdowns[n].forEach(function(v) {
          optionsHtml += '<option>' + esc(v) + '</option>';
        });
        x.innerHTML = optionsHtml;
      } else if (n === formula) {
        w.classList.add('readonly');
        x = document.createElement('input');
        x.readOnly = true;
        x.placeholder = 'Calculado no Excel';
      } else if (n === 'Título' || n === 'OBS:' || n === 'ENDEREÇO ANTERIOR') {
        x = document.createElement('textarea');
      } else {
        x = document.createElement('input');
      }
      x.id = 'f_' + slug(n);
      x.dataset.field = n;
      w.appendChild(l);
      w.appendChild(x);
      g.appendChild(w);
    });
    
    if (typeof pcttDB !== 'undefined') {
      var inputCodigo = $('f_' + slug('Código (PCTT)'));
      if (inputCodigo) {
        inputCodigo.addEventListener('input', function(e) {
          var cod = e.target.value.trim();
          var info = pcttDB[cod];
          if (info) {
            var campoCorrente = $('f_' + slug('Prazo de Guarda PCTT (Arquivo Corrente) (em anos)'));
            var campoIntermediario = $('f_' + slug('Prazo de Guarda PCTT (Arquivo intermediário) (em anos)'));
            var campoDestinacao = $('f_' + slug('Destinação Final'));

            if (campoCorrente) { campoCorrente.value = info[0] || ''; campoCorrente.style.backgroundColor = '#e8f5e9'; setTimeout(function(){campoCorrente.style.backgroundColor='';}, 1000); }
            if (campoIntermediario) { campoIntermediario.value = info[1] || ''; campoIntermediario.style.backgroundColor = '#e8f5e9'; setTimeout(function(){campoIntermediario.style.backgroundColor='';}, 1000); }
            if (campoDestinacao) { campoDestinacao.value = info[2] || ''; campoDestinacao.style.backgroundColor = '#e8f5e9'; setTimeout(function(){campoDestinacao.style.backgroundColor='';}, 1000); }
          }
        });
      }
    }
  }
  build();

  function prog(p, s) {
    var b = $('progressBox'); if(b) b.classList.remove('hidden');
    var pb = $('progressBar'); if(pb) pb.style.width = Math.max(0, Math.min(100, p)) + '%';
    var pt = $('progressPct'); if(pt) pt.textContent = Math.round(p) + '%';
    var ptxt = $('progressText'); if(ptxt) ptxt.textContent = s;
  }

  function showRaw(t) {
    var r = $('rawText'); if(r) r.textContent = t || '(nenhum texto reconhecido)';
    var rb = $('rawBox'); if(rb) rb.classList.remove('hidden');
  }

  function setStatus(s, ok) {
    var st = $('ocrStatus');
    if (st) {
      st.textContent = s;
      st.className = 'ocr-status ' + (ok ? 'ok' : '');
    }
  }
  
  function prepCanvas(srcCanvas) {
    var max = 3200;
    var scale = Math.min(1, max / Math.max(srcCanvas.width, srcCanvas.height));
    var x = document.createElement('canvas');
    x.width = Math.max(1, Math.round(srcCanvas.width * scale));
    x.height = Math.max(1, Math.round(srcCanvas.height * scale));
    var ctx = x.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(srcCanvas, 0, 0, x.width, x.height);
    var im = ctx.getImageData(0, 0, x.width, x.height);
    var d = im.data;
    for (var i = 0; i < d.length; i += 4) {
      var y = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]);
      y = (y - 128) * 1.45 + 128;
      y = Math.max(0, Math.min(255, y));
      d[i] = d[i+1] = d[i+2] = y;
    }
    ctx.putImageData(im, 0, 0);
    return x;
  }
  
  async function imageCanvas(file) {
    var u = URL.createObjectURL(file);
    try {
      var im = await new Promise(function(resolve, reject) {
        var i = new Image();
        i.onload = function() { resolve(i); };
        i.onerror = function() { reject(new Error('Não foi possível abrir a imagem.')); };
        i.src = u;
      });
      var x = document.createElement('canvas');
      var max = 4200;
      var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      x.width = Math.round(im.naturalWidth * s);
      x.height = Math.round(im.naturalHeight * s);
      x.getContext('2d').drawImage(im, 0, 0, x.width, x.height);
      return [prepCanvas(x)];
    } finally {
      URL.revokeObjectURL(u);
    }
  }
  
  async function pdfCanvases(file) {
    if (!window.pdfjsLib) throw new Error('PDF.js não carregou.');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
    var a = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      prog(5 + (p / pdf.numPages) * 15, 'Abrindo página ' + p + ' de ' + pdf.numPages + '...');
      var page = await pdf.getPage(p);
      var v = page.getViewport({scale: 2.5});
      var x = document.createElement('canvas');
      x.width = v.width;
      x.height = v.height;
      await page.render({canvasContext: x.getContext('2d'), viewport: v}).promise;
      a.push(prepCanvas(x));
    }
    return a;
  }
  
  function cleanOcr(t) {
    return String(t || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  
  function valueAfterLabel(lines, aliases) {
    var ns = aliases.map(norm);
    for (var i = 0; i < lines.length; i++) {
      var line = norm(lines[i]);
      for (var k = 0; k < ns.length; k++) {
        var a = ns[k];
        if (line === a || line.startsWith(a + ':') || line.startsWith(a + ' -') || line.includes(a + ':')) {
          var raw = lines[i].trim();
          var pos = norm(raw).indexOf(a);
          if (pos >= 0) {
            var val = raw.slice(pos + a.length).replace(/^\s*[:;\-–—]+\s*/, '').trim();
            if (val && norm(val) !== a) return val;
          }
          for (var j = i + 1; j < Math.min(lines.length, i + 3); j++) {
            if (lines[j].trim()) return lines[j].trim();
          }
        }
      }
    }
    return '';
  }
  
  function regexValue(text, re) {
    var m = text.match(re);
    return m ? m[1].trim() : '';
  }
  
  function sector(t) {
    var n = norm(t);
    var best = '';
    for (var i = 0; i < c.sectors.length; i++) {
      var s = c.sectors[i];
      var sn = norm(s);
      if (n.includes(sn)) return s;
      var words = sn.split(/\s+/).filter(function(w){ return w.length > 3; });
      var matches = words.filter(function(w){ return n.includes(w); });
      if (matches.length >= Math.min(3, words.length)) best = s;
    }
    return best;
  }

  function extract(text) {
    var raw = cleanOcr(text);
    var lines = raw.split(/\n/).map(function(x){ return x.trim(); }).filter(Boolean);
    var v = {};
    v['Nome do Produtor'] = sector(raw);
    v['UNIDADE'] = sector(raw);
    
    var aliases = {
      'Título': ['descrição', 'descricao', 'assunto', 'descrição do documento', 'descricao do documento', 'tipo doc.', 'tipo doc', 'tipo de documento', 'espécie documental'],
      'Datas Limites': ['data abrangente', 'período', 'periodo', 'período abrangido', 'data arq.', 'data de arquivamento', 'ano de arquivamento'],
      'Código (PCTT)': ['código (pctt)', 'codigo (pctt)', 'código pctt', 'codigo pctt', 'pctt'],
      'Prazo de Guarda PCTT (Arquivo Corrente) (em anos)': ['prazo de guarda pctt (arquivo corrente)', 'arquivo corrente'],
      'Prazo de Guarda PCTT (Arquivo intermediário) (em anos)': ['prazo de guarda pctt (arquivo intermediário)', 'arquivo intermediário'],
      'Destinação Final': ['destinação final', 'destinacao final'],
      'OBS:': ['obs:', 'obs', 'observação', 'observações'],
      'ENDEREÇO ANTERIOR': ['endereço anterior', 'endereco anterior'],
      'Tipo de Caixa': ['tipo de caixa'],
      'Data de Eliminação': ['data de eliminação', 'data de eliminacao', 'eliminação', 'eliminacao']
    };
    
    var keys = Object.keys(aliases);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      v[k] = valueAfterLabel(lines, aliases[k]);
    }
    
    v['ENDEREÇO (CAIXA) (anterior)'] = regexValue(raw, /(?:endereço\s*\(?\s*caixa\s*\)?|caixa|cx\.?)[\s:#-]*(E\s*[\/-]\s*[0-9A-Z-]+)/i) || regexValue(raw, /\b(E\s*[\/-]\s*\d{1,8})\b/i);
    v['ENDEREÇO (CAIXA) (atual)'] = v['ENDEREÇO (CAIXA) (anterior)'];
    
    setTimeout(function() {
      var inputCodigo = $('f_' + slug('Código (PCTT)'));
      if (inputCodigo && inputCodigo.value) {
        inputCodigo.dispatchEvent(new Event('input'));
      }
    }, 200);

    return v;
  }

  async function process(file) {
    if (!file) return;
    try {
      if (!window.Tesseract) throw new Error('Tesseract.js não carregou.');
      setStatus('Preparando documento...');
      prog(2, 'Abrindo arquivo...');
      
      var canvases = file.type === 'application/pdf' ? await pdfCanvases(file) : await imageCanvas(file);
      var text = '';
      
      var worker = await Tesseract.createWorker('por', 1, {
        logger: function(m) {
          if (m.status === 'recognizing text') {
            prog(20 + (m.progress || 0) * 75, 'Lendo texto da imagem...');
          } else if (m.status === 'loading language traineddata') {
            setStatus('Baixando modelo de português...');
          }
        }
      });
      await worker.setParameters({preserve_interword_spaces: '1'});
      
      for (var i = 0; i < canvases.length; i++) {
          prog(20 + (i / canvases.length) * 75, 'Lendo página ' + (i + 1) + ' de ' + canvases.length + '...');
          var r = await worker.recognize(canvases[i]);
          text += '\n' + r.data.text;
          canvases[i].width = canvases[i].height = 1;
      }
      await worker.terminate();
      
      text = cleanOcr(text);
      showRaw(text);
      
      if (!text) {
          setStatus('OCR terminou, mas não encontrou texto claro.');
          toast('Nenhum texto reconhecido.');
          return;
      }
      
      var values = extract(text);
      var count = 0;
      fields.forEach(function(n) {
          if (!drop.has(n) && n !== formula && values[n]) {
              var f = $('f_' + slug(n));
              if (f) { f.value = values[n]; count++; }
          }
      });
      
      prog(100, 'Leitura concluída');
      setStatus('OCR concluído: ' + count + ' campo(s) preenchido(s). Confira os dados abaixo.', true);
      toast(count ? 'Leitura concluída.' : 'Nenhum campo compatível foi localizado.');
      setTimeout(function() { $('progressBox').classList.add('hidden'); }, 1500);
    } catch(e) {
        console.error(e);
        var msg = e.message || e;
        prog(0, 'Erro: ' + msg);
        setStatus('Erro no OCR: ' + msg);
        toast('Falha na leitura. Tente outra foto.');
    } finally {
        if ($('fileInput')) $('fileInput').value = '';
        if ($('cameraInput')) $('cameraInput').value = '';
    }
  }

  var fIn = $('fileInput'); 
  if (fIn) {
    fIn.onchange = function(e) { if(e.target.files[0]) process(e.target.files[0]); };
  }
  var cIn = $('cameraInput'); 
  if (cIn) {
    cIn.onchange = function(e) { if(e.target.files[0]) process(e.target.files[0]); };
  }

  function form() {
    var r = {};
    fields.forEach(function(n) {
      var el = $('f_' + slug(n));
      r[n] = el ? el.value.trim() : '';
    });
    return r;
  }
  
  function render() {
    var w = $('tableWrap');
    if (!w) return;
    $('count').textContent = records.length;
    if (!records.length) {
      w.innerHTML = '<div class="empty">Nenhum registro adicionado.</div>';
      return;
    }
    
    var html = '<table><thead><tr>';
    fields.forEach(function(n) { html += '<th>' + esc(n) + '</th>'; });
    html += '<th>Ações</th></tr></thead><tbody>';
    
    records.forEach(function(r, i) {
      html += '<tr>';
      fields.forEach(function(n) { html += '<td>' + esc(r[n]) + '</td>'; });
      html += '<td><button class="danger" data-d="' + i + '">Excluir</button></td></tr>';
    });
    html += '</tbody></table>';
    w.innerHTML = html;
    
    var btns = w.querySelectorAll('[data-d]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function() {
        records.splice(parseInt(this.dataset.d, 10), 1);
        render();
      };
    }
  }
  
  var addBtn = $('addBtn');
  if (addBtn) {
    addBtn.onclick = function() {
      var r = form();
      if (!r['Nome do Produtor'] && !r['Título'] && !r['ENDEREÇO (CAIXA) (atual)']) {
        toast('Preencha pelo menos Nome do Produtor, Título ou Endereço da Caixa.');
        return;
      }
      records.push(r);
      render();
      fields.forEach(function(n) {
        var x = $('f_' + slug(n));
        if (x) x.value = '';
      });
      var rb = $('rawBox'); 
      if (rb) rb.classList.add('hidden');
      toast('Registro adicionado.');
    };
  }
  
  var clearBtn = $('clearBtn');
  if (clearBtn) {
    clearBtn.onclick = function() {
      fields.forEach(function(n) {
        var x = $('f_' + slug(n));
        if (x) x.value = '';
      });
      toast('Campos limpos.');
    };
  }
  
  function date(v) {
    var m = String(v).match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (!m) return v;
    var y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }
  
  var expBtn = $('exportBtn');
  if (expBtn) {
    expBtn.onclick = function() {
      if (!records.length) { toast('Adicione pelo menos um registro.'); return; }
      var a = [fields];
      var d = fields.indexOf('Datas Limites');
      var prazoIndex = fields.indexOf('Prazo de Guarda PCTT (Arquivo Corrente) (em anos)');
      var colDate = d >= 0 ? String.fromCharCode(65 + d) : 'C';
      var colPrazo = prazoIndex >= 0 ? String.fromCharCode(65 + prazoIndex) : 'I';
      
      records.forEach(function(r, i) {
        var row = fields.map(function(n) { return r[n] || ''; });
        if (d >= 0 && row[d]) row[d] = date(row[d]);
        row[c.formulaColumn - 1] = '=IF(OR(' + colDate + (i + 2) + '="",' + colPrazo + (i + 2) + '=""),"",DATE(YEAR(' + colDate + (i + 2) + ')+' + colPrazo + (i + 2) + '+1,MONTH(' + colDate + (i + 2) + '),DAY(' + colDate + (i + 2) + ')))';
        a.push(row);
      });
      
      var w = XLSX.utils.book_new();
      var s = XLSX.utils.aoa_to_sheet(a);
      s['!cols'] = fields.map(function(n) {
        return { wch: Math.min(42, Math.max(12, String(n).length + 2)) };
      });
      XLSX.utils.book_append_sheet(w, s, 'Plan1');
      XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([['ENDEREÇO (CAIXA)', 'UNIDADE']]), 'Plan2');
      XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([['ENDEREÇO (CAIXA)']]), 'Plan3');
      XLSX.writeFile(w, 'Inventario_TRF2_OCR.xlsx');
      toast('Excel exportado.');
    };
  }
};
