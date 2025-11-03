(function(){
  const $ = s=>document.querySelector(s);
  const $$ = s=>Array.from(document.querySelectorAll(s));
  const on = (el,ev,fn)=> el.addEventListener(ev,fn);

  const state = { role:"guest", me:null, db:null, selected:null };

  const DBKEY = "portalLLD_v3";
  function loadDB(){
    try{ const raw = localStorage.getItem(DBKEY); if(raw) return JSON.parse(raw); }catch{}
    const demo = { clientes: {} };
    saveDB(demo); return demo;
  }
  function saveDB(db){ localStorage.setItem(DBKEY, JSON.stringify(db)); }

  function toast(msg, ms=1500){ const t=$("#toast"); t.textContent=msg; t.classList.remove("hidden"); setTimeout(()=>t.classList.add("hidden"),ms); }
  const fmtBRL = n => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const fmtDate = s => { const d=new Date(s+"T00:00:00"); return d.toLocaleDateString('pt-BR'); };
  const badge = st => st==="pago"?"badge pago":(st==="vencido"?"badge vencido":"badge aberto");
  const fileToDataURL = f => new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(f); });

  function doLogin(){
    const cpf = $("#inpCPF").value.trim();
    const senha = $("#inpSenha").value.trim();
    if(!cpf || !senha){ toast("Informe CPF e senha."); return; }
    const {ADMIN} = window.APP_CONFIG;
    if(cpf===ADMIN.cpf && senha===ADMIN.senha){
      state.role="admin"; state.me={cpf};
      $("#whoami").textContent = "Admin";
      $("#btnLogout").classList.remove("hidden");
      $("#loginView").classList.add("hidden"); $("#adminView").classList.remove("hidden");
      $("#modeLabel").textContent = window.APP_CONFIG.USE_SUPABASE?"SUPABASE":"LOCAL";
      renderUsers(); bindAdminUI();
      return;
    }
    const u = state.db.clientes[cpf];
    if(!u || u.senha!==senha){ toast("Cliente não encontrado ou senha inválida."); return; }
    state.role="cliente"; state.me={cpf};
    $("#whoami").textContent = u.nome||cpf;
    $("#btnLogout").classList.remove("hidden");
    $("#loginView").classList.add("hidden"); $("#clienteView").classList.remove("hidden");
    renderCliente(u); bindClienteUI(u);
  }
  function doLogout(){
    state.role="guest"; state.me=null; state.selected=null;
    $("#btnLogout").classList.add("hidden"); $("#whoami").textContent="";
    $("#adminView").classList.add("hidden"); $("#clienteView").classList.add("hidden"); $("#loginView").classList.remove("hidden");
  }

  function renderUsers(){
    const tb=$("#tbUsers"); tb.innerHTML="";
    const rows = Object.values(state.db.clientes).sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));
    for(const u of rows){
      const contratoTxt = u.contrato?.pdf ? "link" : (u.contrato?.data ? "anexo local" : "—");
      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td>${u.cpf}</td>
        <td>${u.nome||""}</td>
        <td>${u.servico||""}</td>
        <td>${u.parcelas?.length||0}</td>
        <td>${contratoTxt}</td>
        <td class="row gap">
          <button class="btn" data-act="ger" data-cpf="${u.cpf}">Gerenciar</button>
          <button class="btn ghost" data-act="as" data-cpf="${u.cpf}">Abrir como cliente</button>
          <button class="btn ghost danger" data-act="del" data-cpf="${u.cpf}">Excluir</button>
        </td>`;
      tb.appendChild(tr);
    }
  }
  function bindAdminUI(){
    $$("#adminView .tabs .tab").forEach(btn=>{
      on(btn,"click",()=>{
        btn.parentElement.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        ["usuarios","novo","config"].forEach(id=> $("#tab-"+id).classList.toggle("hidden", id!==tab));
      });
    });
    on($("#btnCriar"),"click", async ()=>{
      const cpf=$("#novoCPF").value.trim(), nome=$("#novoNome").value.trim(), senha=$("#novoSenha").value.trim();
      const servico=$("#novoServico").value.trim(), url=$("#novoContratoUrl").value.trim(), file=$("#novoContratoFile").files[0];
      if(!cpf||!nome||!senha){ toast("CPF, Nome e Senha obrigatórios."); return; }
      if(state.db.clientes[cpf]){ toast("CPF já cadastrado."); return; }
      const u = { cpf, nome, senha, servico, contrato:{numero:"",status:"Ativo"}, parcelas:[], createdAt:Date.now() };
      if(url) u.contrato.pdf=url;
      if(file) u.contrato.data=await fileToDataURL(file);
      state.db.clientes[cpf]=u; saveDB(state.db);
      ["novoCPF","novoNome","novoSenha","novoServico","novoContratoUrl","novoContratoFile"].forEach(id=>{ const el=$("#"+id); if(el.type==="file") el.value=""; else el.value=""; });
      renderUsers(); toast("Cliente criado.");
    });
    on($("#tbUsers"),"click", e=>{
      const b=e.target.closest("button"); if(!b) return;
      const cpf=b.dataset.cpf, act=b.dataset.act, u=state.db.clientes[cpf]; if(!u) return;
      if(act==="ger"){ openEditor(u); }
      if(act==="as"){ $("#adminView").classList.add("hidden"); $("#clienteView").classList.remove("hidden"); $("#whoami").textContent = u.nome||cpf; state.role="cliente"; renderCliente(u); bindClienteUI(u); }
      if(act==="del"){ if(confirm("Excluir cliente?")){ delete state.db.clientes[cpf]; saveDB(state.db); renderUsers(); toast("Excluído."); } }
    });
    $$("#editorBox .tabs .tab").forEach(btn=>{
      on(btn,"click",()=>{
        btn.parentElement.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        const tab=btn.dataset.tab;
        ["ed-dados","ed-contrato","ed-parcelas"].forEach(id=> $("#tab-"+id).classList.toggle("hidden", id!==tab));
      });
    });
    on($("#btnSalvarDados"),"click",()=>{
      const u=state.selected; if(!u) return;
      u.nome=$("#edNomeIn").value.trim();
      const nova=$("#edSenhaIn").value.trim(); if(nova) u.senha=nova;
      u.servico=$("#edServicoIn").value.trim();
      saveDB(state.db); renderUsers(); toast("Dados salvos.");
    });
    on($("#btnSalvarContrato"),"click", async ()=>{
      const u=state.selected; if(!u) return;
      const url=$("#edContratoUrlIn").value.trim(), file=$("#edContratoFile").files[0];
      u.contrato=u.contrato||{numero:"",status:"Ativo"};
      if(url){ u.contrato.pdf=url; delete u.contrato.data; }
      if(file){ u.contrato.data=await fileToDataURL(file); u.contrato.pdf=""; }
      saveDB(state.db); renderUsers(); renderContratoAdmin(u); toast("Contrato salvo.");
    });
    on($("#btnAddParcela"),"click",()=>{
      const u=state.selected; if(!u) return;
      const venc=$("#parVenc").value, val=parseFloat($("#parVal").value||"0"), st=$("#parStatus").value;
      if(!venc||!val){ toast("Vencimento e valor obrigatórios."); return; }
      const nextId=(u.parcelas?.reduce((m,p)=>Math.max(m,p.id),0)||0)+1;
      u.parcelas=u.parcelas||[]; u.parcelas.push({id:nextId, vencimento:venc, valor:val, status:st});
      saveDB(state.db); renderParcelasAdmin(u); toast("Parcela adicionada.");
    });
    on($("#tbParcelas"),"click", e=>{
      const b=e.target.closest("button"); if(!b) return;
      const act=b.dataset.act, id=parseInt(b.dataset.id); const u=state.selected;
      const p=u.parcelas.find(x=>x.id===id); if(!p) return;
      if(act==="ok") p.status="pago";
      if(act==="ab") p.status="aberto";
      if(act==="ve") p.status="vencido";
      if(act==="rm") u.parcelas=u.parcelas.filter(x=>x.id!==id);
      saveDB(state.db); renderParcelasAdmin(u);
    });
  }
  function openEditor(u){
    state.selected=u;
    $("#editorBox").classList.remove("hidden");
    $("#edCpf").textContent=u.cpf; $("#edNome").textContent=u.nome||"";
    $("#edNomeIn").value=u.nome||""; $("#edSenhaIn").value=""; $("#edServicoIn").value=u.servico||"";
    renderContratoAdmin(u); renderParcelasAdmin(u);
  }
  function renderContratoAdmin(u){
    const href=u.contrato?.data||u.contrato?.pdf||"";
    const link=$("#edContratoLink");
    link.href = href || "#";
    link.classList.toggle("hidden", !href);
    $("#edContratoUrlIn").value = u.contrato?.pdf || "";
    $("#edContratoFile").value = "";
  }
  function renderParcelasAdmin(u){
    const tb=$("#tbParcelas"); tb.innerHTML="";
    for(const p of (u.parcelas||[])){
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${p.id}</td><td>${fmtDate(p.vencimento)}</td><td>${fmtBRL(p.valor)}</td>
        <td><span class="${badge(p.status)}">${p.status}</span></td>
        <td class="row gap">
          <button class="btn" data-act="ok" data-id="${p.id}">Pago</button>
          <button class="btn ghost" data-act="ab" data-id="${p.id}">Aberto</button>
          <button class="btn ghost" data-act="ve" data-id="${p.id}">Vencido</button>
          <button class="btn ghost danger" data-act="rm" data-id="${p.id}">Excluir</button>
        </td>`;
      tb.appendChild(tr);
    }
  }

  function renderCliente(u){
    $("#cliSaudacao").textContent = `Olá, ${u.nome||u.cpf} 👋`;
    $("#cContratoNumero").textContent = u.contrato?.numero || "—";
    $("#cContratoServico").textContent = u.servico || "—";
    $("#cContratoStatus").textContent = u.contrato?.status || "Ativo";

    const href = u.contrato?.data || u.contrato?.pdf || "";
    const openBtn = $("#btnAbrirAba"); openBtn.href = href || "#"; openBtn.classList.toggle("hidden", !href);

    const pdfObj = $("#pdfObject"); pdfObj.removeAttribute("data");
    $("#btnVerInApp").onclick = ()=>{
      if(!href){ toast("Sem PDF cadastrado."); return; }
      try{ pdfObj.setAttribute("data", href); }catch{ toast("Seu navegador não conseguiu embutir o PDF."); }
    };

    const tb=$("#cListaParcelas"); tb.innerHTML="";
    tb.onclick = null;
    for(const p of (u.parcelas||[])){
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${p.id}</td>
        <td>${fmtDate(p.vencimento)}</td>
        <td>${fmtBRL(p.valor)}</td>
        <td><span class="${badge(p.status)}">${p.status}</span></td>
        <td class="row gap">
          ${p.status==="aberto"?`<button class="btn" data-act="pagar" data-id="${p.id}">Pagar</button>`:""}
          <button class="btn ghost" data-act="comprovante" data-id="${p.id}">Comprovante</button>
        </td>`;
      tb.appendChild(tr);
    }
  }
  function bindClienteUI(u){
    const tb=$("#cListaParcelas");
    tb.onclick = (e)=>{
      const b=e.target.closest("button"); if(!b) return;
      const id=parseInt(b.dataset.id); const p=u.parcelas.find(x=>x.id===id); if(!p) return;
      if(b.dataset.act==="pagar") abrirPagamento(p);
      if(b.dataset.act==="comprovante") abrirComprovante(p);
    };
  }

  function abrirPagamento(parcela){
    const modal=$("#payModal");
    $("#payParcelaId").textContent=parcela.id;
    $("#payValor").textContent=parcela.valor.toFixed(2).replace(".",",");
    const cfg=window.APP_CONFIG.PIX;
    const payload = PIX.makePixPayload({ chave:cfg.chave, nome:cfg.nome, cidade:cfg.cidade, valor:parcela.valor, txid:"PARC"+parcela.id });
    $("#pixCode").textContent = payload;
    PIX.drawQR($("#qrCanvas"), payload);
    $("#btnCopy").onclick = async ()=>{ try{ await navigator.clipboard.writeText(payload); toast("Pix copiado!"); }catch{ toast("Copie manualmente."); } };
    $("#btnClose").onclick = ()=> modal.close();
    modal.showModal();
  }
  function abrirComprovante(parcela){
    const modal=$("#proofModalClient");
    $("#proofParcelaId").textContent=parcela.id;
    $("#btnSendProof").onclick = async ()=>{
      const f=$("#proofFile").files[0]; if(!f){ toast("Selecione um arquivo."); return; }
      const fr = new FileReader();
      fr.onload = ()=>{ try{ localStorage.setItem("proof_"+parcela.id, fr.result); toast("Comprovante salvo (local)."); modal.close(); }catch{ toast("Falha ao salvar (quota)."); } };
      fr.readAsDataURL(f);
    };
    modal.showModal();
  }

  function bindTabs(){
    $$("#clienteView .tabs .tab").forEach(btn=>{
      on(btn,"click",()=>{
        btn.parentElement.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        const t=btn.dataset.tab;
        $("#tab-c-contrato").classList.toggle("hidden", t!=="c-contrato");
        $("#tab-c-parcelas").classList.toggle("hidden", t!=="c-parcelas");
      });
    });
  }

  function init(){
    state.db = loadDB();
    $("#btnEntrar").onclick = doLogin;
    $("#btnLogout").onclick = doLogout;
    bindTabs();
  }
  init();
})();