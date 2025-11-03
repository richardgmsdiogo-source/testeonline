(function(){
  function pad2(n){ return (n<10?'0':'')+n; }
  function tlv(id, value){ const v=String(value||""); return id+pad2(v.length)+v; }
  function crc16(payload){
    let crc=0xFFFF;
    for(let i=0;i<payload.length;i++){
      crc ^= payload.charCodeAt(i)<<8;
      for(let j=0;j<8;j++){ crc = (crc & 0x8000) ? ((crc<<1)^0x1021) : (crc<<1); crc &= 0xFFFF; }
    }
    return (crc>>>8).toString(16).padStart(2,'0') + (crc&0xFF).toString(16).padStart(2,'0');
  }
  function makePixPayload({chave,nome,cidade,valor,txid}){
    const mai = tlv("26", tlv("00","br.gov.bcb.pix")+tlv("01",chave)+tlv("02",txid||"PORTAL"));
    let p = tlv("00","01")+mai+tlv("52","0000")+tlv("53","986")+(valor?tlv("54",valor.toFixed(2)):"")+tlv("58","BR")+tlv("59",nome)+tlv("60",cidade)+tlv("62",tlv("05","SITE"));
    const crc = crc16(p+"63"+"04").toUpperCase();
    return p+tlv("63",crc);
  }
  function drawQR(canvas, text){
    const url = "https://chart.googleapis.com/chart?chs=256x256&cht=qr&chl="+encodeURIComponent(text);
    const ctx = canvas.getContext("2d");
    const img = new Image(); img.crossOrigin="anonymous";
    img.onload=()=>{canvas.width=256;canvas.height=256;ctx.drawImage(img,0,0,256,256);};
    img.src = url;
  }
  window.PIX = { makePixPayload, drawQR };
})();