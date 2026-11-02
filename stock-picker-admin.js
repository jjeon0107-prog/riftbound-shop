(function installStockPickerAdminLink(){
  "use strict";
  const anchor=document.getElementById("cuStockCheckBtn");
  if(!anchor||document.getElementById("openStockPickerBtn"))return;
  const link=document.createElement("a");
  link.id="openStockPickerBtn";
  link.href="stock-picker.html";
  link.target="_blank";
  link.rel="noopener";
  link.textContent="🖼️ 일반카드 재고 사진 정리 · 새 탭 열기 ↗";
  link.style.cssText="display:flex;align-items:center;justify-content:center;width:100%;min-height:45px;margin-top:7px;padding:9px 12px;border:1px solid #93b4fa;border-radius:8px;background:#e8f0ff;color:#173d83;font-weight:900;font-size:13px;text-decoration:none;text-align:center;box-sizing:border-box";
  anchor.insertAdjacentElement("afterend",link);
})();