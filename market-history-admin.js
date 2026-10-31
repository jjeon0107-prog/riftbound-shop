(function installAdminMarketHistory() {
  "use strict";
  const HISTORY_URL = "market-data/ogn-era-peaks.json?v=20261030-1";
  const LATEST_URL = "market-data/ogn-tcgplayer-latest.json?v=20261030-1";
  const ERA_NAMES = ["OGN", "SFD", "UNL", "VEN"];
  const ERA_KO = ["오리진", "스피릿포지드", "언리시드", "벤데타"];
  const album = document.getElementById("cards");
  const listing = document.getElementById("listBody");
  if (!album || !listing) return;
  let history = null;
  let latest = null;
  let overlay = null;
  let queued = false;

  const html = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const formatUSD = n => "$" + Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const readFX = () => Math.max(1, Number(document.getElementById("fx")?.value) || 1328);
  const formatKRW = n => "₩" + Math.round(Number(n) * readFX()).toLocaleString("ko-KR");
  const dateOf = epochDay => Number.isFinite(Number(epochDay))
    ? new Date(Number(epochDay) * 86400000).toISOString().slice(0, 10) : "—";
  const keyOf = code => String(code || "").trim().toUpperCase();
  const dataOf = code => {
    const key = keyOf(code);
    const peaks = history?.cards?.[key] || null;
    const current = latest?.entries?.[key]?.usd;
    if (!peaks && !(Number.isFinite(current) && current >= 0)) return null;
    return {key, peaks, current: Number.isFinite(current) ? current : null};
  };
  // Reject a lone implausible historic source spike, while keeping genuine
  // multi-era high-value Signature cards (often over $1,000).
  const invalidPeak = (rows, i) => {
    if (!rows || !rows[i]) return false;
    const peak = Number(rows[i][0]) || 0;
    const other = Math.max(1, ...rows.map((row, j) => i === j ? 0 : Number(row?.[0]) || 0));
    return peak > 100 && peak > 30 * other;
  };
  const warningFor = (card, data) =>
    card && data.current !== null && data.current >= 3 &&
    Number(card.sell_price) > 0 &&
    Number(card.sell_price) < data.current * readFX() * 0.3;

  function priceBlock(card, data) {
    const peaks = data.peaks || [];
    const chips = peaks.length ? ERA_NAMES.map((era, i) => {
      const row = peaks[i];
      const partial = era === "VEN";
      const invalid = invalidPeak(peaks, i);
      const label = partial ? era + "*" : era;
      const display = !row ? "—" : invalid ? "확인 필요" : formatUSD(row[0]);
      return `<span class="market-pill${partial ? " partial" : ""}" title="${html(ERA_KO[i])}${partial ? " · 2026-09-15까지 부분 집계" : ""}">${label} <strong>${display}</strong></span>`;
    }).join("") : "";
    const current = data.current === null ? "" :
      `<div class="market-current-us">TCGplayer 현재 ${formatUSD(data.current)} · ${formatKRW(data.current)}</div>`;
    const warning = warningFor(card, data) ?
      '<span class="market-price-warning">⚠ 국내 판매가와 북미 시세 차이 큼 · 확인 권장</span>' : "";
    return `<div class="market-history-block">${current}${chips ? `<div class="market-brief">${chips}</div>` : ""}${warning}<button type="button" class="market-detail-btn" data-market-code="${html(data.key)}">시기별 북미가 상세</button></div>`;
  }

  function decorate() {
    queued = false;
    if (!history && !latest) return;
    album.querySelectorAll("article.card[data-code]").forEach(node => {
      const price = node.querySelector(".body .price");
      if (!price || node.querySelector(".market-history-block")) return;
      const data = dataOf(node.dataset.code);
      if (!data) return;
      const card = typeof cards !== "undefined" ? cards.find(x => keyOf(x.code) === data.key) : null;
      price.insertAdjacentHTML("afterend", priceBlock(card, data));
      const old = price.querySelector(".tiny");
      if (old) old.title = "기존 데이터베이스에 저장된 북미 참고값입니다. 아래 TCGplayer 시세와 별개입니다.";
    });
    listing.querySelectorAll("tr[data-code]").forEach(row => {
      const cell = row.cells[10];
      if (!cell || cell.querySelector(".market-history-block")) return;
      const data = dataOf(row.dataset.code);
      if (!data) return;
      const card = typeof cards !== "undefined" ? cards.find(x => keyOf(x.code) === data.key) : null;
      cell.classList.add("market-list-markers");
      cell.title = "기존 저장된 북미가 / 아래는 TCGplayer 시세";
      cell.insertAdjacentHTML("beforeend", priceBlock(card, data));
    });
  }

  function scheduleDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(decorate);
  }
  new MutationObserver(scheduleDecorate).observe(album, {childList: true});
  new MutationObserver(scheduleDecorate).observe(listing, {childList: true});

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "market-info-overlay";
    overlay.id = "marketHistoryOverlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `<div class="market-info-card" role="dialog" aria-modal="true" aria-labelledby="marketHistoryTitle">
      <div class="market-info-title"><div><b id="marketHistoryTitle">북미 가격 기록</b><div class="sub" id="marketHistorySubtitle"></div></div>
      <button type="button" data-market-close>닫기</button></div><div id="marketHistoryContent"></div></div>`;
    overlay.addEventListener("click", event => {
      if (event.target === overlay || event.target.closest("[data-market-close]")) closeOverlay();
    });
    document.body.appendChild(overlay);
    return overlay;
  }
  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }
  function openDetails(code) {
    const data = dataOf(code);
    if (!data) return;
    const c = typeof cards !== "undefined" ? cards.find(x => keyOf(x.code) === data.key) : null;
    const el = ensureOverlay();
    const title = c ? `${c.name_ko || ""} · ${c.card_no || data.key}` : data.key;
    el.querySelector("#marketHistoryTitle").textContent = title;
    el.querySelector("#marketHistorySubtitle").textContent = `${data.key} · ${c?.finish || ""} · 1 USD = ${readFX().toLocaleString("ko-KR")}원`;
    let body = data.current === null ? "" :
      `<p><b>북미 현재가: ${formatUSD(data.current)} (${formatKRW(data.current)})</b><br>
      <span class="market-info-foot">TCGplayer Market · ${html(String(latest?.fetchedAt || "").slice(0, 10))} 수집</span></p>`;
    if (data.peaks) {
      const rows = ERA_NAMES.map((era, i) => {
        const row = data.peaks[i];
        const partial = era === "VEN" ? "*" : "";
        const name = `${ERA_KO[i]} (${era}${partial})`;
        if (!row) return `<tr><td>${name}</td><td colspan="4">기록 없음</td></tr>`;
        if (invalidPeak(data.peaks, i)) return `<tr><td>${name}</td><td colspan="4">출처의 비정상적인 가격 기록으로 제외</td></tr>`;
        return `<tr><td>${name}</td><td><b>${formatUSD(row[0])}</b></td><td>${formatKRW(row[0])}</td><td>${dateOf(row[1])}</td><td>${formatUSD(row[2])}<br><span class="sub">${dateOf(row[3])} · ${row[4]}회 기록</span></td></tr>`;
      }).join("");
      body += `<table class="market-info-table"><thead><tr><th>시기</th><th>기간 최고</th><th>최고가 원환산</th><th>최고가 날짜</th><th>기간 마지막 기록</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    body += `<div class="market-info-foot">
      <b>참고:</b> 과거 가격은 rarebox-price-history의 TCGplayer Market 관측치 중 <b>확인된 최고값</b>입니다. 실거래·판매 보장 가격이 아닙니다.<br>
      <b>VEN*</b>은 2026-07-31~${html(history?.sourceLastDate || "2026-09-15")}까지만 집계되었습니다. 이후 가격은 최고가 계산에 포함되지 않습니다.<br>
      원화는 관리자 상단의 환율 입력값으로 환산합니다. 국내 판매가 및 재고는 변경되지 않습니다.
    </div>`;
    el.querySelector("#marketHistoryContent").innerHTML = body;
    el.classList.add("show");
    el.setAttribute("aria-hidden", "false");
    el.querySelector("[data-market-close]").focus();
  }
  document.addEventListener("click", event => {
    const btn = event.target.closest?.(".market-detail-btn");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    openDetails(btn.dataset.marketCode);
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay?.classList.contains("show")) closeOverlay();
  });

  const info = document.createElement("div");
  info.className = "controls-section sub";
  info.style.lineHeight = "1.6";
  info.textContent = "🇺🇸 북미 시세 불러오는 중…";
  document.getElementById("managePanel")?.appendChild(info);
  Promise.allSettled([
    fetch(HISTORY_URL, {cache: "no-store"}).then(r => {
      if (!r.ok) throw Error("history " + r.status);
      return r.json();
    }),
    fetch(LATEST_URL, {cache: "no-store"}).then(r => {
      if (!r.ok) throw Error("latest " + r.status);
      return r.json();
    })
  ]).then(results => {
    if (results[0].status === "fulfilled") history = results[0].value;
    if (results[1].status === "fulfilled") latest = results[1].value;
    if (history || latest) {
      info.textContent = `🇺🇸 북미 참고가: TCGplayer 현재 ${String(latest?.fetchedAt || "").slice(0, 10) || "미수집"} / 확장팩 시기별 최고가 ${history?.sourceLastDate || "미수집"}까지 (VEN 부분 집계). 카드별 ‘상세’에서 날짜를 확인하세요.`;
      scheduleDecorate();
    } else {
      info.textContent = "⚠ 북미 참고가를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.";
    }
  });
})();
