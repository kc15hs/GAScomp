// ---- ユーティリティ ----
const yen = v => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

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
  const { km = "", start = "", end = "", people = 1, checked = true } = data;
  const wrap = document.createElement('div');
  wrap.className = 'seg';
  wrap.innerHTML = `
    <input type="checkbox" class="seg-check" ${checked ? "checked" : ""} aria-label="区間を計算対象にする">
    <input type="number" class="seg-km" inputmode="decimal" step="0.1" min="0" placeholder="走行距離" value="${km}">
    <input type="number" class="seg-start" inputmode="decimal" step="0.1" min="0" placeholder="スタート距離" value="${start}">
    <input type="number" class="seg-end" inputmode="decimal" step="0.1" min="0" placeholder="エンド距離" value="${end}">
    <input type="number" class="seg-people" inputmode="numeric" step="1" min="1" value="${people}" aria-label="割り勘人数">
    <button type="button" class="seg-del" aria-label="削除">削除</button>
  `;

  const check = wrap.querySelector('.seg-check');
  const kmInput = wrap.querySelector('.seg-km');
  const startInput = wrap.querySelector('.seg-start');
  const endInput = wrap.querySelector('.seg-end');
  const peopleInput = wrap.querySelector('.seg-people');
  const del = wrap.querySelector('.seg-del');

  const formatOneDecimal = (input) => {
    if (input.value === "") return;
    const val = parseFloat(input.value);
    if (!isNaN(val)) input.value = val.toFixed(1);
  };

  const syncKmFromSE = () => {
    const s = parseFloat(startInput.value);
    const e = parseFloat(endInput.value);

    // Start/Endともに入力済みなら走行距離を自動計算
    if (!isNaN(s) && !isNaN(e)) {
      formatOneDecimal(startInput);
      formatOneDecimal(endInput);

      if (e >= s) {
        kmInput.value = (e - s).toFixed(1);
      } else {
        kmInput.value = (0).toFixed(1);
      }
      kmInput.readOnly = true;
    } else {
      kmInput.readOnly = false;
      if (kmInput.value !== "") {
        kmInput.value = parseFloat(kmInput.value).toFixed(1);
      }
    }
  };

  const onChange = () => {
    formatOneDecimal(startInput);
    formatOneDecimal(endInput);
    formatOneDecimal(kmInput);
    syncKmFromSE();
    recalc();
    saveState();
  };

  [check, kmInput, startInput, endInput, peopleInput].forEach(el => el.addEventListener('input', onChange));
  del.addEventListener('click', () => { wrap.remove(); recalc(); saveState(); });

  // 初期同期
  syncKmFromSE();
  return wrap;
}

// ---- 区間追加 ----
function addSegment(data = {}) {
  segmentsBox.appendChild(segRow({ checked: true, people: 1, ...data }));
  recalc();
  saveState();
}

// ---- 状態復元 ----
function fromState(s) {
  if (!s) return;
  price.value = s.price ?? "";
  eff.value = s.eff ?? "";
  segmentsBox.innerHTML = "";
  (s.kms?.length ? s.kms : [{}]).forEach(v => addSegment(v));
}

// ---- 状態保存 ----
function saveState() {
  const kms = [...segmentsBox.querySelectorAll('.seg')].map(row => ({
    checked: row.querySelector('.seg-check').checked,
    km: parseFloat(row.querySelector('.seg-km').value) || "",
    start: parseFloat(row.querySelector('.seg-start').value) || "",
    end: parseFloat(row.querySelector('.seg-end').value) || "",
    people: Math.max(1, parseInt(row.querySelector('.seg-people').value || "1", 10))
  }));
  save('gas-calc', {
    price: Number(price.value || 0),
    eff: Number(eff.value || 0),
    kms
  });
}

// ---- 再計算 ----
function recalc() {
  let kmTotal = 0;
  let maxPeople = 0;
  let costTotal = 0;

  const p = Number(price.value || 0);
  const e = Number(eff.value || 0);

  [...segmentsBox.querySelectorAll('.seg')].forEach(row => {
    const checked = row.querySelector('.seg-check').checked;
    const kmInput = row.querySelector('.seg-km');
    const startInput = row.querySelector('.seg-start');
    const endInput = row.querySelector('.seg-end');
    if (!checked) return;

    // Start/End/Kmをすべて小数第1位で統一
    const formatOneDecimal = (input) => {
      if (input.value === "") return;
      const val = parseFloat(input.value);
      if (!isNaN(val)) input.value = val.toFixed(1);
    };
    formatOneDecimal(kmInput);
    formatOneDecimal(startInput);
    formatOneDecimal(endInput);

    let km = parseFloat(kmInput.value) || 0;
    kmTotal += km;

    const ppl = Math.max(1, parseInt(row.querySelector('.seg-people').value || "1", 10));
    maxPeople = Math.max(maxPeople, ppl);

    // 各行コスト（距離→燃料→費用）
    if (e > 0) {
      const needL = km / e;
      costTotal += needL * p;
    }
  });

  sumKm.textContent = kmTotal.toFixed(1);

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

  const needLTotal = kmTotal / e;
  const perKmVal = p / e;
  const perPersonVal = (maxPeople > 0) ? (costTotal / maxPeople) : 0;

  liters.textContent = needLTotal.toFixed(2);
  total.textContent = yen(costTotal);
  perKm.textContent = `¥${perKmVal.toFixed(2)}`;
  perPerson.textContent = yen(perPersonVal);

  saveState();
}

// ---- イベント設定 ----
addSeg.addEventListener('click', () => addSegment({}));
clearSeg.addEventListener('click', () => { segmentsBox.innerHTML = ""; addSegment({}); });

[price, eff].forEach(el => el.addEventListener('input', recalc));

resetBtn.addEventListener('click', ()=>{
  localStorage.removeItem('gas-calc');
  price.value = ""; eff.value = "";
  segmentsBox.innerHTML = ""; addSegment({});
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
if (!segmentsBox.querySelector('.seg')) addSegment({});
recalc();
