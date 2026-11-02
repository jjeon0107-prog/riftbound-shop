(function installLegendPriceEditor(){
  "use strict";
  const slug="origins-legends-12";
  const openAfter=document.getElementById("openRandomManagerBtn");
  if(!openAfter || !document.getElementById("adminTop"))return;
  const launch=document.createElement("button");
  launch.type="button";
  launch.id="openLegendPriceBtn";
  launch.style.cssText="width:100%;min-height:42px;font-weight:900;grid-column:1/-1;background:#fffaf0;border-color:#e4c989;color:#725019";
  launch.textContent="🏆 전설 12종 풀세트 가격 조정";
  openAfter.insertAdjacentElement("afterend",launch);

  const modal=document.createElement("div");
  modal.id="legendPriceOverlay";
  modal.className="rb-overlay";
  modal.setAttribute("aria-hidden","true");
  modal.innerHTML=`
    <div class="rb-box" style="width:min(460px,100%)" role="dialog" aria-modal="true" aria-labelledby="legendPriceHeading">
      <div class="rb-bar">
        <b id="legendPriceHeading">🏆 전설 12종 풀세트 가격</b>
        <button type="button" id="legendPriceClose" style="padding:7px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff">닫기</button>
      </div>
      <div class="rb-main" style="display:block">
        <section class="rb-pane">
          <div id="legendPriceCurrent" style="font-size:14px;font-weight:900;margin-bottom:8px">현재 세트가 확인 중…</div>
          <div id="legendPriceReference" class="rb-note"></div>
          <label for="legendPriceInput">새 판매가격 (원)</label>
          <input id="legendPriceInput" type="number" min="1" step="100" inputmode="numeric" disabled>
          <p class="rb-note" style="line-height:1.65">한글판 오리진 FOIL 전설 12종 세트의 <b>판매가격만</b> 수정합니다. 카드별 가격·재고·판매수량·세트 구성·판매 한도는 변경하지 않습니다. 판매페이지는 새로고침하면 가격이 반영됩니다.</p>
          <button type="button" id="legendPriceSave" disabled style="width:100%;min-height:42px">변경 가격 저장</button>
          <div id="legendPriceStatus" class="rb-note" role="status" aria-live="polite" style="margin-top:10px">불러오는 중…</div>
        </section>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const input=modal.querySelector("#legendPriceInput");
  const save=modal.querySelector("#legendPriceSave");
  const current=modal.querySelector("#legendPriceCurrent");
  const reference=modal.querySelector("#legendPriceReference");
  const status=modal.querySelector("#legendPriceStatus");
  let storedPrice=null;
  let loading=false;
  const won=value=>"₩"+Number(value).toLocaleString("ko-KR");
  function setStatus(message,error=false){
    status.textContent=message;
    status.style.color=error?"#b91c1c":"#475569";
  }
  async function load(){
    if(loading)return;
    loading=true;
    storedPrice=null;
    input.disabled=true;
    save.disabled=true;
    setStatus("전설세트 가격 불러오는 중…");
    try{
      const {data,error}=await S.from("fixed_bundles")
        .select("slug,name_ko,price,active,launch_limit,updated_at")
        .eq("slug",slug).maybeSingle();
      if(error)throw error;
      if(!data)throw Error("전설세트 상품을 찾지 못했거나 조회 권한이 없습니다.");
      storedPrice=Number(data.price);
      if(!Number.isSafeInteger(storedPrice)||storedPrice<0)throw Error("저장된 가격이 올바르지 않습니다.");
      current.textContent=`${data.name_ko || "오리진 전설 12종 풀세트"} · 현재 ${won(storedPrice)}`;
      input.value=String(storedPrice);
      input.disabled=false;
      save.disabled=false;
      setStatus(`현재 판매가 ${won(storedPrice)} · ${data.active?"판매페이지 노출 중":"판매페이지 숨김"} · 판매 한도 ${Number(data.launch_limit||0)}세트`);
      const {data:offer}=await S.rpc("public_fixed_bundle_offer",{p_slug:slug});
      if(offer && Number.isFinite(Number(offer.reference_price))){
        reference.textContent=`구성 카드 12종의 현재 개별 판매가 합계 ${won(offer.reference_price)} · 참고용`;
      }else reference.textContent="";
    }catch(error){
      current.textContent="가격을 불러오지 못했습니다";
      reference.textContent="";
      setStatus("조회 실패: "+(error?.message||String(error)),true);
    }finally{loading=false;}
  }
  function close(){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");
    launch.focus();
  }
  launch.addEventListener("click",()=>{
    modal.classList.add("show");
    modal.setAttribute("aria-hidden","false");
    void load();
    modal.querySelector("#legendPriceClose").focus();
  });
  modal.querySelector("#legendPriceClose").addEventListener("click",close);
  modal.addEventListener("click",event=>{if(event.target===modal)close()});
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && modal.classList.contains("show"))close();
  });
  save.addEventListener("click",async()=>{
    const next=Number(input.value);
    if(!Number.isSafeInteger(next)||next<1||next>1000000000){
      setStatus("1원 이상, 10억 원 이하의 정수 가격을 입력해 주세요.",true);
      return;
    }
    if(storedPrice===null || loading)return;
    if(next===storedPrice){setStatus("현재 저장된 가격과 같습니다.");return;}
    const previous=storedPrice;
    const confirmed=await askAction({
      title:"전설세트 판매가격 변경",
      message:`전설 12종 세트 가격을 ${won(previous)} → ${won(next)}으로 변경할까요?\n개별 카드 가격과 재고는 그대로입니다.`,
      okText:"가격 변경 저장"
    });
    if(!confirmed)return;
    save.disabled=true;
    input.disabled=true;
    setStatus("판매가격 저장 중…");
    try{
      const {data,error}=await S.from("fixed_bundles")
        .update({price:next,updated_at:new Date().toISOString()})
        .eq("slug",slug).eq("price",previous)
        .select("price,updated_at").maybeSingle();
      if(error)throw error;
      if(!data)throw Error("다른 곳에서 가격이 먼저 변경되었거나 저장 권한이 없습니다. 가격을 다시 불러와 주세요.");
      storedPrice=Number(data.price);
      input.value=String(storedPrice);
      current.textContent=`오리진 전설 12종 풀세트 · 현재 ${won(storedPrice)}`;
      setStatus(`저장 완료! 새 판매가 ${won(storedPrice)} · 판매페이지 새로고침 후 반영됩니다.`);
    }catch(error){
      setStatus("저장 실패: "+(error?.message||String(error)),true);
    }finally{
      input.disabled=false;
      save.disabled=false;
    }
  });
})();
