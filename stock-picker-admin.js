(function installStockPickerAdmin(){
  "use strict";
  const anchor=document.getElementById("cuStockCheckBtn");
  if(!anchor || !document.getElementById("managePanel"))return;
  const opener=document.createElement("button");
  opener.id="openStockPickerBtn";
  opener.type="button";
  opener.textContent="🖼️ 기준 장수 이하 일반카드 사진 정리";
  opener.style.cssText="width:100%;min-height:42px;margin-top:7px;font-weight:900;background:#e8f0ff;border-color:#93b4fa;color:#173d83";
  anchor.insertAdjacentElement("afterend",opener);

  const overlay=document.createElement("div");
  overlay.id="stockPickerOverlay";
  overlay.className="stock-pick-overlay";
  overlay.setAttribute("aria-hidden","true");
  overlay.innerHTML=`
    <div class="stock-pick-sheet" role="dialog" aria-modal="true" aria-labelledby="stockPickerTitle">
      <div class="stock-pick-head">
        <div><h2 id="stockPickerTitle">🖼️ 일반카드 부족 재고 · 이미지 피킹 목록</h2>
          <div class="hint">오리진 C/U · NORMAL · 일반 일러스트만 · 카드 번호순. 사진을 누르면 실물 정리 완료로 체크돼요.</div></div>
        <button class="stock-pick-close" id="stockPickerClose" type="button">닫기</button>
      </div>
      <div class="stock-pick-toolbar">
        <label>기준 장수 이하 <input id="stockPickerLimit" type="number" min="0" max="999" step="1" value="5"></label>
        <label>수량 기준
          <select id="stockPickerBasis">
            <option value="sale">판매가능 (보관 1장 제외)</option>
            <option value="total">전체 보유수량</option>
          </select>
        </label>
        <label>번호·이름 검색 <input id="stockPickerSearch" type="search" placeholder="카드번호 / 카드명"></label>
        <label class="inline-check"><input id="stockPickerRemaining" type="checkbox"> 미정리만 보기</label>
        <button id="stockPickerReset" class="stock-pick-reset" type="button">체크 초기화</button>
      </div>
      <div id="stockPickerSummary" class="stock-pick-summary" aria-live="polite">목록 준비 중…</div>
      <div id="stockPickerGrid" class="stock-pick-grid"></div>
      <div class="stock-pick-foot">사진 체크는 이 브라우저 탭의 정리 진행 표시입니다. <b>재고 수량이나 판매가는 변경되지 않습니다.</b> 재고 추가는 기존 관리자 수량 입력에서 반영해 주세요.</div>
    </div>`;
  document.body.appendChild(overlay);
  const limit=overlay.querySelector("#stockPickerLimit");
  const basis=overlay.querySelector("#stockPickerBasis");
  const search=overlay.querySelector("#stockPickerSearch");
  const remaining=overlay.querySelector("#stockPickerRemaining");
  const summary=overlay.querySelector("#stockPickerSummary");
  const grid=overlay.querySelector("#stockPickerGrid");
  const key="riftbound_stock_picker_checked_v1";
  let done=new Set();
  try{
    const saved=JSON.parse(sessionStorage.getItem(key)||"[]");
    if(Array.isArray(saved))done=new Set(saved.map(String));
    const stored=Number(localStorage.getItem("riftbound_stock_picker_limit"));
    if(Number.isSafeInteger(stored)&&stored>=0&&stored<=999)limit.value=String(stored);
    basis.value=localStorage.getItem("riftbound_stock_picker_basis")==="total"?"total":"sale";
  }catch{}
  const persist=()=>{try{sessionStorage.setItem(key,JSON.stringify([...done]));}catch{}};
  const maxLimit=()=>Math.min(999,Math.max(0,Math.trunc(Number(limit.value)||0)));
  const countOf=c=>basis.value==="total"
    ?Math.max(0,Number(c.total_qty||0))
    :saleQty(c);
  function matched(){
    const threshold=maxLimit();
    const q=search.value.trim().toLocaleLowerCase("ko-KR");
    const pool=(typeof cards==="undefined" ? [] : cards).filter(c=>{
      if(!isCU(c) || String(c.finish||"").toUpperCase()!=="NORMAL")return false;
      const variant=String(c.variant||"Standard").trim().toLowerCase();
      if(variant!=="standard" || Boolean(c.stock_many))return false;
      if(countOf(c)>threshold)return false;
      return !q || `${c.code||""} ${c.card_no||""} ${c.name_ko||""}`.toLocaleLowerCase("ko-KR").includes(q);
    });
    pool.sort((a,b)=>String(a.card_no||a.code).localeCompare(String(b.card_no||b.code),"en",{numeric:true,sensitivity:"base"}));
    return pool;
  }
  function renderPicker(){
    const matchedCards=matched();
    const checked=matchedCards.filter(c=>done.has(String(c.code))).length;
    const visible=remaining.checked?matchedCards.filter(c=>!done.has(String(c.code))):matchedCards;
    const threshold=maxLimit();
    const basisLabel=basis.value==="sale"?"판매가능":"전체 보유";
    summary.textContent=`${basisLabel} ${threshold}장 이하: ${matchedCards.length}종 · 정리 체크 ${checked}종 · 남은 카드 ${matchedCards.length-checked}종 · 현재 표시 ${visible.length}종`;
    if(!visible.length){
      grid.innerHTML=`<div class="stock-pick-empty">${matchedCards.length?"모두 정리 체크됐어요! ✅":"조건에 해당하는 NORMAL 일반카드가 없습니다."}<br>기준 장수나 수량 기준을 변경해 보세요.</div>`;
      return;
    }
    grid.innerHTML=visible.map(c=>{
      const urls=imgs(c);
      const code=String(c.code||"");
      const checked=done.has(code);
      const available=saleQty(c);
      const held=Math.max(0,Number(c.total_qty||0));
      const qty=countOf(c);
      const image=urls.length?`<img class="stock-pick-img" src="${esc(urls[0])}" data-f='${esc(JSON.stringify(urls.slice(1)))}' alt="${esc(c.name_ko||c.card_no||"카드")}" loading="lazy" onerror="ni(this)">`:'<div class="stock-pick-no-image">이미지 없음</div>';
      return `<button type="button" class="stock-pick-card${checked?" done":""}" data-stock-code="${esc(code)}" aria-pressed="${checked}">
        <div class="stock-pick-img-wrap">${image}
          <span class="stock-pick-number">${esc(c.card_no||code)}</span>
          ${checked?'<span class="stock-pick-done-mark">✓ 찾음</span>':""}
        </div>
        <div class="stock-pick-body">
          <div class="stock-pick-name">${esc(c.name_ko||"")}</div>
          <div class="stock-pick-meta">${esc(c.rarity||"")} · NORMAL</div>
          <div class="stock-pick-stock">전체 <b>${held}</b>장 · 판매가능 <b>${available}</b>장<br>현재 기준 <b>${qty}</b>장</div>
          <span class="stock-pick-action">${checked?"✓ 정리 완료 · 다시 누르면 해제":"찾았으면 터치해서 체크"}</span>
        </div>
      </button>`;
    }).join("");
  }
  function close(){
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
    opener.focus();
  }
  opener.addEventListener("click",()=>{
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden","false");
    renderPicker();
    overlay.querySelector("#stockPickerClose").focus();
  });
  overlay.querySelector("#stockPickerClose").addEventListener("click",close);
  overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&overlay.classList.contains("show"))close()});
  grid.addEventListener("click",e=>{
    const item=e.target.closest(".stock-pick-card");
    if(!item)return;
    const code=item.dataset.stockCode;
    if(done.has(code))done.delete(code);else done.add(code);
    persist();
    const scroll=grid.scrollTop;
    renderPicker();
    grid.scrollTop=scroll;
  });
  limit.addEventListener("input",()=>{
    const n=maxLimit();
    try{localStorage.setItem("riftbound_stock_picker_limit",String(n));}catch{}
    renderPicker();
  });
  basis.addEventListener("change",()=>{
    try{localStorage.setItem("riftbound_stock_picker_basis",basis.value)}catch{}
    renderPicker();
  });
  search.addEventListener("input",renderPicker);
  remaining.addEventListener("change",renderPicker);
  overlay.querySelector("#stockPickerReset").addEventListener("click",()=>{
    matched().forEach(c=>done.delete(String(c.code)));
    persist();
    renderPicker();
  });
})();
