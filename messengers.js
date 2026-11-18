// 모든 상담 버튼의 링크와 클릭 측정을 한 곳에서 관리한다.
var PAGE = document.body.dataset.page;
var WA_NUMBER = "821030981064";
// 대만 광고 전용 LINE 주소가 발급되면 이 값만 교체한다.
var LINE_FRIEND_URL = "https://lin.ee/yIwrIxt";
var UTM = new URLSearchParams(location.search);
var LINE_IN_APP = /FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
var campaign = UTM.get("utm_campaign") || "";
var AD_REGION = PAGE === "tw" ? "TW" : /_my$/i.test(campaign) ? "MY" : /_sg$/i.test(campaign) ? "SG" : campaign === "cn_test" ? "CN" : "";
var token = ((UTM.get("utm_content") || "").split("_")[0] || "W").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "W";
var AD_CODE = PAGE === "tw" ? "TW-202611-" + token : token + (AD_REGION ? "-" + AD_REGION : "");
var MSG = PAGE === "en" ? "Hi, I'd like to ask about a consultation (code: " + AD_CODE + ")" : PAGE === "tw" ? "您好，我想諮詢 OARO 清涼里店（代碼：" + AD_CODE + "）" : "您好，我想咨询限时活动（代码：" + AD_CODE + "）";
var WX_Q = new URLSearchParams(location.search); WX_Q.set("code", AD_CODE);
var WX_URL = "/" + PAGE + "/wechat/?" + WX_Q.toString();
var CH = { wechat: WX_URL, wa: "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(MSG), line: "https://line.me/R/oaMessage/@673mireh/?" + encodeURIComponent(MSG) };
// 대만판은 위챗 말풍선이 없다(LINE만). 말풍선이 있는 페이지에서만 위챗 설정을 붙인다.
var pop = document.getElementById("wx-pop"), popHide = 0;
if (pop) document.getElementById("wx-pop-name").textContent = window.WECHAT_NAME || "";
if (pop && window.WECHAT_ID) {
  document.getElementById("wx-pop-id").textContent = window.WECHAT_ID;
  document.getElementById("wx-pop-id-row").hidden = false;
}
function copyWechatId() {
  function fallback() {
    var ta = document.createElement("textarea"); ta.value = window.WECHAT_ID;
    ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta);
    ta.select();
    try { if (!document.execCommand("copy")) throw new Error("Copy failed"); }
    finally { ta.remove(); }
  }
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(window.WECHAT_ID).catch(fallback);
  return Promise.resolve().then(fallback);
}
var wxCopyTimer;
if (pop) document.getElementById("wx-pop-copy").addEventListener("click", function () {
  var b = this;
  copyWechatId().then(function () {
    b.textContent = (PAGE === "en" ? "Copied" : PAGE === "tw" ? "已複製" : "已复制"); clearTimeout(wxCopyTimer);
    wxCopyTimer = setTimeout(function () { b.textContent = (PAGE === "en" ? "Copy" : PAGE === "tw" ? "複製" : "复制"); }, 1500);
  }, function () { b.textContent = (PAGE === "en" ? "Copy" : PAGE === "tw" ? "複製" : "复制"); });
});

// PC 말풍선: 마우스를 올릴 수 있는 화면에서만. 터치 화면은 누르면 바로 QR 페이지로 간다.
var CAN_HOVER = matchMedia("(hover:hover) and (pointer:fine)").matches;
function showPop(a) {
  clearTimeout(popHide);
  var r = a.getBoundingClientRect(), W = 196, H = pop.offsetHeight || 290, x, y;
  if (a.closest(".fab")) { x = r.left - W - 12; y = Math.min(r.top + r.height / 2 - H / 2, innerHeight - H - 8); }   // 오른쪽 아래 플로팅 → 왼쪽에
  else { x = r.left + r.width / 2 - W / 2; y = r.bottom + 10; if (y + H > innerHeight - 8) y = r.top - H - 10; }
  pop.style.left = Math.max(8, Math.min(x, innerWidth - W - 8)) + "px";
  pop.style.top = Math.max(8, y) + "px";
  pop.classList.add("on"); pop.setAttribute("aria-hidden", "false");
}
function hidePop() { popHide = setTimeout(function () { pop.classList.remove("on"); pop.setAttribute("aria-hidden", "true"); }, 160); }
if (pop) {
  pop.addEventListener("mouseenter", function () { clearTimeout(popHide); });
  pop.addEventListener("mouseleave", hidePop);
  addEventListener("keydown", function (e) { if (e.key === "Escape") hidePop(); });
  addEventListener("scroll", function () { if (pop.classList.contains("on")) hidePop(); }, { passive: true });
}


