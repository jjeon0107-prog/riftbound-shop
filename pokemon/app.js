(function(){
  "use strict";
  var admin=document.body.dataset.mode==="admin";
  var $=function(id){return document.getElementById(id)};
  var esc=function(v){return String(v==null?"":v).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})};
  var won=function(v){return "₩"+Math.max(0,Number(v)||0).toLocaleString("ko-KR")};
  var cfg=window.RIFTBOUND_CONFIG;
  var db=window.supabase&&cfg?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
  var sets=[],catalog=[],byKey=new Map(),inventory=new Map(),matched=[],displayed=0,cart=new Map(),timers=new Map(),chains=new Map();
  var grid=$("cardGrid");
  function stock(c){return inventory.get(c.key)||{card_key:c.key,total_qty:0,binder_qty:0,price_krw:0,sell_enabled:false,stock_verified:false,legacy_import:false,language:"KO",condition:"NM",graded_by:"",grade:"",image_override:""}}
  function free(r){return Math.max(0,Number(r.total_qty||0)-Number(r.binder_qty||0))}
  function listed(r){return !!(r&&r.sell_enabled&&r.stock_verified&&Number(r.price_krw)>0&&free(r)>0)}
  function photoUrl(c,r){
    var type=c.setCode.toUpperCase().indexOf("SV")===0?"SV":"MEGA";
    var file=type+"~"+c.setCode+"~"+c.setCode+"_"+String(c.no).padStart(3,"0")+".png";
    var base="https://pavilion-tcg.com/api/images/card/pkko/400/"+file+"?v=4";
    return {src:r.image_override||c.image||base,fallback:base};
  }
  function photo(c,r,i){
    var u=photoUrl(c,r);
    return '<div class="photo"><img src="'+esc(u.src)+'" data-fallback="'+esc(u.fallback)+'" alt="'+esc(c.name)+' 카드" loading="'+(i<12?"eager":"lazy")+'" decoding="async"><span class="number">'+esc(c.key)+'</span>'+(listed(r)?'<span class="sale-tag">판매중</span>':"")+'</div>';
  }
  async function loadCatalog(){
    var res=await fetch("sets.json",{cache:"no-cache"});
    if(!res.ok)throw Error("세트 목록 불러오기 실패");
    sets=await res.json();
    var groups=await Promise.all(sets.map(async function(s){
      var r=await fetch("data/"+encodeURIComponent(s.code)+".json");
      if(!r.ok)throw Error(s.name+" 카드 목록 불러오기 실패");
      return (await r.json()).map(function(c){return Object.assign({},c,{setCode:s.code,setName:s.name,source:s.source})});
    }));
    catalog=groups.flat();byKey=new Map(catalog.map(function(c){return [c.key,c]}));
    $("setFilter").insertAdjacentHTML("beforeend",sets.map(function(s){return '<option value="'+esc(s.code)+'">'+esc(s.name)+" ("+s.count+")</option>"}).join(""));
    var rarity=[...new Set(catalog.map(function(c){return c.rarity}).filter(Boolean))].sort(function(a,b){return a.localeCompare(b,"ko",{numeric:true})});
    $("rarityFilter").insertAdjacentHTML("beforeend",rarity.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>'}).join(""));
  }
  async function loadStock(){
    var all=[];
    for(var start=0;start<10000;start+=500){
      var result=await db.from("pokemon_inventory").select("*").order("card_key",{ascending:true}).range(start,start+499);
      if(result.error)throw result.error;
      all.push.apply(all,result.data||[]);
      if(!result.data||result.data.length<500)break;
    }
    inventory=new Map(all.map(function(r){return [r.card_key,r]}));
  }
  function filter(){
    var s=$("setFilter").value,rar=$("rarityFilter").value,q=$("searchInput").value.trim().toLowerCase(),mode=admin?$("adminFilter").value:"";
    return catalog.filter(function(c){
      var r=stock(c);
      if(s&&c.setCode!==s)return false;
      if(rar&&c.rarity!==rar)return false;
      if(q&&(c.key+" "+c.name+" "+c.setName).toLowerCase().indexOf(q)<0)return false;
      if(!admin&&$("saleOnly").checked&&!listed(r))return false;
      if(mode==="owned"&&!(r.total_qty>0))return false;
      if(mode==="missing"&&r.total_qty>0)return false;
      if(mode==="unverified"&&r.stock_verified)return false;
      if(mode==="selling"&&!listed(r))return false;
      return true;
    });
  }
  function shopHtml(c,i){
    var r=stock(c),sell=listed(r);
    return '<article class="card '+(sell?"is-selling":"unavailable")+'" data-key="'+esc(c.key)+'">'+photo(c,r,i)+
      '<div class="card-body"><b class="card-name">'+esc(c.name)+'</b><span class="card-meta">'+esc(c.setName)+" · "+esc(c.rarity)+" · "+esc(r.language||"KO")+'</span><div class="card-bottom">'+
      (sell?'<div class="price">'+won(r.price_krw)+'</div><div class="qty-note">판매가능 '+free(r)+"장 · "+esc(r.condition||"NM")+'</div>':'<div class="qty-note">현재 판매 등록되지 않은 카드</div>')+
      '<button class="primary" type="button" data-action="add" '+(sell?"":"disabled")+">"+(sell?"구매목록 담기":"판매 준비중")+'</button></div></div></article>';
  }
  function adminHtml(c,i){
    var r=stock(c),n=Number(r.total_qty)||0,verified=!!r.stock_verified;
    var opt=function(value){return '<option value="'+value+'" '+(r.condition===value?"selected":"")+">"+value+"</option>"};
    return '<article class="card admin-card '+(listed(r)?"is-selling ":"")+(verified?"":"unverified")+'" data-key="'+esc(c.key)+'">'+photo(c,r,i)+
      '<div class="card-body"><b class="card-name">'+esc(c.name)+'</b><span class="card-meta">'+esc(c.setName)+" · "+esc(c.rarity)+(r.legacy_import?" · 기존자료":"")+'</span>'+
      '<div class="stock-row"><button type="button" data-action="minus" aria-label="보유 1장 감소">−</button><span>보유 <strong class="stock-number">'+n+'</strong>장</span><button type="button" data-action="plus" aria-label="보유 1장 증가">+</button></div>'+
      '<div class="state-row"><label><input type="checkbox" data-field="binder_qty" '+(r.binder_qty?"checked":"")+(n?"":" disabled")+'>보관 1장</label><span class="available">판매가능 '+free(r)+'장</span></div>'+
      '<label class="price-row">판매가 <input type="number" data-field="price_krw" min="0" step="100" inputmode="numeric" value="'+(Number(r.price_krw)||0)+'">원</label>'+
      '<div class="checkline"><label><input type="checkbox" data-field="stock_verified" '+(verified?"checked":"")+'>수량 확인</label><label><input type="checkbox" data-field="sell_enabled" '+(r.sell_enabled?"checked":"")+'>판매 공개</label></div>'+
      '<details><summary>상태 · 언어 · 등급 · 이미지 수정</summary><div class="extra-fields"><label>언어<select data-field="language"><option value="KO" '+(r.language==="KO"?"selected":"")+'>한글판</option><option value="JA" '+(r.language==="JA"?"selected":"")+'>일본판</option></select></label>'+
      '<label>상태<select data-field="condition">'+["NM","LP","MP","HP"].map(opt).join("")+'</select></label>'+
      '<label>등급사<input data-field="graded_by" value="'+esc(r.graded_by||"")+'" placeholder="PSA / BRG"></label><label>등급<input data-field="grade" value="'+esc(r.grade||"")+'" placeholder="10 / 9"></label>'+
      '<label class="wide">사진 주소 교체<input data-field="image_override" value="'+esc(r.image_override||"")+'" placeholder="https://..."></label></div></details></div></article>';
  }
  function summary(){
    var held=catalog.filter(function(c){return stock(c).total_qty>0}).length;
    var sales=catalog.filter(function(c){return listed(stock(c))}).length;
    $("summary").innerHTML=admin?"전체 "+catalog.length.toLocaleString()+"종<br>보유 참고 "+held.toLocaleString()+"종<br>판매 공개 "+sales+"종":"도감 "+catalog.length.toLocaleString()+"종<br>판매중 "+sales+"종";
  }
  function append(){
    if(displayed>=matched.length)return;
    var chunk=matched.slice(displayed,displayed+60);
    grid.insertAdjacentHTML("beforeend",chunk.map(function(c,i){return admin?adminHtml(c,displayed+i):shopHtml(c,displayed+i)}).join(""));
    displayed+=chunk.length;
  }
  function refreshList(){
    matched=filter();displayed=0;grid.innerHTML="";
    $("resultCount").textContent=matched.length.toLocaleString()+"종";
    $("status").hidden=matched.length>0;
    if(!matched.length)$("status").textContent=admin?"조건에 맞는 카드가 없습니다.":"아직 판매 등록된 카드가 없어요. '판매중만 보기'를 해제하면 전체 도감을 볼 수 있습니다.";
    append();
  }
  function wireCommon(){
    ["setFilter","rarityFilter","searchInput",admin?"adminFilter":"saleOnly"].forEach(function(id){
      $(id).addEventListener(id==="searchInput"?"input":"change",refreshList);
    });
    window.addEventListener("scroll",function(){if(matched.length&&window.scrollY+window.innerHeight>document.documentElement.scrollHeight-700)append()},{passive:true});
    grid.addEventListener("error",function(e){
      var img=e.target;if(!img.matches||!img.matches(".photo img"))return;
      var fallback=img.dataset.fallback;
      if(fallback&&img.src!==fallback){img.dataset.fallback="";img.src=fallback;return;}
      var div=document.createElement("div");div.className="photo-fallback";div.textContent="🃏 사진 확인 중";img.replaceWith(div);
    },true);
  }
  function saveStatus(text){if($("saveStatus"))$("saveStatus").textContent=text}
  function queueSave(c){
    clearTimeout(timers.get(c.key));saveStatus("저장 대기…");
    timers.set(c.key,setTimeout(function(){
      timers.delete(c.key);
      var r=stock(c),payload={card_key:c.key,total_qty:r.total_qty,binder_qty:r.binder_qty,price_krw:r.price_krw,sell_enabled:r.sell_enabled,stock_verified:r.stock_verified,legacy_import:r.legacy_import,language:r.language,condition:r.condition,graded_by:r.graded_by,grade:r.grade,image_override:r.image_override,updated_at:new Date().toISOString()};
      var previous=chains.get(c.key)||Promise.resolve();
      var next=previous.catch(function(){}).then(async function(){
        saveStatus("저장 중…");
        var result=await db.from("pokemon_inventory").upsert(payload,{onConflict:"card_key"});
        if(result.error)throw result.error;
        saveStatus("자동 저장 완료 ✓");
      }).catch(function(err){saveStatus("저장 실패: "+err.message);console.error("Pokemon save",err)});
      chains.set(c.key,next);
    },400));
  }
  function paint(item,c){
    var r=stock(c);
    item.querySelector(".stock-number").textContent=r.total_qty;
    item.querySelector(".available").textContent="판매가능 "+free(r)+"장";
    var binder=item.querySelector('[data-field="binder_qty"]');binder.checked=!!r.binder_qty;binder.disabled=r.total_qty===0;
    item.querySelector('[data-field="stock_verified"]').checked=!!r.stock_verified;
    item.querySelector('[data-field="sell_enabled"]').checked=!!r.sell_enabled;
    item.classList.toggle("unverified",!r.stock_verified);
    item.classList.toggle("is-selling",listed(r));
    var tag=item.querySelector(".sale-tag");
    if(tag&&!listed(r))tag.remove();
    if(!tag&&listed(r)){var b=document.createElement("span");b.className="sale-tag";b.textContent="판매중";item.querySelector(".photo").appendChild(b)}
  }
  function modify(item,c,change){
    var r=Object.assign({},stock(c));change(r);
    r.total_qty=Math.max(0,Math.trunc(Number(r.total_qty)||0));
    r.binder_qty=Math.max(0,Math.min(r.total_qty,Math.trunc(Number(r.binder_qty)||0)));
    r.price_krw=Math.max(0,Math.trunc(Number(r.price_krw)||0));
    if(!r.stock_verified||!r.price_krw||free(r)===0)r.sell_enabled=false;
    inventory.set(c.key,r);paint(item,c);summary();queueSave(c);
  }
  function wireAdmin(){
    $("loginBtn").addEventListener("click",async function(){
      var email=$("loginEmail").value.trim(),password=$("loginPassword").value;
      if(!email||!password){$("loginMessage").textContent="이메일과 비밀번호를 입력해 주세요.";return}
      $("loginMessage").textContent="로그인 중…";
      var r=await db.auth.signInWithPassword({email:email,password:password});
      if(r.error){$("loginMessage").textContent=r.error.message;return}
      $("loginPassword").value="";await showAdmin();
    });
    grid.addEventListener("click",function(e){
      var btn=e.target.closest("button[data-action]");if(!btn)return;
      var item=btn.closest("[data-key]"),c=byKey.get(item&&item.dataset.key);if(!c)return;
      if(btn.dataset.action==="minus"&&stock(c).total_qty===0)return;
      modify(item,c,function(r){
        if(btn.dataset.action==="plus"){var zero=r.total_qty===0;r.total_qty++;if(zero)r.binder_qty=1}
        if(btn.dataset.action==="minus")r.total_qty=Math.max(0,r.total_qty-1);
        r.stock_verified=true;
      });
    });
    grid.addEventListener("change",function(e){
      var inp=e.target,field=inp.dataset.field,item=inp.closest("[data-key]"),c=byKey.get(item&&item.dataset.key);
      if(!c||!field)return;
      var previous=stock(c),checked=inp.type==="checkbox"?inp.checked:false;
      if(field==="sell_enabled"&&checked&&(!previous.stock_verified||!previous.price_krw||free(previous)===0)){
        inp.checked=false;alert("판매 공개 전 '수량 확인', 판매가능 수량, 판매가를 설정해 주세요.");return;
      }
      if(field==="image_override"&&inp.value.trim()&&!/^https:\/\//i.test(inp.value.trim())){
        alert("사진 주소는 https:// 로 시작해야 합니다.");inp.value=previous.image_override||"";return;
      }
      modify(item,c,function(r){
        if(field==="binder_qty")r.binder_qty=checked?1:0;
        else if(field==="sell_enabled"||field==="stock_verified")r[field]=checked;
        else if(field==="price_krw")r[field]=Number(inp.value)||0;
        else r[field]=inp.value.trim();
      });
      if(field==="image_override"){
        var img=item.querySelector(".photo img"),url=photoUrl(c,stock(c));
        if(img){img.src=url.src;img.dataset.fallback=url.fallback}
      }
    });
    $("refreshBtn").addEventListener("click",async function(){
      if(timers.size){alert("자동 저장이 끝난 뒤 갱신해 주세요.");return}
      try{saveStatus("재고 갱신 중…");await Promise.all([...chains.values()]);await loadStock();summary();refreshList();saveStatus("최신 재고 갱신 완료")}
      catch(err){saveStatus("갱신 실패: "+err.message)}
    });
  }
  async function showAdmin(){
    $("loginPanel").hidden=true;$("adminMain").hidden=false;saveStatus("재고 불러오는 중…");
    try{await loadStock();summary();refreshList();saveStatus("수량·가격 변경 시 자동 저장")}
    catch(err){$("status").hidden=false;$("status").textContent="재고 불러오기 실패: "+err.message;saveStatus("확인 필요")}
  }
  function cartRows(){
    return [...cart].map(function(pair){return {c:byKey.get(pair[0]),r:inventory.get(pair[0]),q:pair[1]}}).filter(function(x){return x.c&&listed(x.r)}).map(function(x){x.q=Math.min(x.q,free(x.r));return x}).filter(function(x){return x.q>0});
  }
  function persistCart(){try{localStorage.setItem("pokemon_cart_v1",JSON.stringify([...cart]))}catch{}}
  function paintCart(){
    var rows=cartRows(),count=rows.reduce(function(a,x){return a+x.q},0),total=rows.reduce(function(a,x){return a+x.q*x.r.price_krw},0);
    $("cartBar").hidden=count===0;$("cartCount").textContent=count+"장 선택";$("cartTotal").textContent=won(total);
    $("cartSummary").innerHTML="<b>"+count+"장 · "+won(total)+"</b>";
    $("cartItems").innerHTML=rows.length?rows.map(function(x){return '<div class="cart-line" data-key="'+esc(x.c.key)+'"><div class="cart-line-info"><b>'+esc(x.c.name)+'</b><br><small>'+esc(x.c.key)+" · "+won(x.r.price_krw)+'/장</small></div><div class="cart-step"><button data-step="-1">−</button><b>'+x.q+'</b><button data-step="1">+</button></div></div>'}).join(""):"<p>선택된 카드가 없습니다.</p>";
  }
  function wireShop(){
    try{cart=new Map(JSON.parse(localStorage.getItem("pokemon_cart_v1")||"[]"))}catch{cart=new Map()}
    grid.addEventListener("click",function(e){
      var b=e.target.closest('button[data-action="add"]');if(!b)return;
      var item=b.closest("[data-key]"),c=byKey.get(item&&item.dataset.key);if(!c)return;
      var r=stock(c),n=cart.get(c.key)||0;if(!listed(r))return;
      if(n>=free(r)){alert("판매가능 수량을 초과했습니다.");return}
      cart.set(c.key,n+1);persistCart();paintCart();
      b.textContent="✓ 담았어요";setTimeout(function(){if(b.isConnected)b.textContent="구매목록 담기"},800);
    });
    $("openCart").onclick=function(){$("cartOverlay").hidden=false};
    $("closeCart").onclick=function(){$("cartOverlay").hidden=true};
    $("cartOverlay").onclick=function(e){if(e.target===$("cartOverlay"))$("cartOverlay").hidden=true};
    $("cartItems").onclick=function(e){
      var b=e.target.closest("button[data-step]"),item=b&&b.closest("[data-key]");if(!item)return;
      var key=item.dataset.key,c=byKey.get(key),n=Math.max(0,Math.min(free(stock(c)),(cart.get(key)||0)+Number(b.dataset.step)));
      if(n)cart.set(key,n);else cart.delete(key);persistCart();paintCart();
    };
    $("copyCart").onclick=async function(){
      var rows=cartRows();if(!rows.length)return;
      var sum=rows.reduce(function(a,x){return a+x.q*x.r.price_krw},0);
      var msg="포켓몬 카드 구매 문의\n"+rows.map(function(x){return x.c.setName+" "+x.c.key+" "+x.c.name+" "+x.q+"장 × "+won(x.r.price_krw)+" = "+won(x.q*x.r.price_krw)}).join("\n")+"\n합계 "+won(sum)+" (배송비 별도, 재고·가격 최종 확인 요청)";
      try{await navigator.clipboard.writeText(msg);alert("구매목록을 복사했어요. 카카오톡에 붙여넣어 주세요.")}
      catch{prompt("아래 목록을 복사해 주세요.",msg)}
    };
    document.addEventListener("keydown",function(e){if(e.key==="Escape")$("cartOverlay").hidden=true});
    db.from("public_shop_settings").select("kakao_openchat_url").eq("id",1).maybeSingle().then(function(r){
      if(r.data&&/^https:\/\//.test(r.data.kakao_openchat_url||"")){$("kakaoLink").href=r.data.kakao_openchat_url;$("kakaoLink").hidden=false}
    }).catch(function(){});
  }
  async function start(){
    try{
      if(!db)throw Error("사이트 설정을 확인해 주세요.");
      await loadCatalog();wireCommon();
      if(admin){
        wireAdmin();
        var u=await db.auth.getUser();
        if(u.error||!u.data||!u.data.user){$("loginPanel").hidden=false;$("summary").textContent="관리자 로그인 필요";return}
        await showAdmin();
      }else{
        await loadStock();
        $("saleOnly").checked=catalog.some(function(c){return listed(stock(c))});
        wireShop();summary();refreshList();paintCart();
      }
    }catch(err){$("status").hidden=false;$("status").textContent="페이지 준비 중 오류: "+err.message;console.error("Pokemon page",err)}
  }
  start();
})();
