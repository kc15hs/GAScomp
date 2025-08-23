// ---- ユーティリティ ----
const yen = v => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// 今日（日付）
const getTodayMMDD = () => {
  const d = new Date();
  return String(d.getMonth()+1).padStart(2,"0") + "/" + String(d.getDate()).padStart(2,"0");
};
const getTodayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

// MM/DD ←→ YYYY-MM-DD
const mmddToYmd = (mmdd) => {
  const m = (mmdd || "").match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return "";
  const year = new Date().getFullYear();
  const mm = String(Math.min(12, Math.max(1, +m[1]))).padStart(2,"0");
  const dd = String(Math.min(31, Math.max(1, +m[2]))).padStart(2,"0");
  return `${year}-${mm}-${dd}`;
};
const ymdToMmdd = (ymd) => {
  const m = (ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[2]}/${m[3]}`;
};

// 日付入力：入力中は軽いサニタイズのみ（数字と / 、/ は1個、最大5文字）
function sanitizeMMDDInput(val) {
  let s = (val || "").replace(/[^\d/]/g, "");
  const first = s.indexOf("/");
  if (first !== -1) s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\//g, "");
  return s.slice(0, 5);
}
// フォーカスアウト時にMM/DD確定（空や不正は今日）
function finalizeMMDD(val) {
  const m = (val || "").match(/^(\d{1,2})(?:\/(\d{1,2}))?$/);
  let mm, dd;
  if (!m) {
    const t = getTodayMMDD().split("/");
    mm = +t[0]; dd = +t[1];
  } else {
    mm = Math.min(12, Math.max(1, +(m[1] || 0)));
    dd = Math.min(31, Math.max(1, +(m[2] || 0 || new Date().getDate())));
  }
  return String(mm).padStart(2,"0") + "/" + String(dd).padStart(2,"0");
}

// ---- 要素取得 ----
const price = document.getElementById('price');
const eff = document.getElementById('eff');
const segmentsBox = document.getElementById('segments');
const addSeg = document.getElementById('addSeg');
const clearSeg = document.getElementById('clearSeg');
const sumKm = document.getElementById('sumKm');
const liters = document.getElementById('liters');
const total = document.getElementById('total');
const perKm = document.getElementById('perKm');
const perPerson = document.getElementById('perPerson');
const warn = document.getElementById('warn');
const resetBtn = document.getElementById('resetBtn');
const shareBtn = document.getElementById('shareBtn');

// ---- 区間行生成 ----
function segRow(data = {}) {
  const {
    date = getTodayMMDD(),
    km = "",            // ← 初期は空欄
    start = "",         // ← 初期は空欄
    end = "",           // ← 初期は空欄
    people = 1,
    checked = true
  } = data;

  const wrap = document.createElement('div');
  wrap.className = 'seg';
  wrap.innerHTML = `
    <input type="checkbox" class="seg-check" ${checked ? "checked" : ""} aria-label="区間を計算対象にする">
    <div class="date-wrapper">
      <input type="text" class="seg-date" inputmode="numeric" placeholder="MM/DD" value="${finalizeMMDD(date)}">
      <input type="date" class="seg-date-picker" value="${mmddToYmd(finalizeMMDD(date)) || getTodayYMD()}">
    </div>
    <input type="number" class="seg-km" inputmode="decimal" step="0.1" min="0" placeholder="走行距離" value="${km}">
    <input type="number" class="seg-start" inputmode="decimal" step="0.1" min="0" placeholder="スタート距離" value="${start}">
    <input type="number" class="seg-end" inputmode="decimal" step="0.1" min="0" placeholder="エンド距離" value="${end}">
    <input type="number" class="seg-people" inputmode="numeric" step="1" min="1" value="${people}" aria-label="割り勘人数">
    <button type="button" class="seg-del" aria-label="削除">削除</button>
  `;

  const check = wrap.querySelector('.seg-check');
  const dateInput = wrap.querySelector('.seg-date');
  const datePicker = wrap.querySelector('.seg-date-picker');
  const kmInput = wrap.querySelector('.seg-km');
  const startInput = wrap.querySelector('.seg-start');
  const endInput = wrap.querySelector('.seg-end');
  const peopleInput = wrap.querySelector('.seg-people');
  const del = wrap.querySelector('.seg-del');

  // ---- 日付：テキスト欄クリックでカレンダーを開く ----
  const openCalendar = () => {
    if (typeof datePicker.showPicker === "function") datePicker.showPicker();
    else datePicker.focus();
  };
  dateInput.addEventListener('focus', openCalendar);
  dateInput.addEventListener('click', openCalendar);

  // カレンダー→テキスト（MM/DD）
  datePicker.addEventListener('change', () => {
    dateInput.value = ymdToMmdd(datePicker.value) || getTodayMMDD();
    saveState(); recalc();
  });

  // バックスペース対策：入力中は軽いサニタイズのみ
  let lastKey = "";
  dateInput.addEventListener('keydown', (e) => { lastKey = e.key; });
  dateInput.addEventListener('input', (e) => {
    if (lastKey === "Backspace" || lastKey === "Delete") return;
    e.target.value = sanitizeMMDDInput(e.target.value);
    const ymd = mmddToYmd(e.target.value);
    if (ymd) datePicker.value = ymd;
    saveState();
  });

  // フォーカスアウトでMM/DD確定
  dateInput.addEventListener('blur', () => {
    dateInput.value = finalizeMMDD(dateInput.value);
    datePicker.value = mmddToYmd(dateInput.value) || getTodayYMD();
    saveState();
  });

  // ---- 距離欄：blur時だけ小数1桁に整形（空欄はそのまま空欄） ----
  const oneDecimalOnBlurAllowEmpty = (input) => {
    input.addEventListener('blur', () => {
      const t = input.value.trim();
      if (t === "") return; // 空はそのまま
      const num = parseFloat(t);
      if (!isNaN(num)) input.value = num.toFixed(1); // 1桁固定
      saveState(); recalc();
    });
  };
  [kmInput, startInput, endInput].forEach(oneDecimalOnBlurAllowEmpty);

  // Start/End → Km 自動計算（両方ありなら即計算・1桁表示、どちらか空ならkmは手入力/空のまま）
  const syncKmFromSE = () => {
    const s = parseFloat(startInput.value);
    const e = parseFloat(endInput.value);
    if (!isNaN(s) && !isNaN(e)) {
      const d = Math.max(0, e - s);
      kmInput.value = d.toFixed(1);
      kmInput.readOnly = true;
    } else {
      kmInput.readOnly = false;
      // 入力中は値をいじらない（空欄も許容）
    }
  };

  // 値変更
  const onInput = () => { syncKmFromSE(); recalc(); saveState(); };
  [check, kmInput, startInput, endInput, peopleInput].forEach(el => el.addEventListener('input', onInput));

  // 削除
  del.addEventListener('click', () => { wrap.remove(); recalc(); saveState(); });

  // 初期同期
  dateInput.value = finalizeMMDD(dateInput.value);
  if (!datePicker.value) datePicker.value = getTodayYMD();
  syncKmFromSE();
  return wrap;
}

// ---- 区間追加 ----
function addSegment(data = {}) {
  segmentsBox.appendChild(segRow({ checked: true, people: 1, ...data }));
  recalc(); saveState();
}

// ---- 状態復元/保存 ----
function fromState(s) {
  if (!s) return;
  price.value = s.price ?? "";
  eff.value = s.eff ?? "";
  segmentsBox.innerHTML = "";
  // 既存データがなければ空欄の新行を1つ
  (s.kms?.length ? s.kms : [{}]).forEach(v => addSegment({
    date: v.date ?? getTodayMMDD(),
    km: (v.km === "" || v.km === null || typeof v.km === "undefined") ? "" : String(v.km),
    start: (v.start === "" || v.start === null || typeof v.start === "undefined") ? "" : String(v.start),
    end: (v.end === "" || v.end === null || typeof v.end === "undefined") ? "" : String(v.end),
    people: Math.max(1, parseInt(v.people || "1", 10)),
    checked: v.checked !== false
  }));
}
function saveState() {
  const kms = [...segmentsBox.querySelectorAll('.seg')].map(row => {
    const kmVal = row.querySelector('.seg-km').value.trim();
    const startVal = row.querySelector('.seg-start').value.trim();
    const endVal = row.querySelector('.seg-end').value.trim();
    return {
      checked: row.querySelector('.seg-check').checked,
      date: row.querySelector('.seg-date').value || getTodayMMDD(),
      km: kmVal === "" ? "" : parseFloat(kmVal) || 0,
      start: startVal === "" ? "" : parseFloat(startVal) || 0,
      end: endVal === "" ? "" : parseFloat(endVal) || 0,
      people: Math.max(1, parseInt(row.querySelector('.seg-people').value || "1", 10))
    };
  });
  save('gas-calc', { price: Number(price.value || 0), eff: Number(eff.value || 0), kms });
}

// ---- 再計算（表示は触らず内部だけ0扱い）----
function recalc() {
  let kmTotal = 0, maxPeople = 0, costTotal = 0;
  const p = Number(price.value || 0);
  const e = Number(eff.value || 0);

  [...segmentsBox.querySelectorAll('.seg')].forEach(row => {
    if (!row.querySelector('.seg-check').checked) return;

    const kmStr = row.querySelector('.seg-km').value.trim();
    const km = kmStr === "" ? 0 : (parseFloat(kmStr) || 0); // 空欄は0として集計
    kmTotal += km;

    const ppl = Math.max(1, parseInt(row.querySelector('.seg-people').value || "1", 10));
    maxPeople = Math.max(maxPeople, ppl);

    if (e > 0) costTotal += (km / e) * p;
  });

  sumKm.textContent = kmTotal.toFixed(1);

  if (e <= 0) {
    liters.textContent = "0.00";
    total.textContent = "¥0";
    perKm.textContent = "¥0.00";
    perPerson.textContent = "¥0";
    return;
  }
  liters.textContent = (kmTotal / e).toFixed(2);
  perKm.textContent = `¥${(p / e).toFixed(2)}`;
  total.textContent = yen(costTotal);
  perPerson.textContent = yen(maxPeople > 0 ? (costTotal / maxPeople) : 0);
}

// ---- イベント ----
addSeg.addEventListener('click', () => addSegment({ date: getTodayMMDD(), km: "", start: "", end: "" })); // 追加直後は空欄
clearSeg.addEventListener('click', () => {
  segmentsBox.innerHTML = "";
  addSegment({ date: getTodayMMDD(), km: "", start: "", end: "" }); // クリア後の1行目も空欄
});
[price, eff].forEach(el => el.addEventListener('input', recalc));
resetBtn.addEventListener('click', ()=>{
  localStorage.removeItem('gas-calc');
  price.value = ""; eff.value = "";
  segmentsBox.innerHTML = "";
  addSegment({ date: getTodayMMDD(), km: "", start: "", end: "" });
  recalc();
});
shareBtn.addEventListener('click', async ()=>{
  const rows = [...segmentsBox.querySelectorAll('.seg')];
  const checkedRows = rows.filter(r => r.querySelector('.seg-check').checked);
  const maxP = checkedRows.reduce((m,r)=>Math.max(m, Math.max(1, parseInt(r.querySelector('.seg-people').value || "1", 10))), 0);

  const text = `ガソリン計算:
単価: ${price.value || 0} 円/ℓ
燃費: ${eff.value || 0} km/ℓ
対象区間: ${checkedRows.length} 件 / 最大割り勘人数: ${maxP || 0}
距離合計: ${sumKm.textContent} km
必要燃料: ${liters.textContent} ℓ
合計: ${total.textContent}
1kmあたり: ${perKm.textContent}
1人あたり: ${perPerson.textContent}`;
  try{
    if (navigator.share) await navigator.share({ text, title: "ガソリン費用計算" });
    else { await navigator.clipboard.writeText(text); alert("結果をクリップボードにコピーしました。"); }
  } catch(_) {}
});

// ---- 起動 ----
fromState(load('gas-calc', null));
if (!segmentsBox.querySelector('.seg')) addSegment({ date: getTodayMMDD(), km: "", start: "", end: "" });
recalc();
