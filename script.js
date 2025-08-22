// ---- ユーティリティ ----
const yen = v => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v);
const yen2 = v => new Intl.NumberFormat('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---- 要素取得 ----
const price = document.getElementById('price');
const eff = document.getElementById('eff');
const people = document.getElementById('people');

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

// ---- 初期化 ----
function segRow(kmVal = "") {
  const wrap = document.createElement('div');
  wrap.className = 'seg';
  wrap.innerHTML = `
    <input type="number" inputmode="decimal" step="0.1" min="0" placeholder="区間距離 (km)" value="${kmVal}">
    <button type="button" aria-label="削除">削除</button>
  `;
  const input = wrap.querySelector('input');
  const del = wrap.querySelector('button');
  input.addEventListener('input', recalc);
  del.addEventListener('click', () => { wrap.remove(); recalc(); saveState(); });
  return wrap;
}

function addSegment(value="") {
  segmentsBox.appendChild(segRow(value));
  recalc();
  saveState();
}

function fromState(s) {
  if (!s) return;
  price.value = s.price ?? "";
  eff.value = s.eff ?? "";
  people.value = s.people ?? 1;
  segmentsBox.innerHTML = "";
  (s.kms?.length ? s.kms : [""]).forEach(v => addSegment(v));
}

function saveState() {
  const kms = [...segmentsBox.querySelectorAll('input')].map(i => Number(i.value || 0)).filter(v => v>=0);
  save('gas-calc', {
    price: Number(price.value || 0),
    eff: Number(eff.value || 0),
    people: Math.max(1, Number(people.value || 1)),
    kms
  });
}

// ---- 計算 ----
function recalc() {
  // 合計距離（※往復チェックは削除 → 片道固定）
  let km = [...segmentsBox.querySelectorAll('input')].reduce((a,i)=>a + Number(i.value || 0), 0);
  sumKm.textContent = km.toFixed(1);

  const p = Number(price.value || 0);
  const e = Number(eff.value || 0);
  const n = Math.max(1, Number(people.value || 1));

  warn.textContent = "";
  if (e <= 0) {
    liters.textContent = "0.00";
    total.textContent = "¥0";
    perKm.textContent = "¥0.00";
    perPerson.textContent = "¥0";
    if (String(eff.value).length) warn.textContent = "燃費は 0 より大きい数を入力してください。";
    saveState();
    return;
  }

  const needL = km / e;                 // 必要燃料
  const cost = needL * p;               // 合計費用
  const perKmVal = p / e;               // 1kmあたり
  const perPersonVal = cost / n;        // 1人あたり

  liters.textContent = needL.toFixed(2);
  total.textContent = yen(cost);
  perKm.textContent = `¥${perKmVal.toFixed(2)}`;
  perPerson.textContent = yen(perPersonVal);

  saveState();
}

// ---- UIイベント ----
addSeg.addEventListener('click', () => addSegment(""));
clearSeg.addEventListener('click', () => { segmentsBox.innerHTML=""; addSegment(""); });

[price, eff, people].forEach(el => el.addEventListener('input', recalc));

resetBtn.addEventListener('click', ()=>{
  localStorage.removeItem('gas-calc');
  price.value = ""; eff.value = ""; people.value = 1;
  segmentsBox.innerHTML = ""; addSegment("");
  recalc();
});

shareBtn.addEventListener('click', async ()=>{
  const text = `ガソリン計算:
単価: ${price.value || 0} 円/ℓ
燃費: ${eff.value || 0} km/ℓ
距離合計: ${sumKm.textContent} km
必要燃料: ${liters.textContent} ℓ
合計: ${total.textContent}
1kmあたり: ${perKm.textContent}
人数: ${Math.max(1, Number(people.value||1))} 人 / 1人あたり: ${perPerson.textContent}`;
  try{
    if (navigator.share) {
      await navigator.share({ text, title: "ガソリン費用計算" });
    } else {
      await navigator.clipboard.writeText(text);
      alert("結果をクリップボードにコピーしました。");
    }
  } catch(_) {}
});

// ---- 起動 ----
fromState(load('gas-calc', null));
// 初回に区間がなければ1行追加
if (!segmentsBox.querySelector('.seg')) addSegment("");
recalc();