var lineFallback = PAGE === "tw" && document.getElementById("line-fallback");
var lineFallbackTimer, lineTrigger;
if (lineFallback) {
  lineFallback.querySelector(".line-close").addEventListener("click", function () { lineFallback.close(); });
  lineFallback.addEventListener("close", function () { if (lineTrigger) lineTrigger.focus({ preventScroll: true }); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") clearTimeout(lineFallbackTimer);
  });
  addEventListener("pagehide", function () { clearTimeout(lineFallbackTimer); });
  document.getElementById("line-copy").addEventListener("click", function () {
    var status = document.getElementById("line-copy-status");
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = "@673mireh";
      lineFallback.appendChild(ta); ta.select();
      try { if (!document.execCommand("copy")) throw new Error("Copy failed"); }
      finally { ta.remove(); document.getElementById("line-copy").focus(); }
    }
    var copy = navigator.clipboard && window.isSecureContext
      ? navigator.clipboard.writeText("@673mireh").catch(fallback) : Promise.resolve().then(fallback);
    copy.then(function () { status.textContent = "已複製 LINE ID"; }, function () { status.textContent = "無法複製，請手動輸入 @673mireh"; });
  });
}
function lineMethod(a) { return a.dataset.concern ? "concern" : a.dataset.method === "friend" ? "friend" : "message"; }
function trackClick(a) {
  var kind = a.dataset.ch || "tel";
  var pos = a.dataset.pos || "footer";
  var p = { channel: kind, pos: pos, page: PAGE, region: AD_REGION,
    utm_source: UTM.get("utm_source") || "(direct)", utm_campaign: campaign, utm_content: UTM.get("utm_content") || "", concern: a.dataset.concern || "" };
  if (PAGE === "tw" && kind === "line") {
    p.method = lineMethod(a); p.in_app = LINE_IN_APP; p.placement = UTM.get("utm_term") || "";
  }
  if (window.gtag) gtag("event", kind + "_click", p);
  if (window.fbq) fbq("track", "Contact", { channel: kind, content_name: kind + "_" + pos + (PAGE === "tw" && kind === "line" ? "_" + lineMethod(a) : "") + (a.dataset.concern ? "_" + a.dataset.concern : "") });
  if (PAGE === "tw" && kind === "line" && window._lt) _lt("send", "cv", { type: "Conversion" }, [LINE_TAG_ID]);
}
document.querySelectorAll("[data-ch], a[href^='tel:']").forEach(function (a) {
  if (a.dataset.ch) a.href = CH[a.dataset.ch];
  // 대만판 고민 버튼: 고른 고민을 LINE 첫 메시지에 넣는다(광고 코드는 그대로)
  if (a.dataset.concern && a.dataset.ch === "line") {
    var q = a.dataset.concern === "還不確定" ? "您好，我還不確定要做什麼療程，想先問問醫師建議和價格（代碼：" + AD_CODE + "）"
      : "您好，我想問「" + a.dataset.concern + "」療程的價格和時段（代碼：" + AD_CODE + "）";
    a.href = "https://line.me/R/oaMessage/@673mireh/?" + encodeURIComponent(q);
  }
  if (PAGE === "tw" && a.dataset.ch === "line") {
    if (a.dataset.method === "friend") a.href = LINE_FRIEND_URL;
    if (LINE_IN_APP) a.removeAttribute("target");
  }
  a.addEventListener("click", function (e) {
    trackClick(a);
    if (lineFallback && a.dataset.ch === "line" && LINE_IN_APP) {
      clearTimeout(lineFallbackTimer);
      lineTrigger = a;
      lineFallbackTimer = setTimeout(function () {
        if (document.visibilityState !== "visible" || lineFallback.open) return;
        lineFallback.showModal();
        if (window.gtag) gtag("event", "line_fallback_shown", { method: lineMethod(a), in_app: LINE_IN_APP, placement: UTM.get("utm_term") || "", pos: a.dataset.pos });
      }, 1500);
    }
    if (a.dataset.ch === "wechat" && !a.closest(".wx-pop") && CAN_HOVER) {
      e.preventDefault(); showPop(a);
    }
  });
  if (a.dataset.ch === "wechat" && CAN_HOVER && !a.closest(".wx-pop")) {
    a.addEventListener("mouseenter", function () { showPop(a); });
    a.addEventListener("mouseleave", hidePop);
    a.addEventListener("focus", function () { showPop(a); });
    a.addEventListener("blur", hidePop);
  }
});
